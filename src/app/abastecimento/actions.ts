'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireEditor() {
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

  // Quem define o dia de abastecimento: a Luciana (pos_venda, quem cuida
  // disso de fato) e o admin.
  if (profile?.cargo !== 'pos_venda' && profile?.cargo !== 'admin') redirect('/abastecimento')

  return supabase
}

export async function salvarDiaAbastecimento(formData: FormData) {
  const supabase = await requireEditor()

  const unidade_id = formData.get('unidade_id') as string
  const dia_semana = Number(formData.get('dia_semana'))

  if (!unidade_id || Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
    redirect(`/abastecimento?error=${encodeURIComponent('Escolha um dia da semana válido')}`)
  }

  const { error } = await supabase
    .from('abastecimento_config')
    .upsert({ unidade_id, dia_semana, updated_at: new Date().toISOString() })

  if (error) {
    redirect(`/abastecimento?error=${encodeURIComponent('Não foi possível salvar')}`)
  }

  revalidatePath('/abastecimento')
  redirect('/abastecimento')
}
