'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { addBusinessDaysISO } from '@/lib/business-days'
import { formaPagamentoLabel } from '@/lib/ordens'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function num(formData: FormData, key: string): number {
  const raw = (formData.get(key) as string)?.trim()
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

function text(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null
}

async function resolveVeiculo(supabase: SupabaseServerClient, formData: FormData) {
  const fonte = formData.get('veiculo_fonte') as string

  if (fonte === 'estoque') {
    const veiculoId = formData.get('veiculo_id') as string
    if (!veiculoId) return null

    const { data } = await supabase
      .from('veiculos')
      .select('id, marca, modelo, ano, placa, cor')
      .eq('id', veiculoId)
      .single<{ id: string; marca: string; modelo: string; ano: string | null; placa: string; cor: string | null }>()

    if (!data) return null

    return {
      veiculo_id: data.id,
      veiculo_marca: data.marca,
      veiculo_modelo: data.modelo,
      veiculo_ano: data.ano,
      veiculo_placa: data.placa,
      veiculo_cor: data.cor,
    }
  }

  const marca = text(formData, 'veiculo_marca_manual')
  const modelo = text(formData, 'veiculo_modelo_manual')
  if (!marca || !modelo) return null

  return {
    veiculo_id: null,
    veiculo_marca: marca,
    veiculo_modelo: modelo,
    veiculo_ano: text(formData, 'veiculo_ano_manual'),
    veiculo_placa: text(formData, 'veiculo_placa_manual')?.toUpperCase() ?? null,
    veiculo_cor: text(formData, 'veiculo_cor_manual'),
  }
}

async function buildOrdemFields(supabase: SupabaseServerClient, formData: FormData) {
  const tipo = formData.get('tipo') as string
  const unidade_id = formData.get('unidade_id') as string
  const cliente_nome = text(formData, 'cliente_nome')

  const veiculo = await resolveVeiculo(supabase, formData)

  const valor_total = num(formData, 'valor_total')
  const desconto = num(formData, 'desconto')

  const temTrocaRaw = formData.get('tem_troca') as string
  const tem_troca = tipo === 'venda' && temTrocaRaw === 'sim'

  const troca_valor_avaliado = tem_troca ? num(formData, 'troca_valor_avaliado') : null
  const troca_divida = tem_troca ? num(formData, 'troca_divida') : null
  const troca_valor_liquido = tem_troca ? (troca_valor_avaliado ?? 0) - (troca_divida ?? 0) : null

  const valor_financiado = num(formData, 'valor_financiado')
  const financeira = valor_financiado > 0 ? text(formData, 'financeira') : null

  const pagamentos = Object.keys(formaPagamentoLabel)
    .map((forma) => ({ forma, valor: num(formData, `pagamento_${forma}`) }))
    .filter((p) => p.valor > 0)

  const somaPagamentos = pagamentos.reduce((acc, p) => acc + p.valor, 0)

  const falta_receber =
    valor_total - desconto - somaPagamentos - (troca_valor_liquido ?? 0) - valor_financiado

  const data_venda = (formData.get('data_venda') as string) || new Date().toISOString().slice(0, 10)
  const data_entrega = addBusinessDaysISO(data_venda, 7)

  return {
    valid: Boolean(tipo && unidade_id && cliente_nome && veiculo && valor_total > 0),
    fields: {
      tipo,
      unidade_id,
      cliente_nome,
      cliente_cpf_cnpj: text(formData, 'cliente_cpf_cnpj'),
      cliente_rg: text(formData, 'cliente_rg'),
      cliente_endereco: text(formData, 'cliente_endereco'),
      cliente_celular: text(formData, 'cliente_celular'),
      cliente_email: text(formData, 'cliente_email'),
      ...veiculo,
      valor_total,
      desconto,
      tem_troca,
      troca_marca: tem_troca ? text(formData, 'troca_marca') : null,
      troca_modelo: tem_troca ? text(formData, 'troca_modelo') : null,
      troca_ano: tem_troca ? text(formData, 'troca_ano') : null,
      troca_placa: tem_troca ? text(formData, 'troca_placa')?.toUpperCase() ?? null : null,
      troca_valor_avaliado,
      troca_divida,
      troca_valor_liquido,
      valor_financiado,
      financeira,
      falta_receber,
      data_venda,
      data_entrega,
    },
    pagamentos,
  }
}

export async function createOrdem(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { valid, fields, pagamentos } = await buildOrdemFields(supabase, formData)

  if (!valid) {
    redirect(`/ordens/new?error=${encodeURIComponent('Preencha comprador/vendedor, veículo, unidade e valor total')}`)
  }

  const { data: ordem, error } = await supabase
    .from('ordens_servico')
    .insert({ ...fields, consultor_id: user!.id })
    .select('id')
    .single<{ id: string }>()

  if (error || !ordem) {
    redirect(`/ordens/new?error=${encodeURIComponent('Não foi possível salvar a ordem de serviço')}`)
  }

  if (pagamentos.length > 0) {
    await supabase
      .from('ordens_servico_pagamentos')
      .insert(pagamentos.map((p) => ({ ordem_id: ordem!.id, forma: p.forma, valor: p.valor })))
  }

  revalidatePath('/ordens')
  redirect(`/ordens/${ordem!.id}`)
}

export async function updateOrdem(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { valid, fields, pagamentos } = await buildOrdemFields(supabase, formData)

  if (!valid) {
    redirect(`/ordens/${id}?error=${encodeURIComponent('Preencha comprador/vendedor, veículo, unidade e valor total')}`)
  }

  const { error } = await supabase
    .from('ordens_servico')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    redirect(`/ordens/${id}?error=${encodeURIComponent('Não foi possível salvar a ordem de serviço')}`)
  }

  await supabase.from('ordens_servico_pagamentos').delete().eq('ordem_id', id)
  if (pagamentos.length > 0) {
    await supabase
      .from('ordens_servico_pagamentos')
      .insert(pagamentos.map((p) => ({ ordem_id: id, forma: p.forma, valor: p.valor })))
  }

  revalidatePath('/ordens')
  revalidatePath(`/ordens/${id}`)
  redirect(`/ordens/${id}`)
}

export async function aprovarOrdem(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('ordens_servico')
    .update({ status: 'aprovada', aprovado_por: user?.id, aprovado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    redirect(`/ordens/${id}?error=${encodeURIComponent('Não foi possível aprovar a ordem')}`)
  }

  revalidatePath('/ordens')
  revalidatePath(`/ordens/${id}`)
  redirect(`/ordens/${id}`)
}

export async function reprovarOrdem(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const motivo = text(formData, 'motivo_reprovacao')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('ordens_servico')
    .update({
      status: 'reprovada',
      aprovado_por: user?.id,
      aprovado_em: new Date().toISOString(),
      motivo_reprovacao: motivo,
    })
    .eq('id', id)

  if (error) {
    redirect(`/ordens/${id}?error=${encodeURIComponent('Não foi possível reprovar a ordem')}`)
  }

  revalidatePath('/ordens')
  revalidatePath(`/ordens/${id}`)
  redirect(`/ordens/${id}`)
}
