'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Painel de gestão é restrito à Beatriz (flag gerencia_holerites), não a
// qualquer admin — Junior, por exemplo, não gerencia esse módulo.
async function requireGerenciaHolerites() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('gerencia_holerites')
    .eq('id', user.id)
    .single<{ gerencia_holerites: boolean }>()
  if (!profile?.gerencia_holerites) redirect('/holerites')

  return { supabase, user }
}

async function pegaIpEUserAgent() {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = h.get('user-agent')
  return { ip, userAgent }
}

// Admin sobe o PDF individual de um colaborador pra um mês. Reenviar
// substitui o arquivo e volta o status pra "enviado" (novo ciclo de
// ciência/assinatura) — não dá pra corrigir arquivo sem reabrir o fluxo.
export async function enviarHolerite(formData: FormData) {
  const { supabase, user } = await requireGerenciaHolerites()

  const colaboradorId = formData.get('colaborador_id') as string
  const mesReferencia = formData.get('mes_referencia') as string
  const arquivo = formData.get('arquivo') as File

  if (!colaboradorId || !mesReferencia || !arquivo || arquivo.size === 0) {
    redirect(`/holerites?error=${encodeURIComponent('Escolha o colaborador, o mês e o arquivo PDF')}`)
  }
  if (arquivo.type !== 'application/pdf') {
    redirect(`/holerites?error=${encodeURIComponent('O arquivo precisa ser um PDF')}`)
  }

  const mesISO = `${mesReferencia}-01`
  const path = `${colaboradorId}/${mesISO}.pdf`
  const bytes = new Uint8Array(await arquivo.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('holerites')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (uploadError) {
    redirect(`/holerites?error=${encodeURIComponent('Não foi possível subir o arquivo: ' + uploadError.message)}`)
  }

  const { data: holerite, error: dbError } = await supabase
    .from('holerites')
    .upsert(
      {
        colaborador_id: colaboradorId,
        mes_referencia: mesISO,
        arquivo_path: path,
        enviado_por: user.id,
        status: 'enviado',
        enviado_em: new Date().toISOString(),
        visualizado_em: null,
        assinado_em: null,
      },
      { onConflict: 'colaborador_id,mes_referencia' }
    )
    .select('id')
    .single<{ id: string }>()

  if (dbError || !holerite) {
    redirect(`/holerites?error=${encodeURIComponent('Arquivo subiu, mas não foi possível registrar o holerite')}`)
  }

  await supabase.from('holerite_eventos').insert({ holerite_id: holerite!.id, tipo_evento: 'enviado' })

  revalidatePath('/holerites')
  redirect('/holerites?success=enviado')
}

// Colaborador confirma que visualizou — chamado pela rota que serve o
// arquivo, na primeira abertura (ver src/app/holerites/[id]/arquivo/route.ts).
export async function marcarVisualizado(holeriteId: string, userId: string) {
  const supabase = await createClient()
  const { ip, userAgent } = await pegaIpEUserAgent()

  const { data: holerite } = await supabase
    .from('holerites')
    .select('status')
    .eq('id', holeriteId)
    .eq('colaborador_id', userId)
    .maybeSingle<{ status: string }>()

  if (!holerite || holerite.status !== 'enviado') return

  await supabase
    .from('holerites')
    .update({ status: 'visualizado', visualizado_em: new Date().toISOString() })
    .eq('id', holeriteId)
  await supabase
    .from('holerite_eventos')
    .insert({ holerite_id: holeriteId, tipo_evento: 'visualizado', ip_origem: ip, user_agent: userAgent })
}

// Confirmação de recebimento: reautentica com a própria senha (step-up) antes
// de marcar como assinado — sessão ativa sozinha não é evidência forte o
// suficiente (ver documento de referência).
export async function assinarHolerite(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/login')

  const holeriteId = formData.get('id') as string
  const senha = formData.get('senha') as string

  if (!holeriteId || !senha) {
    redirect(`/holerites?error=${encodeURIComponent('Digite a senha pra confirmar')}`)
  }

  const { data: holerite } = await supabase
    .from('holerites')
    .select('status')
    .eq('id', holeriteId)
    .eq('colaborador_id', user.id)
    .maybeSingle<{ status: string }>()

  if (!holerite) redirect('/holerites')
  if (holerite.status === 'assinado') redirect('/holerites?success=ja_assinado')

  // Verifica a senha sem derrubar a sessão atual — signInWithPassword só
  // confirma a credencial; se der certo, a sessão existente continua válida.
  const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: senha })
  if (authError) {
    redirect(`/holerites?error=${encodeURIComponent('Senha incorreta — tente de novo')}`)
  }

  const { ip, userAgent } = await pegaIpEUserAgent()

  await supabase
    .from('holerite_eventos')
    .insert({ holerite_id: holeriteId, tipo_evento: 'reautenticado', ip_origem: ip, user_agent: userAgent, metodo_reautent: 'senha' })

  const { error: updateError } = await supabase
    .from('holerites')
    .update({ status: 'assinado', assinado_em: new Date().toISOString() })
    .eq('id', holeriteId)

  if (updateError) {
    redirect(`/holerites?error=${encodeURIComponent('Não foi possível confirmar — tente de novo')}`)
  }

  await supabase
    .from('holerite_eventos')
    .insert({ holerite_id: holeriteId, tipo_evento: 'assinado', ip_origem: ip, user_agent: userAgent, metodo_reautent: 'senha' })

  revalidatePath('/holerites')
  redirect('/holerites?success=assinado')
}
