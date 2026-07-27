'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function voltar(unidadeId: string, data: string, erro?: string) {
  const qs = new URLSearchParams({ unidade: unidadeId, data })
  if (erro) qs.set('error', erro)
  redirect(`/rotina?${qs.toString()}`)
}

export async function marcarItem(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const itemId = formData.get('item_id') as string
  const data = formData.get('data') as string
  const unidadeId = formData.get('unidade_id') as string

  const { error } = await supabase.from('rotina_marcacoes').insert({
    item_id: itemId,
    data,
    marcado_por: user!.id,
  })

  if (error) {
    // 23505 = unique (item_id, data): alguém da loja marcou no mesmo instante.
    // Não é erro pro usuário — o item já está feito, que é o que ele queria.
    const jaMarcado = error.code === '23505'
    if (!jaMarcado) {
      voltar(unidadeId, data, 'Não foi possível marcar a tarefa')
    }
  }

  revalidatePath('/rotina')
  voltar(unidadeId, data)
}

export async function desmarcarItem(formData: FormData) {
  const supabase = await createClient()

  const itemId = formData.get('item_id') as string
  const data = formData.get('data') as string
  const unidadeId = formData.get('unidade_id') as string

  const { error } = await supabase
    .from('rotina_marcacoes')
    .delete()
    .eq('item_id', itemId)
    .eq('data', data)

  if (error) {
    voltar(unidadeId, data, 'Não foi possível desmarcar a tarefa')
  }

  revalidatePath('/rotina')
  voltar(unidadeId, data)
}
