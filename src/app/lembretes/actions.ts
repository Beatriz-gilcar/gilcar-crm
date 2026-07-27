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
  // datetime-local chega como "YYYY-MM-DDTHH:MM" (horário local do Brasil).
  // Ancoramos em -03:00 pra gravar o instante certo em UTC.
  const rawVenc = (formData.get('data_vencimento') as string) || ''
  const dataVencimento = rawVenc
    ? new Date(`${rawVenc.length === 16 ? `${rawVenc}:00` : rawVenc}-03:00`).toISOString()
    : null
  const clienteId = (formData.get('cliente_id') as string) || null
  const voltarPara = '/lembretes'

  if (!titulo) {
    redirect(`${voltarPara}?error=${encodeURIComponent('Informe o título do lembrete')}`)
  }

  const { error } = await supabase.from('lembretes').insert({
    titulo,
    descricao,
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

  await supabase
    .from('lembretes')
    .update({
      concluido: !estavaConcluido,
      concluido_em: !estavaConcluido ? new Date().toISOString() : null,
    })
    .eq('id', id)

  revalidatePath('/lembretes')
}

export async function deleteLembrete(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  await supabase.from('lembretes').delete().eq('id', id)

  revalidatePath('/lembretes')
}
