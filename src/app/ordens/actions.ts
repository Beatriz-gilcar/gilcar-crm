'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addBusinessDaysISO } from '@/lib/business-days'
import { formaPagamentoLabel } from '@/lib/ordens'
import { parseBRL } from '@/lib/mask'
import { isGerenciaCargo } from '@/lib/membros'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Campos de moeda chegam mascarados em R$ ("70.000,00"); parseBRL devolve o número.
function money(formData: FormData, key: string): number {
  return parseBRL((formData.get(key) as string) ?? '')
}

function text(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null
}

type TrocaInput = {
  marca: string | null
  modelo: string | null
  ano: string | null
  placa: string | null
  valor_avaliado: number
  divida: number
  valor_liquido: number
}

// Lê a lista de trocas do campo escondido trocas_json (montado pelo OrdemForm).
function parseTrocas(formData: FormData): TrocaInput[] {
  const raw = (formData.get('trocas_json') as string) ?? ''
  if (!raw) return []
  let lista: unknown
  try {
    lista = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(lista)) return []
  return lista.map((t) => {
    const item = t as Record<string, string>
    const valor_avaliado = parseBRL(item.valor_avaliado ?? '')
    const divida = parseBRL(item.divida ?? '')
    return {
      marca: item.marca?.trim() || null,
      modelo: item.modelo?.trim() || null,
      ano: item.ano?.trim() || null,
      placa: item.placa?.trim().toUpperCase() || null,
      valor_avaliado,
      divida,
      valor_liquido: valor_avaliado - divida,
    }
  })
}

// Lê a lista de serviços de manutenção do campo escondido manutencao_itens_json
// (montado pelo OrdemForm) — um item por tópico digitado.
function parseManutencaoItens(formData: FormData): string[] {
  const raw = (formData.get('manutencao_itens_json') as string) ?? ''
  if (!raw) return []
  let lista: unknown
  try {
    lista = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(lista)) return []
  return lista.map((v) => String(v).trim()).filter(Boolean)
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
      .single<{ id: string; marca: string; modelo: string; ano: string | null; placa: string | null; cor: string | null }>()

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

  const valor_total = money(formData, 'valor_total')
  const desconto = money(formData, 'desconto')

  // Troca agora é lista (0..N veículos). Só vale em venda.
  const trocas = tipo === 'venda' ? parseTrocas(formData) : []
  const tem_troca = trocas.length > 0
  const somaTrocaAvaliado = trocas.reduce((acc, t) => acc + t.valor_avaliado, 0)
  const somaTrocaDivida = trocas.reduce((acc, t) => acc + t.divida, 0)
  const somaTrocaLiquido = trocas.reduce((acc, t) => acc + t.valor_liquido, 0)

  const valor_financiado = money(formData, 'valor_financiado')
  const financeira = valor_financiado > 0 ? text(formData, 'financeira') : null

  const pagamentos = Object.keys(formaPagamentoLabel)
    .map((forma) => ({ forma, valor: money(formData, `pagamento_${forma}`) }))
    .filter((p) => p.valor > 0)

  const somaPagamentos = pagamentos.reduce((acc, p) => acc + p.valor, 0)

  // Trava em 0: se o cliente paga a mais (pagamentos + financiamento > total),
  // "falta receber" fica quitado, não negativo. Saldo negativo não faz sentido
  // de negócio e ainda distorce o total de pendentes na tela de Ordens.
  const falta_receber = Math.max(
    0,
    valor_total - desconto - somaPagamentos - somaTrocaLiquido - valor_financiado
  )

  const data_venda = (formData.get('data_venda') as string) || new Date().toISOString().slice(0, 10)
  const data_entrega = addBusinessDaysISO(data_venda, 7)

  // Manutenção agora é lista de tópicos (um por linha no formulário). O texto
  // corrido continua existindo na coluna "manutencao" só como resumo pra
  // PDF/prévia — quem alimenta o Pós-venda de verdade é a lista em
  // ordens_servico_manutencao_itens (ver createOrdem/updateOrdem).
  const manutencaoItens = parseManutencaoItens(formData)

  return {
    valid: Boolean(tipo && unidade_id && cliente_nome && veiculo && valor_total > 0),
    manutencaoItens,
    fields: {
      tipo,
      unidade_id,
      origem_cliente: text(formData, 'origem_cliente'),
      numero_venda: text(formData, 'numero_venda'),
      retorno: text(formData, 'retorno'),
      cliente_nome,
      cliente_cpf_cnpj: text(formData, 'cliente_cpf_cnpj'),
      cliente_rg: text(formData, 'cliente_rg'),
      cliente_cep: text(formData, 'cliente_cep'),
      cliente_numero: text(formData, 'cliente_numero'),
      cliente_endereco: text(formData, 'cliente_endereco'),
      cliente_celular: text(formData, 'cliente_celular'),
      cliente_email: text(formData, 'cliente_email'),
      ...veiculo,
      veiculo_km: text(formData, 'veiculo_km'),
      manutencao: manutencaoItens.length ? manutencaoItens.join('\n') : null,
      observacao: text(formData, 'observacao'),
      valor_total,
      desconto,
      tem_troca,
      // Colunas legadas de troca única: guardam o agregado (para relatórios/telas
      // antigas). O detalhe veículo-a-veículo vive em ordens_servico_trocas.
      troca_marca: null,
      troca_modelo: null,
      troca_ano: null,
      troca_placa: null,
      troca_valor_avaliado: tem_troca ? somaTrocaAvaliado : null,
      troca_divida: tem_troca ? somaTrocaDivida : null,
      troca_valor_liquido: tem_troca ? somaTrocaLiquido : null,
      valor_financiado,
      financeira,
      falta_receber,
      data_venda,
      data_entrega,
    },
    pagamentos,
    trocas,
  }
}

