'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isGerenciaCargo } from '@/lib/membros'

type SupaClient = Awaited<ReturnType<typeof createClient>>

// Defesa em profundidade — a RLS já só deixa gerência escrever; isso aqui dá
// a mensagem certa e, abaixo, restringe por unidade (que a RLS não faz).
async function soGerencia(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase
    .from('profiles')
    .select('cargo, unidade_id')
    .eq('id', user.id)
    .single<{ cargo: string; unidade_id: string | null }>()
  if (!isGerenciaCargo(p?.cargo)) {
    redirect(`/treinamento?error=${encodeURIComponent('Só a gerência mexe na aprovação do treinamento')}`)
  }
  return { user, cargo: p?.cargo ?? null, unidade_id: p?.unidade_id ?? null }
}

async function confereUnidade(supabase: SupaClient, cargo: string | null, unidade_id: string | null, consultor_id: string) {
  if (cargo === 'admin') return
  const { data: consultor } = await supabase
    .from('profiles')
    .select('unidade_id')
    .eq('id', consultor_id)
    .single<{ unidade_id: string | null }>()
  if (consultor?.unidade_id !== unidade_id) {
    redirect(`/treinamento?error=${encodeURIComponent('Fora da sua unidade')}`)
  }
}

export async function responderQuiz(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const modulo_id = formData.get('modulo_id') as string

  const { data: perguntas } = await supabase
    .from('treinamento_perguntas')
    .select('id')
    .eq('modulo_id', modulo_id)
    .overrideTypes<{ id: string }[]>()

  const respostas = (perguntas ?? []).map((p) => ({
    pergunta_id: p.id,
    opcao_id: formData.get(`pergunta_${p.id}`) as string | null,
  }))

  if (respostas.length === 0 || respostas.some((r) => !r.opcao_id)) {
    redirect(`/treinamento?error=${encodeURIComponent('Responda todas as perguntas do módulo')}`)
  }

  // Cobre tanto o 1º envio quanto o reenvio depois de "pedir pra refazer" —
  // apaga o que tinha e grava o conjunto novo.
  await supabase
    .from('treinamento_respostas')
    .delete()
    .eq('consultor_id', user.id)
    .eq('modulo_id', modulo_id)

  const { error: erroRespostas } = await supabase.from('treinamento_respostas').insert(
    respostas.map((r) => ({
      consultor_id: user.id,
      modulo_id,
      pergunta_id: r.pergunta_id,
      opcao_id: r.opcao_id,
    }))
  )

  if (erroRespostas) {
    redirect(`/treinamento?error=${encodeURIComponent('Não foi possível enviar o quiz')}`)
  }

  const { error: erroProgresso } = await supabase.from('treinamento_progresso').upsert(
    { consultor_id: user.id, modulo_id, enviado_em: new Date().toISOString(), aprovado_por: null, aprovado_em: null },
    { onConflict: 'consultor_id,modulo_id' }
  )

  if (erroProgresso) {
    redirect(`/treinamento?error=${encodeURIComponent('Não foi possível enviar o quiz')}`)
  }

  revalidatePath('/treinamento')
  redirect('/treinamento')
}

export async function aprovarModulo(formData: FormData) {
  const supabase = await createClient()
  const { user, cargo, unidade_id } = await soGerencia(supabase)

  const consultor_id = formData.get('consultor_id') as string
  const modulo_id = formData.get('modulo_id') as string

  await confereUnidade(supabase, cargo, unidade_id, consultor_id)

  const { error } = await supabase
    .from('treinamento_progresso')
    .update({ aprovado_por: user.id, aprovado_em: new Date().toISOString() })
    .eq('consultor_id', consultor_id)
    .eq('modulo_id', modulo_id)

  if (error) {
    redirect(`/treinamento/${consultor_id}?error=${encodeURIComponent('Não foi possível aprovar')}`)
  }

  revalidatePath('/treinamento')
  revalidatePath(`/treinamento/${consultor_id}`)
  redirect(`/treinamento/${consultor_id}`)
}

export async function pedirRefazerModulo(formData: FormData) {
  const supabase = await createClient()
  const { cargo, unidade_id } = await soGerencia(supabase)

  const consultor_id = formData.get('consultor_id') as string
  const modulo_id = formData.get('modulo_id') as string

  await confereUnidade(supabase, cargo, unidade_id, consultor_id)

  const { error } = await supabase
    .from('treinamento_progresso')
    .update({ enviado_em: null, aprovado_por: null, aprovado_em: null })
    .eq('consultor_id', consultor_id)
    .eq('modulo_id', modulo_id)

  if (error) {
    redirect(`/treinamento/${consultor_id}?error=${encodeURIComponent('Não foi possível atualizar')}`)
  }

  revalidatePath('/treinamento')
  revalidatePath(`/treinamento/${consultor_id}`)
  redirect(`/treinamento/${consultor_id}`)
}
