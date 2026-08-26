'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export async function atualizarVencimentoBoleto(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const vencimento = (formData.get('vencimento') as string) || null

  const { error } = await supabase.from('ordens_servico_pagamentos').update({ vencimento }).eq('id', id)

  if (error) {
    redirect(`/boletos?error=${encodeURIComponent('Não foi possível salvar o vencimento')}`)
  }

  revalidatePath('/boletos')
  redirect('/boletos')
}

export async function marcarBoletoPago(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase
    .from('ordens_servico_pagamentos')
    .update({ pago: true, pago_em: hojeISO() })
    .eq('id', id)

  if (error) {
    redirect(`/boletos?error=${encodeURIComponent('Não foi possível marcar como pago')}`)
  }

  revalidatePath('/boletos')
  redirect('/boletos')
}

export async function desmarcarBoletoPago(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase
    .from('ordens_servico_pagamentos')
    .update({ pago: false, pago_em: null })
    .eq('id', id)

  if (error) {
    redirect(`/boletos?error=${encodeURIComponent('Não foi possível desmarcar o pagamento')}`)
  }

  revalidatePath('/boletos')
  redirect('/boletos')
}
