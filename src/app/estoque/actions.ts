'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ITENS_CONFERENCIA_PADRAO } from '@/lib/veiculos'
import { isGerenciaCargo } from '@/lib/membros'

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
// sino, som e notificação do navegador de graça. "Concluir" o lembrete abre
// o veículo, mas quem aceita de verdade é aceitarTransferenciaVeiculo — o
// carro fica travado (status aguardando_conferencia) até lá. Melhor
// esforço: se der erro aqui, não desfaz a transferência em si.
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

  const titulo = `Conferir recebimento: ${params.marca} ${params.modelo}${params.placa ? ` · ${params.placa}` : ''} — veio de ${unidadeOrigem?.nome ?? 'outra unidade'}`

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: veiculoAntes } = await supabase
    .from('veiculos')
    .select('unidade_id')
    .eq('id', id)
    .single<{ unidade_id: string }>()

  // Transferência entre unidades: o status pedido no form fica em espera
  // (vira aguardando_conferencia) até o gerente da unidade destino aceitar
  // — ver aceitarTransferenciaVeiculo.
  const ehTransferencia = Boolean(veiculoAntes) && veiculoAntes!.unidade_id !== fields.unidade_id
  const statusPedido = fields.status

  const { error } = await supabase
    .from('veiculos')
    .update({
      ...fields,
      status: ehTransferencia ? 'aguardando_conferencia' : fields.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    const message = error.code === '23505' ? 'Já existe um veículo com essa placa' : 'Não foi possível salvar o veículo'
    redirect(`/estoque/${id}?error=${encodeURIComponent(message)}`)
  }

  if (ehTransferencia && user) {
    const { error: transferenciaError } = await supabase.from('veiculos_transferencias').insert({
      veiculo_id: id,
      unidade_origem_id: veiculoAntes!.unidade_id,
      unidade_destino_id: fields.unidade_id,
      status_anterior: statusPedido,
      criado_por: user.id,
    })
    if (transferenciaError) {
      console.error('Falha ao registrar transferência pendente', transferenciaError)
    }

    await avisarTransferencia(supabase, {
      veiculoId: id,
      unidadeOrigemId: veiculoAntes!.unidade_id,
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

// Checklist de recebimento: só a gerência (gerente/supervisor/admin) da
// unidade DESTINO aceita — mesma regra da policy de
// veiculos_transferencias, checada aqui também (defesa em profundidade).
export async function aceitarTransferenciaVeiculo(formData: FormData) {
  const supabase = await createClient()
  const transferenciaId = formData.get('transferencia_id') as string
  const veiculoId = formData.get('veiculo_id') as string
  const observacao = (formData.get('observacao') as string)?.trim() || null
  const itensMarcados = new Set(formData.getAll('item_conferido').map(String))

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo, unidade_id')
    .eq('id', user.id)
    .single<{ cargo: string; unidade_id: string | null }>()

  const { data: transferencia } = await supabase
    .from('veiculos_transferencias')
    .select('unidade_destino_id, status_anterior, status')
    .eq('id', transferenciaId)
    .single<{ unidade_destino_id: string; status_anterior: string; status: string }>()

  const podeAceitar =
    transferencia &&
    transferencia.status === 'pendente' &&
    isGerenciaCargo(profile?.cargo) &&
    (profile?.cargo === 'admin' || profile?.unidade_id === transferencia.unidade_destino_id)

  if (!podeAceitar) {
    redirect(`/estoque/${veiculoId}?error=${encodeURIComponent('Você não pode aceitar essa transferência')}`)
  }

  const itensChecklist = ITENS_CONFERENCIA_PADRAO.map((item) => ({ item, conferido: itensMarcados.has(item) }))

  const { error: transferenciaError } = await supabase
    .from('veiculos_transferencias')
    .update({
      itens_checklist: itensChecklist,
      observacao,
      status: 'aceita',
      aceito_por: user.id,
      aceito_em: new Date().toISOString(),
    })
    .eq('id', transferenciaId)

  if (transferenciaError) {
    redirect(`/estoque/${veiculoId}?error=${encodeURIComponent('Não foi possível registrar o aceite')}`)
  }

  const { error: veiculoError } = await supabase
    .from('veiculos')
    .update({ status: transferencia!.status_anterior, updated_at: new Date().toISOString() })
    .eq('id', veiculoId)

  if (veiculoError) {
    redirect(`/estoque/${veiculoId}?error=${encodeURIComponent('Aceite salvo, mas não foi possível liberar o veículo')}`)
  }

  revalidatePath('/estoque')
  revalidatePath(`/estoque/${veiculoId}`)
  redirect(`/estoque/${veiculoId}`)
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
