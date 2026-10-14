'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SupaClient = Awaited<ReturnType<typeof createClient>>

// Conteúdo do treinamento é só do admin — mesmo padrão de soAdmin() em
// src/app/metas/actions.ts.
async function soAdmin(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('cargo').eq('id', user.id).single<{ cargo: string }>()
  if (p?.cargo !== 'admin') {
    redirect(`/treinamento?error=${encodeURIComponent('Só o admin edita o conteúdo do treinamento')}`)
  }
  return user
}

type OpcaoPayload = { texto: string; correta: boolean }
type PerguntaPayload = { id?: string; texto: string; opcoes: OpcaoPayload[] }

export async function salvarModulo(formData: FormData) {
  const supabase = await createClient()
  await soAdmin(supabase)

  const modulo_id = (formData.get('modulo_id') as string) || null
  const titulo = (formData.get('titulo') as string)?.trim()
  const conteudo = (formData.get('conteudo') as string) ?? ''
  const posicao = Number((formData.get('posicao') as string) || '0') || 0
  const ativo = formData.get('ativo') === 'on'
  const voltar = modulo_id ? `/treinamento/admin/${modulo_id}` : '/treinamento/admin/novo'

  if (!titulo) {
    redirect(`${voltar}?error=${encodeURIComponent('Dê um título ao módulo')}`)
  }

  let perguntas: PerguntaPayload[]
  try {
    perguntas = JSON.parse((formData.get('perguntas') as string) || '[]')
  } catch {
    redirect(`${voltar}?error=${encodeURIComponent('Erro ao ler as perguntas')}`)
  }
  perguntas = perguntas.filter((p) => p.texto?.trim())

  // Cada pergunta precisa de pelo menos 2 opções válidas e exatamente 1
  // correta — trava aqui evita módulo com quiz quebrado chegar ao consultor.
  for (const p of perguntas) {
    const validas = p.opcoes.filter((o) => o.texto?.trim())
    const corretas = validas.filter((o) => o.correta).length
    if (validas.length < 2 || corretas !== 1) {
      redirect(
        `${voltar}?error=${encodeURIComponent('Cada pergunta precisa de ao menos 2 opções e exatamente 1 correta')}`
      )
    }
  }

  // 1) upsert do módulo em si
  let moduloIdFinal = modulo_id
  if (modulo_id) {
    const { error } = await supabase
      .from('treinamento_modulos')
      .update({ titulo, conteudo, posicao, ativo })
      .eq('id', modulo_id)
    if (error) redirect(`${voltar}?error=${encodeURIComponent('Não foi possível salvar o módulo')}`)
  } else {
    const { data, error } = await supabase
      .from('treinamento_modulos')
      .insert({ titulo, conteudo, posicao, ativo })
      .select('id')
      .single<{ id: string }>()
    if (error || !data) redirect(`${voltar}?error=${encodeURIComponent('Não foi possível criar o módulo')}`)
    moduloIdFinal = data!.id
  }

  // 2) perguntas que saíram da lista enviada são apagadas — cascateia pras
  // opções delas e respostas que apontavam pra elas (aceitável: zero dado
  // real hoje).
  const { data: existentes } = await supabase.from('treinamento_perguntas').select('id').eq('modulo_id', moduloIdFinal!)
  const idsExistentes = new Set((existentes ?? []).map((p) => p.id as string))
  const idsEnviados = new Set(perguntas.filter((p) => p.id).map((p) => p.id as string))
  const paraDeletar = [...idsExistentes].filter((pid) => !idsEnviados.has(pid))
  if (paraDeletar.length > 0) {
    await supabase.from('treinamento_perguntas').delete().in('id', paraDeletar)
  }

  // 3) upsert de cada pergunta na ordem enviada; opções são sempre apagadas
  // e recriadas por inteiro (não precisam de id estável entre edições).
  for (let i = 0; i < perguntas.length; i++) {
    const p = perguntas[i]
    let perguntaId = p.id && idsExistentes.has(p.id) ? p.id : null
    if (perguntaId) {
      await supabase.from('treinamento_perguntas').update({ texto: p.texto.trim(), posicao: i + 1 }).eq('id', perguntaId)
    } else {
      const { data } = await supabase
        .from('treinamento_perguntas')
        .insert({ modulo_id: moduloIdFinal!, texto: p.texto.trim(), posicao: i + 1 })
        .select('id')
        .single<{ id: string }>()
      perguntaId = data?.id ?? null
    }
    if (!perguntaId) continue

    await supabase.from('treinamento_opcoes').delete().eq('pergunta_id', perguntaId)
    const opcoesValidas = p.opcoes.filter((o) => o.texto?.trim())
    if (opcoesValidas.length > 0) {
      await supabase.from('treinamento_opcoes').insert(
        opcoesValidas.map((o, j) => ({ pergunta_id: perguntaId, texto: o.texto.trim(), correta: o.correta, posicao: j + 1 }))
      )
    }
  }

  revalidatePath('/treinamento/admin')
  revalidatePath(`/treinamento/admin/${moduloIdFinal}`)
  redirect(`/treinamento/admin/${moduloIdFinal}?success=1`)
}

export async function excluirModulo(formData: FormData) {
  const supabase = await createClient()
  await soAdmin(supabase)
  const modulo_id = formData.get('modulo_id') as string

  const { error } = await supabase.from('treinamento_modulos').delete().eq('id', modulo_id)
  if (error) {
    redirect(`/treinamento/admin/${modulo_id}?error=${encodeURIComponent('Não foi possível excluir o módulo')}`)
  }

  revalidatePath('/treinamento/admin')
  redirect('/treinamento/admin')
}
