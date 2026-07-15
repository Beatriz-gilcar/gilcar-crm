'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createTrato(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const consultor_id = (formData.get('consultor_id') as string) || user!.id
  const unidade_id = formData.get('unidade_id') as string
  const cliente_nome = (formData.get('cliente_nome') as string)?.trim()
  const celular = (formData.get('celular') as string)?.trim() || null
  const veiculo = (formData.get('veiculo') as string)?.trim() || null
  const combinado = (formData.get('combinado') as string)?.trim()
  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)
  const prazo = (formData.get('prazo') as string) || null
  const observacao = (formData.get('observacao') as string)?.trim() || null

  if (!unidade_id || !cliente_nome || !combinado) {
    redirect(`/tratos/new?error=${encodeURIComponent('Preencha cliente, unidade e o que foi combinado')}`)
  }

  const { error } = await supabase.from('tratos').insert({
    consultor_id,
    unidade_id,
    cliente_nome,
    celular,
    veiculo,
    combinado,
    data,
    prazo,
    observacao,
  })

  if (error) {
    redirect(`/tratos/new?error=${encodeURIComponent('Não foi possível salvar o trato')}`)
  }

  revalidatePath('/tratos')
  redirect('/tratos')
}

export async function marcarStatusTrato(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const status = formData.get('status') as string

  const { error } = await supabase.from('tratos').update({ status }).eq('id', id)

  if (error) {
    redirect(`/tratos?error=${encodeURIComponent('Não foi possível atualizar o trato')}`)
  }

  revalidatePath('/tratos')
  redirect('/tratos')
}

export async function deleteTrato(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('tratos').delete().eq('id', id)

  if (error) {
    redirect(`/tratos?error=${encodeURIComponent('Não foi possível excluir o trato')}`)
  }

  revalidatePath('/tratos')
  redirect('/tratos')
}
