'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseBRL } from '@/lib/mask'

type SupaClient = Awaited<ReturnType<typeof createClient>>

// Toda escrita em despesas é só de quem tem a flag ve_despesas — a RLS já
// barra, isso aqui é só pra não deixar chegar no insert/delete achando que
// vai funcionar e levar um erro genérico do banco.
async function soVeDespesas(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase
    .from('profiles')
    .select('ve_despesas')
    .eq('id', user.id)
    .single<{ ve_despesas: boolean }>()
  if (!p?.ve_despesas) redirect('/')
  return user
}

export async function createDespesa(formData: FormData) {
  const supabase = await createClient()
  const user = await soVeDespesas(supabase)

  const unidade_id = (formData.get('unidade_id') as string) || null
  const categoria = formData.get('categoria') as string
  const descricao = (formData.get('descricao') as string)?.trim() || null
  const valor = parseBRL((formData.get('valor') as string) ?? '')
  const competenciaRaw = (formData.get('competencia') as string) || ''

  if (!categoria || !competenciaRaw) {
    redirect(`/despesas/new?error=${encodeURIComponent('Preencha categoria e competência')}`)
  }

  if (valor < 0) {
    redirect(`/despesas/new?error=${encodeURIComponent('O valor não pode ser negativo')}`)
  }

  const { error } = await supabase.from('despesas').insert({
    unidade_id,
    categoria,
    descricao,
    valor,
    competencia: `${competenciaRaw}-01`,
    criado_por: user.id,
  })

  if (error) {
    redirect(`/despesas/new?error=${encodeURIComponent('Não foi possível lançar a despesa')}`)
  }

  revalidatePath('/despesas')
  redirect(`/despesas?mes=${competenciaRaw}`)
}

export async function deleteDespesa(formData: FormData) {
  const supabase = await createClient()
  await soVeDespesas(supabase)
  const id = formData.get('id') as string
  const mes = formData.get('mes') as string

  const { error } = await supabase.from('despesas').delete().eq('id', id)

  if (error) {
    redirect(`/despesas?mes=${mes}&error=${encodeURIComponent('Não foi possível excluir a despesa')}`)
  }

  revalidatePath('/despesas')
  redirect(`/despesas?mes=${mes}`)
}