export async function createOrdem(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { valid, fields, pagamentos, trocas, manutencaoItens } = await buildOrdemFields(supabase, formData)

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

  if (trocas.length > 0) {
    await supabase
      .from('ordens_servico_trocas')
      .insert(trocas.map((t) => ({ ...t, ordem_id: ordem!.id })))
  }

  if (manutencaoItens.length > 0) {
    await supabase.from('ordens_servico_manutencao_itens').insert(
      manutencaoItens.map((descricao, i) => ({ ordem_id: ordem!.id, descricao, posicao: i }))
    )
  }

  revalidatePath('/ordens')
  redirect(`/ordens/${ordem!.id}`)
}

export async function updateOrdem(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { valid, fields, pagamentos, trocas, manutencaoItens } = await buildOrdemFields(supabase, formData)

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

  await supabase.from('ordens_servico_trocas').delete().eq('ordem_id', id)
  if (trocas.length > 0) {
    await supabase
      .from('ordens_servico_trocas')
      .insert(trocas.map((t) => ({ ...t, ordem_id: id })))
  }

  await supabase.from('ordens_servico_manutencao_itens').delete().eq('ordem_id', id)
  if (manutencaoItens.length > 0) {
    await supabase.from('ordens_servico_manutencao_itens').insert(
      manutencaoItens.map((descricao, i) => ({ ordem_id: id, descricao, posicao: i }))
    )
  }

  revalidatePath('/ordens')
  revalidatePath(`/ordens/${id}`)
  redirect(`/ordens/${id}`)
}

type OrdemAprovadaResumo = {
  tipo: string
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  unidade_id: string
  manutencao: string | null
  data_entrega: string | null
}

