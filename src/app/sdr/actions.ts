'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SupaClient = Awaited<ReturnType<typeof createClient>>

// Acesso ao módulo é da equipe de SDR (cargo 'sdr'), da gerente delas
// (valida_sdr) e do admin. O RLS já barra o resto; aqui é a trava do servidor
// pra não dar pra burlar por fora.
async function quemPodeSdr(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase
    .from('profiles')
    .select('cargo, valida_sdr')
    .eq('id', user.id)
    .single<{ cargo: string; valida_sdr: boolean }>()
  const pode = p?.cargo === 'sdr' || p?.cargo === 'admin' || p?.valida_sdr === true
  if (!pode) redirect('/')
  return { user, valida: p?.valida_sdr === true || p?.cargo === 'admin' }
}

type LinhaSdr = {
  consultor_id: string
  unidade_id: string | null
  leads: number
  agendamentos: number
  comparecimentos: number
  observacao?: string
}

function inteiro(v: unknown): number {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export async function salvarSdrLeads(formData: FormData) {
  const supabase = await createClient()
  const { user } = await quemPodeSdr(supabase)

  const data = (formData.get('data') as string) || ''
  const raw = (formData.get('linhas') as string) || '[]'
  if (!data) redirect(`/sdr?error=${encodeURIComponent('Escolha o dia')}`)

  let linhas: LinhaSdr[]
  try {
    linhas = JSON.parse(raw)
  } catch {
    redirect(`/sdr?data=${data}&error=${encodeURIComponent('Erro ao ler os lançamentos')}`)
  }

  const registros = linhas
    .filter((l) => l.consultor_id)
    .map((l) => ({
      data,
      consultor_id: l.consultor_id,
      unidade_id: l.unidade_id || null,
      leads: inteiro(l.leads),
      agendamentos: inteiro(l.agendamentos),
      comparecimentos: inteiro(l.comparecimentos),
      observacao: (l.observacao || '').trim() || null,
      lancado_por: user.id,
      updated_at: new Date().toISOString(),
    }))

  if (registros.length > 0) {
    // Cada SDR grava a própria linha por consultor/dia (chave inclui quem lançou).
    const { error } = await supabase.from('sdr_leads').upsert(registros, { onConflict: 'data,consultor_id,lancado_por' })
    if (error) {
      redirect(`/sdr?data=${data}&error=${encodeURIComponent('Não foi possível salvar os lançamentos')}`)
    }
  }

  // Total de leads recebidos no dia — por SDR (cada uma o dela).
  const leadsRecebidos = inteiro(formData.get('leads_recebidos'))
  const { error: errDia } = await supabase
    .from('sdr_dia')
    .upsert({ data, sdr_id: user.id, leads_recebidos: leadsRecebidos, updated_at: new Date().toISOString() }, { onConflict: 'data,sdr_id' })
  if (errDia) {
    redirect(`/sdr?data=${data}&error=${encodeURIComponent('Não foi possível salvar o total de leads')}`)
  }

  revalidatePath('/sdr')
  redirect(`/sdr?data=${data}&success=salvo`)
}

// Thuane/admin corrige o total de leads recebidos de cada SDR num dia (a SDR
// normalmente digita o próprio, mas às vezes é a gerente quem sabe o número
// certo, ex. quando a SDR esqueceu ou lançou errado).
export async function salvarLeadsRecebidosSdrs(formData: FormData) {
  const supabase = await createClient()
  const { valida } = await quemPodeSdr(supabase)
  const data = (formData.get('data') as string) || ''
  const de = (formData.get('de') as string) || ''
  const ate = (formData.get('ate') as string) || ''
  const voltar = `/sdr?de=${de}&ate=${ate}`

  if (!valida) redirect(`${voltar}&error=${encodeURIComponent('Só a gerente de SDR corrige o de outra pessoa')}`)
  if (!data) redirect('/sdr')

  const registros: { data: string; sdr_id: string; leads_recebidos: number; updated_at: string }[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('leads_')) continue
    const sdr_id = key.slice('leads_'.length)
    registros.push({ data, sdr_id, leads_recebidos: inteiro(value), updated_at: new Date().toISOString() })
  }

  if (registros.length > 0) {
    const { error } = await supabase.from('sdr_dia').upsert(registros, { onConflict: 'data,sdr_id' })
    if (error) {
      redirect(`${voltar}&error=${encodeURIComponent('Não foi possível salvar os leads recebidos')}`)
    }
  }

  revalidatePath('/sdr')
  redirect(`${voltar}&success=salvo`)
}

// Valida o dia (só a gerente de SDR ou o admin). Marca/desmarca.
export async function validarDiaSdr(formData: FormData) {
  const supabase = await createClient()
  const { user, valida } = await quemPodeSdr(supabase)
  const data = (formData.get('data') as string) || ''
  const desvalidar = formData.get('desvalidar') === '1'
  if (!valida) redirect(`/sdr?data=${data}&error=${encodeURIComponent('Só a gerente de SDR valida o dia')}`)
  if (!data) redirect('/sdr')

  if (desvalidar) {
    await supabase.from('sdr_dia_validado').delete().eq('data', data)
  } else {
    const { error } = await supabase
      .from('sdr_dia_validado')
      .upsert({ data, validado_por: user.id, validado_em: new Date().toISOString() }, { onConflict: 'data' })
    if (error) redirect(`/sdr?data=${data}&error=${encodeURIComponent('Não foi possível validar o dia')}`)
  }

  revalidatePath('/sdr')
  redirect(`/sdr?data=${data}&success=${desvalidar ? 'desvalidado' : 'validado'}`)
}
