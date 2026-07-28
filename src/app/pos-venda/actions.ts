'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { addMonthsISO } from '@/lib/business-days'

type OrigemVenda = {
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  veiculo_km: string | null
  unidade_id: string | null
  consultor_id: string | null
}

function texto(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null
}

// Monta os campos do registro. Se veio uma venda de origem (ordem_id), puxa
// cliente/veículo/unidade/consultor dela — os campos manuais do formulário são
// ignorados. Sem ordem, usa o que foi digitado à mão.
async function buildFields(formData: FormData) {
  const supabase = await createClient()
  const ordem_id = texto(formData, 'ordem_id')

  let origem: OrigemVenda | null = null
  if (ordem_id) {
    const { data } = await supabase
      .from('ordens_servico')
      .select('cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, veiculo_km, unidade_id, consultor_id')
      .eq('id', ordem_id)
      .single<OrigemVenda>()
    origem = data
  }

  // "Fim do pós-venda" nunca é digitado — é sempre 3 meses depois da entrega.
  const entrega_em = texto(formData, 'entrega_em')

  return {
    ordem_id,
    cliente_nome: origem?.cliente_nome ?? texto(formData, 'cliente_nome'),
    veiculo_marca: origem?.veiculo_marca ?? texto(formData, 'veiculo_marca'),
    veiculo_modelo: origem?.veiculo_modelo ?? texto(formData, 'veiculo_modelo'),
    veiculo_placa: origem?.veiculo_placa ?? texto(formData, 'veiculo_placa'),
    veiculo_km: origem?.veiculo_km ?? null,
    unidade_id: origem?.unidade_id ?? null,
    consultor_id: origem?.consultor_id ?? null,
    status: (formData.get('status') as string) || 'aberto',
    entrega_em,
    revisao_em: entrega_em ? addMonthsISO(entrega_em, 3) : null,
    prestador: texto(formData, 'prestador'),
    anotacoes: texto(formData, 'anotacoes'),
  }
}

export async function createPosVenda(formData: FormData) {
  const supabase = await createClient()
  const fields = await buildFields(formData)

  if (!fields.cliente_nome || !fields.veiculo_marca || !fields.veiculo_modelo) {
    redirect(
      `/pos-venda/new?error=${encodeURIComponent('Escolha uma venda ou preencha cliente, marca e modelo')}`
    )
  }

  const { error } = await supabase.from('pos_venda').insert(fields)

  if (error) {
    redirect(`/pos-venda/new?error=${encodeURIComponent('Não foi possível salvar o registro')}`)
  }

  revalidatePath('/pos-venda')
  redirect('/pos-venda')
}

export async function updatePosVenda(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const fields = await buildFields(formData)

  const { error } = await supabase
    .from('pos_venda')
    .update({
      status: fields.status,
      entrega_em: fields.entrega_em,
      revisao_em: fields.revisao_em,
      prestador: fields.prestador,
      anotacoes: fields.anotacoes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    redirect(`/pos-venda/${id}?error=${encodeURIComponent('Não foi possível salvar o registro')}`)
  }

  revalidatePath('/pos-venda')
  revalidatePath(`/pos-venda/${id}`)
  redirect('/pos-venda')
}

export async function deletePosVenda(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('pos_venda').delete().eq('id', id)

  if (error) {
    redirect(`/pos-venda?error=${encodeURIComponent('Não foi possível remover o registro')}`)
  }

  revalidatePath('/pos-venda')
  redirect('/pos-venda')
}

// ── Itens de manutenção do Pós-venda ────────────────────────────────────
// A lista nasce dos tópicos que o consultor lançou na Ordem de Serviço
// (ver aprovarOrdem em src/app/ordens/actions.ts); a Luciana marca "feito",
// diz o local, e também pode adicionar item novo direto por aqui.

export async function adicionarItemPosVenda(formData: FormData) {
  const supabase = await createClient()
  const pos_venda_id = formData.get('pos_venda_id') as string
  const descricao = texto(formData, 'descricao')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!descricao) {
    redirect(`/pos-venda/${pos_venda_id}?error=${encodeURIComponent('Digite o serviço antes de adicionar')}`)
  }

  const { count } = await supabase
    .from('pos_venda_itens')
    .select('id', { count: 'exact', head: true })
    .eq('pos_venda_id', pos_venda_id)

  const { error } = await supabase.from('pos_venda_itens').insert({
    pos_venda_id,
    descricao,
    posicao: count ?? 0,
    criado_por: user?.id ?? null,
  })

  if (error) {
    redirect(`/pos-venda/${pos_venda_id}?error=${encodeURIComponent('Não foi possível adicionar o item')}`)
  }

  revalidatePath(`/pos-venda/${pos_venda_id}`)
  redirect(`/pos-venda/${pos_venda_id}`)
}

export async function atualizarItemPosVenda(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const pos_venda_id = formData.get('pos_venda_id') as string
  const feito = formData.get('feito') === 'on'
  const local = texto(formData, 'local')

  const { error } = await supabase
    .from('pos_venda_itens')
    .update({ feito, local, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    redirect(`/pos-venda/${pos_venda_id}?error=${encodeURIComponent('Não foi possível salvar o item')}`)
  }

  revalidatePath(`/pos-venda/${pos_venda_id}`)
  redirect(`/pos-venda/${pos_venda_id}`)
}

export async function excluirItemPosVenda(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const pos_venda_id = formData.get('pos_venda_id') as string

  const { error } = await supabase.from('pos_venda_itens').delete().eq('id', id)

  if (error) {
    redirect(`/pos-venda/${pos_venda_id}?error=${encodeURIComponent('Não foi possível excluir o item')}`)
  }

  revalidatePath(`/pos-venda/${pos_venda_id}`)
  redirect(`/pos-venda/${pos_venda_id}`)
}