export async function aprovarOrdem(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: ordem, error } = await supabase
    .from('ordens_servico')
    .update({ status: 'aprovada', aprovado_por: user?.id, aprovado_em: new Date().toISOString() })
    .eq('id', id)
    .select('tipo, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, unidade_id, manutencao, data_entrega')
    .single<OrdemAprovadaResumo>()

  if (error) {
    redirect(`/ordens/${id}?error=${encodeURIComponent('Não foi possível aprovar a ordem')}`)
  }

  // Venda aprovada já nasce no Pós-venda sozinha — a Luciana não precisa
  // recriar o registro do zero pra cada venda. Cada serviço de manutenção que
  // o consultor lançou como tópico vira um item pra ela marcar/dizer o local;
  // "anotacoes" guarda o mesmo texto corrido só como resumo de referência.
  // Usa o client admin (ignora RLS) porque só o cargo pos_venda pode escrever
  // nessa tabela, e quem aprova aqui é gerência/admin.
  if (ordem?.tipo === 'venda') {
    const admin = createAdminClient()
    const { data: existente } = await admin
      .from('pos_venda')
      .select('id')
      .eq('ordem_id', id)
      .maybeSingle<{ id: string }>()

    if (!existente) {
      const { data: posVenda } = await admin
        .from('pos_venda')
        .insert({
          ordem_id: id,
          unidade_id: ordem.unidade_id,
          cliente_nome: ordem.cliente_nome,
          veiculo_marca: ordem.veiculo_marca,
          veiculo_modelo: ordem.veiculo_modelo,
          veiculo_placa: ordem.veiculo_placa,
          status: 'aberto',
          entrega_em: ordem.data_entrega,
          anotacoes: ordem.manutencao,
        })
        .select('id')
        .single<{ id: string }>()

      const { data: itensManutencao } = await admin
        .from('ordens_servico_manutencao_itens')
        .select('descricao, posicao')
        .eq('ordem_id', id)
        .order('posicao')
        .overrideTypes<{ descricao: string; posicao: number }[]>()

      if (posVenda && itensManutencao && itensManutencao.length > 0) {
        await admin.from('pos_venda_itens').insert(
          itensManutencao.map((item) => ({
            pos_venda_id: posVenda.id,
            descricao: item.descricao,
            posicao: item.posicao,
          }))
        )
      }
    }
  }

  revalidatePath('/ordens')
  revalidatePath(`/ordens/${id}`)
  revalidatePath('/pos-venda')
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

// Assinatura automática: ao clicar em "Gerar PDF", registra a assinatura do
// gerente logado (nome + data/hora) — sem desenhar — e leva direto pro PDF.
export async function assinarOrdem(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', user.id)
    .single<{ nome: string }>()

  const { error } = await supabase
    .from('ordens_servico')
    .update({
      assinatura_gerencia_nome: profile?.nome ?? user.email,
      assinado_em: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    redirect(`/ordens/${id}?error=${encodeURIComponent('Não foi possível assinar a ordem')}`)
  }

  revalidatePath('/ordens')
  revalidatePath(`/ordens/${id}`)
  // Gera: abre o PDF já assinado.
  redirect(`/ordens/${id}/pdf`)
}

// Excluir ordem: só as REPROVADAS, e o gerente só as da própria unidade
// (admin exclui de qualquer unidade). Consultor não exclui.
export async function deleteOrdem(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: prof }, { data: ordem }] = await Promise.all([
    supabase.from('profiles').select('cargo, unidade_id').eq('id', user.id).single<{ cargo: string; unidade_id: string | null }>(),
    supabase.from('ordens_servico').select('status, unidade_id').eq('id', id).single<{ status: string; unidade_id: string }>(),
  ])

  const isAdmin = prof?.cargo === 'admin'
  const podeExcluir =
    ordem?.status === 'reprovada' &&
    (isAdmin || (isGerenciaCargo(prof?.cargo) && ordem?.unidade_id === prof?.unidade_id))

  if (!podeExcluir) {
    redirect(`/ordens/${id}?error=${encodeURIComponent('Só dá pra excluir ordem reprovada da sua unidade')}`)
  }

  const { error } = await supabase.from('ordens_servico').delete().eq('id', id)
  if (error) {
    redirect(`/ordens/${id}?error=${encodeURIComponent('Não foi possível excluir a ordem')}`)
  }

  revalidatePath('/ordens')
  redirect('/ordens')
}
