'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function num(formData: FormData, key: string): number {
  const raw = (formData.get(key) as string)?.trim()
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export async function definirMetaPremiacao(formData: FormData) {
  const supabase = await createClient()

  const tipo = formData.get('tipo') as string
  const escopo = formData.get('escopo') as string
  const unidade_id = escopo === 'unidade' ? (formData.get('unidade_id') as string) : null
  const consultor_id = escopo === 'consultor' ? (formData.get('consultor_id') as string) : null
  const periodo = formData.get('periodo') as string
  const valor_meta = num(formData, 'valor_meta')
  const valor_super_meta_raw = (formData.get('valor_super_meta') as string)?.trim()
  const valor_super_meta = valor_super_meta_raw ? Number(valor_super_meta_raw) : null

  if (
    !tipo ||
    !escopo ||
    !periodo ||
    valor_meta <= 0 ||
    (escopo === 'unidade' && !unidade_id) ||
    (escopo === 'consultor' && !consultor_id)
  ) {
    redirect(`/premiacao/definir?error=${encodeURIComponent('Preencha escopo, período e valor da meta')}`)
  }

  let existingQuery = supabase.from('metas').select('id').eq('tipo', tipo).eq('escopo', escopo).eq('periodo', periodo)
  existingQuery = escopo === 'unidade' ? existingQuery.eq('unidade_id', unidade_id) : existingQuery
  existingQuery = escopo === 'consultor' ? existingQuery.eq('consultor_id', consultor_id) : existingQuery
  const { data: existing } = await existingQuery.maybeSingle<{ id: string }>()

  if (existing) {
    await supabase.from('metas').delete().eq('id', existing.id)
  }

  const { error } = await supabase.from('metas').insert({
    tipo,
    escopo,
    unidade_id,
    consultor_id,
    periodo,
    valor_meta,
    valor_super_meta,
  })

  if (error) {
    redirect(`/premiacao/definir?error=${encodeURIComponent('Não foi possível salvar a meta')}`)
  }

  revalidatePath('/premiacao')
  revalidatePath('/premiacao/definir')
  redirect(`/premiacao/definir?success=1`)
}
