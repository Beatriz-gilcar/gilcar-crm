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

// Transferência entre unidades: avisa a gerência (gerente/supervisor ativos)
// da unidade de DESTINO via o sistema de Lembretes já existente — reaproveita
// sino, som e notificação do navegador de graça. "Concluir" o lembrete já
// funciona como o aceite; não bloqueia nada no veículo (ele já entra
// disponível na unidade nova), é só um aviso. Melhor esforço: se der erro
// aqui, não desfaz a transferência em si.
async function avisarTransferencia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { veiculoId: string; unidadeOrigemId: string; unidadeDestinoId: string; marca: string; modelo: string; placa: string | null }
) {
  const { data: unidadeOrigem } = await supabase
    .from('unidades')
    .select('nome')
    .eq('id', params.unidadeOrigemId)
    .single<{ nome: string }>()

  const { data: gerentesDestino } = await supabase
    .from('profiles')
    .select('id')
    .eq('unidade_id', params.unidadeDestinoId)
    .in('cargo', ['gerente', 'supervisor'])
    .eq('ativo', true)
    .overrideTypes<{ id: string }[]>()

  if (!gerentesDestino || gerentesDestino.length === 0) return

  const titulo = `Confirmar recebimento: ${params.marca} ${params.modelo}${params.placa ? ` · ${params.placa}` : ''} — veio de ${unidadeOrigem?.nome ?? 'outra unidade'}`

  const { error } = await supabase.from('lembretes').insert(
    gerentesDestino.map((g) => ({
      titulo,
      data_vencimento: new Date().toISOString(),
      consultor_id: g.id,
    }))
  )
  if (error) {
    console.error('Falha ao avisar transferência de veículo', error)
  }
}

export async function updateVeiculo(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const fields = veiculoFields(formData)

  if (!fields.marca || !fields.modelo || !fields.cambio || !fields.unidade_id) {
    redirect(`/estoque/${id}?error=${encodeURIComponent('Preencha marca, modelo, câmbio e unidade')}`)
  }

  const { data: veiculoAntes } = await supabase
    .from('veiculos')
    .select('unidade_id')
    .eq('id', id)
    .single<{ unidade_id: string }>()

  const { error } = await supabase
    .from('veiculos')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    const message = error.code === '23505' ? 'Já existe um veículo com essa placa' : 'Não foi possível salvar o veículo'
    redirect(`/estoque/${id}?error=${encodeURIComponent(message)}`)
  }

  if (veiculoAntes && veiculoAntes.unidade_id !== fields.unidade_id) {
    await avisarTransferencia(supabase, {
      veiculoId: id,
      unidadeOrigemId: veiculoAntes.unidade_id,
      unidadeDestinoId: fields.unidade_id,
      marca: fields.marca,
      modelo: fields.modelo,
      placa: fields.placa,
    })
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
