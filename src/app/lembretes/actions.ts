'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createLembrete(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const titulo = (formData.get('titulo') as string)?.trim()
  const descricao = (formData.get('descricao') as string)?.trim() || null
  const categoriaId = (formData.get('categoria_id') as string) || null
  const dataVencimento = (formData.get('data_vencimento') as string) || null
  const clienteId = (formData.get('cliente_id') as string) || null
  const voltarPara = clienteId ? `/leads/${clienteId}` : '/lembretes'

  if (!titulo) {
    redirect(`${voltarPara}?error=${encodeURIComponent('Informe o título do lembrete')}`)
  }

  const { error } = await supabase.from('lembretes').insert({
    titulo,
    descricao,
    categoria_id: categoriaId,
    data_vencimento: dataVencimento,
    cliente_id: clienteId,
    consultor_id: user.id,
  })

  if (error) {
    redirect(`${voltarPara}?error=${encodeURIComponent('Não foi possível salvar o lembrete')}`)
  }

  revalidatePath(voltarPara)
  redirect(voltarPara)
}

export async function toggleLembrete(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const estavaConcluido = formData.get('concluido') === 'true'
  const clienteId = (formData.get('cliente_id') as string) || null

  await supabase
    .from('lembretes')
    .update({
      concluido: !estavaConcluido,
      concluido_em: !estavaConcluido ? new Date().toISOString() : null,
    })
    .eq('id', id)

  revalidatePath('/lembretes')
  if (clienteId) {
    revalidatePath(`/leads/${clienteId}`)
  }
}
