'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()

  if (profile?.cargo !== 'admin') redirect('/rotina')

  return supabase
}

export async function addItem(formData: FormData) {
  const supabase = await requireAdmin()

  const unidadeId = formData.get('unidade_id') as string
  const hora = (formData.get('hora') as string)?.trim()
  const tarefa = (formData.get('tarefa') as string)?.trim()
  const destaque = formData.get('destaque') === 'on'
  const voltar = `/rotina/editar?unidade=${unidadeId}`

  if (!hora || !tarefa) {
    redirect(`${voltar}&error=${encodeURIComponent('Preencha a hora e a tarefa')}`)
  }

  // A nova entra no fim da lista.
  const { data: ultima } = await supabase
    .from('rotina_itens')
    .select('ordem')
    .eq('unidade_id', unidadeId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle<{ ordem: number }>()

  const { error } = await supabase.from('rotina_itens').insert({
    unidade_id: unidadeId,
    ordem: (ultima?.ordem ?? -1) + 1,
    hora,
    tarefa,
    destaque,
  })

  if (error) {
    redirect(`${voltar}&error=${encodeURIComponent('Não foi possível adicionar a tarefa')}`)
  }

  revalidatePath('/rotina')
  redirect(voltar)
}

// Desativa em vez de apagar: a marcação aponta pro item com cascade, então
// excluir levaria junto o histórico de quem fez a tarefa e quando. Item
// inativo some da rotina do dia e o histórico fica de pé.
export async function desativarItem(formData: FormData) {
  const supabase = await requireAdmin()

  const id = formData.get('id') as string
  const unidadeId = formData.get('unidade_id') as string

  const { error } = await supabase.from('rotina_itens').update({ ativo: false }).eq('id', id)

  if (error) {
    redirect(`/rotina/editar?unidade=${unidadeId}&error=${encodeURIComponent('Não foi possível remover a tarefa')}`)
  }

  revalidatePath('/rotina')
  redirect(`/rotina/editar?unidade=${unidadeId}`)
}

export async function reativarItem(formData: FormData) {
  const supabase = await requireAdmin()

  const id = formData.get('id') as string
  const unidadeId = formData.get('unidade_id') as string

  await supabase.from('rotina_itens').update({ ativo: true }).eq('id', id)

  revalidatePath('/rotina')
  redirect(`/rotina/editar?unidade=${unidadeId}`)
}

// Copia a rotina de uma loja pra outra — as 3 unidades sem rotina começam da
// Cachamorra e ajustam, em vez de digitar 24 tarefas do zero.
export async function copiarDe(formData: FormData) {
  const supabase = await requireAdmin()

  const destinoId = formData.get('unidade_id') as string
  const origemId = formData.get('origem_id') as string
  const voltar = `/rotina/editar?unidade=${destinoId}`

  if (!origemId || origemId === destinoId) {
    redirect(`${voltar}&error=${encodeURIComponent('Escolha uma unidade diferente para copiar')}`)
  }

  const { data: origem } = await supabase
    .from('rotina_itens')
    .select('ordem, hora, tarefa, destaque')
    .eq('unidade_id', origemId)
    .eq('ativo', true)
    .order('ordem')
    .overrideTypes<{ ordem: number; hora: string; tarefa: string; destaque: boolean }[]>()

  if (!origem?.length) {
    redirect(`${voltar}&error=${encodeURIComponent('A unidade escolhida não tem rotina para copiar')}`)
  }

  const { data: existentes } = await supabase
    .from('rotina_itens')
    .select('id')
    .eq('unidade_id', destinoId)
    .limit(1)

  if (existentes?.length) {
    redirect(`${voltar}&error=${encodeURIComponent('Esta unidade já tem rotina — remova as tarefas antes de copiar')}`)
  }

  const { error } = await supabase.from('rotina_itens').insert(
    origem!.map((i) => ({ unidade_id: destinoId, ordem: i.ordem, hora: i.hora, tarefa: i.tarefa, destaque: i.destaque }))
  )

  if (error) {
    redirect(`${voltar}&error=${encodeURIComponent('Não foi possível copiar a rotina')}`)
  }

  revalidatePath('/rotina')
  redirect(voltar)
}
