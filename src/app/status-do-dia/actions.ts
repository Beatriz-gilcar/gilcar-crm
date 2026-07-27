'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Aprovar o consultor = aprovar a ficha dele naquele dia. A tabela
// aprovacoes_consultor_dia foi removida: fichas_diarias.status é a fonte única,
// e ainda cobre o estado "enviado", que a tabela antiga não tinha.
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

  const { error } = await supabase
    .from('fichas_diarias')
    .update({ status: 'aprovado', updated_at: new Date().toISOString() })
    .eq('consultor_id', consultorId)
    .eq('data', data)

  if (error) {
    redirect(
      `/status-do-dia/${unidadeId}?data=${data}&error=${encodeURIComponent('Não foi possível aprovar a ficha')}`
    )
  }

  revalidatePath(`/status-do-dia/${unidadeId}`)
  revalidatePath('/ficha')
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
