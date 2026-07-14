import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { OrdemPdfDocument, type OrdemPdfData } from './OrdemPdfDocument'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
      `tipo, cliente_nome, cliente_cpf_cnpj, cliente_rg, cliente_endereco, cliente_celular, cliente_email,
       veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, veiculo_cor,
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

  if (!ordem.assinatura_gerencia_data_url) {
    return new Response('PDF disponível só depois de aprovada e assinada pela gerência', {
      status: 409,
    })
  }

  const { data: pagamentos } = await supabase
    .from('ordens_servico_pagamentos')
    .select('forma, valor')
    .eq('ordem_id', id)

  const buffer = await renderToBuffer(
    <OrdemPdfDocument ordem={ordem} pagamentos={pagamentos ?? []} />
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="ordem-${id.slice(0, 8)}.pdf"`,
    },
  })
}
