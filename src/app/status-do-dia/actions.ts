'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function aprovarConsultorDia(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const consultorId = formData.get('consultor_id') as string
  const data = formData.get('data') as string
  const unidadeId = formData.get('unidade_id') as string

  await supabase.from('aprovacoes_consultor_dia').upsert(
    {
      consultor_id: consultorId,
      data,
      status: 'aprovado',
      aprovado_por: user.id,
      aprovado_em: new Date().toISOString(),
    },
    { onConflict: 'consultor_id,data' }
  )

  revalidatePath(`/status-do-dia/${unidadeId}`)
}

export async function aprovarDiaUnidade(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const unidadeId = formData.get('unidade_id') as string
  const data = formData.get('data') as string

  await supabase.from('aprovacoes_dia').upsert(
    {
      unidade_id: unidadeId,
      data,
      status: 'aprovado',
      aprovado_por: user.id,
      aprovado_em: new Date().toISOString(),
    },
    { onConflict: 'unidade_id,data' }
  )

  revalidatePath('/status-do-dia')
  revalidatePath(`/status-do-dia/${unidadeId}`)
}
