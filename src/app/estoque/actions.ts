'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function veiculoFields(formData: FormData) {
  const marca = (formData.get('marca') as string)?.trim()
  const modelo = (formData.get('modelo') as string)?.trim()
  const cambio = formData.get('cambio') as string
  const cor = (formData.get('cor') as string)?.trim() || null
  const ano = (formData.get('ano') as string)?.trim() || null
  const placa = (formData.get('placa') as string)?.trim().toUpperCase() || null
  const status = formData.get('status') as string
  const unidade_id = formData.get('unidade_id') as string
  const observacao = (formData.get('observacao') as string)?.trim() || null

  const gnv = formData.get('gnv') === 'sim'
  const no_site = formData.get('no_site') === 'sim'

  const blindadoRaw = formData.get('blindado') as string
  const blindado = blindadoRaw === 'sim' ? true : blindadoRaw === 'nao' ? false : null

  const licenciadoAteRaw = formData.get('licenciado_ate') as string
  const licenciado_ate = licenciadoAteRaw ? Number(licenciadoAteRaw) : null

  return {
    marca,
    modelo,
    cambio,
    cor,
    ano,
    placa,
    status,
    unidade_id,
    observacao,
    gnv,
    no_site,
    blindado,
    licenciado_ate,
  }
}

export async function createVeiculo(formData: FormData) {
  const supabase = await createClient()
  const fields = veiculoFields(formData)

  if (!fields.marca || !fields.modelo || !fields.cambio || !fields.unidade_id) {
    redirect(`/estoque/new?error=${encodeURIComponent('Preencha marca, modelo, câmbio e unidade')}`)
  }

  const { error } = await supabase.from('veiculos').insert(fields)

  if (error) {
    const message = error.code === '23505' ? 'Já existe um veículo com essa placa' : 'Não foi possível salvar o veículo'
    redirect(`/estoque/new?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/estoque')
  redirect('/estoque')
}

export async function updateVeiculo(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const fields = veiculoFields(formData)

  if (!fields.marca || !fields.modelo || !fields.cambio || !fields.unidade_id) {
    redirect(`/estoque/${id}?error=${encodeURIComponent('Preencha marca, modelo, câmbio e unidade')}`)
  }

  const { error } = await supabase
    .from('veiculos')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    const message = error.code === '23505' ? 'Já existe um veículo com essa placa' : 'Não foi possível salvar o veículo'
    redirect(`/estoque/${id}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/estoque')
  revalidatePath(`/estoque/${id}`)
  redirect('/estoque')
}

export async function deleteVeiculo(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('veiculos').delete().eq('id', id)

  if (error) {
    redirect(`/estoque?error=${encodeURIComponent('Não foi possível remover o veículo')}`)
  }

  revalidatePath('/estoque')
  redirect('/estoque')
}
