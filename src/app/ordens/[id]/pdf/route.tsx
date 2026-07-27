import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { OrdemPdfDocument, type OrdemPdfData } from './OrdemPdfDocument'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ?previa=1: a "prévia" da OS (documento preenchido no formato de impressão)
  // que o consultor vê antes de aprovar/assinar. Sem esse modo, o PDF oficial só
  // sai depois da assinatura da gerência.
  const previa = new URL(request.url).searchParams.get('previa') === '1'
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Não autorizado', { status: 401 })
  }

  const { data: ordem } = await supabase
    .from('ordens_servico')
    .select(
      `tipo, origem_cliente, numero_venda, retorno,
       cliente_nome, cliente_cpf_cnpj, cliente_rg, cliente_cep, cliente_numero, cliente_endereco, cliente_celular, cliente_email,
       veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, veiculo_cor, veiculo_km, manutencao, observacao,
       valor_total, desconto, tem_troca, troca_marca, troca_modelo, troca_ano, troca_placa,
       troca_valor_avaliado, troca_divida, troca_valor_liquido, valor_financiado, financeira,
       falta_receber, data_venda, data_entrega, aprovado_em,
       assinatura_gerencia_data_url, assinatura_gerencia_nome, assinado_em,
       unidades(nome), vendedor:profiles!ordens_servico_consultor_id_fkey(nome), aprovador:profiles!ordens_servico_aprovado_por_fkey(nome)`
    )
    .eq('id', id)
    .single<OrdemPdfData>()

  if (!ordem) {
    return new Response('Ordem não encontrada', { status: 404 })
  }

  // O PDF oficial exige a assinatura (automática) da gerência; a prévia não.
  if (!previa && !ordem.assinado_em) {
    return new Response('PDF disponível só depois de aprovada e assinada pela gerência', {
      status: 409,
    })
  }

  const [{ data: pagamentos }, { data: trocas }] = await Promise.all([
    supabase.from('ordens_servico_pagamentos').select('forma, valor').eq('ordem_id', id),
    supabase
      .from('ordens_servico_trocas')
      .select('marca, modelo, ano, placa, valor_avaliado, divida, valor_liquido')
      .eq('ordem_id', id)
      .order('created_at'),
  ])

  const buffer = await renderToBuffer(
    <OrdemPdfDocument ordem={ordem} pagamentos={pagamentos ?? []} trocas={trocas ?? []} />
  )

  const nome = previa ? `previa-ordem-${id.slice(0, 8)}` : `ordem-${id.slice(0, 8)}`
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nome}.pdf"`,
    },
  })
}
