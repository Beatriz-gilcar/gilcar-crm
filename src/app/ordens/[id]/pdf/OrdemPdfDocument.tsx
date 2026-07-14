import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { formaPagamentoLabel, formatBRL } from '@/lib/ordens'

export type OrdemPdfData = {
  tipo: string
  cliente_nome: string
  cliente_cpf_cnpj: string | null
  cliente_rg: string | null
  cliente_endereco: string | null
  cliente_celular: string | null
  cliente_email: string | null
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: string | null
  veiculo_placa: string | null
  veiculo_cor: string | null
  valor_total: number
  desconto: number
  tem_troca: boolean
  troca_marca: string | null
  troca_modelo: string | null
  troca_ano: string | null
  troca_placa: string | null
  troca_valor_avaliado: number | null
  troca_divida: number | null
  troca_valor_liquido: number | null
  valor_financiado: number
  financeira: string | null
  falta_receber: number
  data_venda: string
  data_entrega: string | null
  aprovado_em: string | null
  assinatura_gerencia_data_url: string
  assinatura_gerencia_nome: string
  assinado_em: string
  unidades: { nome: string } | null
  vendedor: { nome: string } | null
  aprovador: { nome: string } | null
}

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

function fmtDataHora(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

const styles = StyleSheet.create({
  page: { padding: 34, fontSize: 10, color: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#ff6f5e',
  },
  brand: { fontSize: 22, fontFamily: 'Helvetica-BoldOblique' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 8.5, color: '#666' },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#ff6f5e',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2.5 },
  label: { color: '#666' },
  value: { fontFamily: 'Helvetica-Bold' },
  totalBox: {
    marginTop: 6,
    padding: 10,
    backgroundColor: '#fdf1ef',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 9, color: '#8a4238' },
  totalValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#c0392b' },
  signatureArea: { marginTop: 26, alignItems: 'center' },
  signatureImg: { width: 170, height: 56, objectFit: 'contain' },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#999',
    width: 220,
    marginTop: 4,
    paddingTop: 4,
    alignItems: 'center',
  },
})

export function OrdemPdfDocument({
  ordem,
  pagamentos,
}: {
  ordem: OrdemPdfData
  pagamentos: { forma: string; valor: number }[]
}) {
  const isVenda = ordem.tipo === 'venda'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Gilcar</Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>
              Ordem de Serviço — {isVenda ? 'Venda' : 'Compra'}
            </Text>
            <Text style={styles.small}>
              {ordem.unidades?.nome ?? ''} · {fmtData(ordem.data_venda)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isVenda ? 'Comprador' : 'Vendedor'}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{ordem.cliente_nome}</Text>
          </View>
          {ordem.cliente_cpf_cnpj && (
            <View style={styles.row}>
              <Text style={styles.label}>CPF/CNPJ</Text>
              <Text>{ordem.cliente_cpf_cnpj}</Text>
            </View>
          )}
          {ordem.cliente_rg && (
            <View style={styles.row}>
              <Text style={styles.label}>RG</Text>
              <Text>{ordem.cliente_rg}</Text>
            </View>
          )}
          {ordem.cliente_celular && (
            <View style={styles.row}>
              <Text style={styles.label}>Celular</Text>
              <Text>{ordem.cliente_celular}</Text>
            </View>
          )}
          {ordem.cliente_email && (
            <View style={styles.row}>
              <Text style={styles.label}>E-mail</Text>
              <Text>{ordem.cliente_email}</Text>
            </View>
          )}
          {ordem.cliente_endereco && (
            <View style={styles.row}>
              <Text style={styles.label}>Endereço</Text>
              <Text>{ordem.cliente_endereco}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veículo</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Marca/Modelo</Text>
            <Text style={styles.value}>
              {ordem.veiculo_marca} {ordem.veiculo_modelo}
              {ordem.veiculo_ano ? ` · ${ordem.veiculo_ano}` : ''}
            </Text>
          </View>
          {ordem.veiculo_placa && (
            <View style={styles.row}>
              <Text style={styles.label}>Placa</Text>
              <Text>{ordem.veiculo_placa}</Text>
            </View>
          )}
          {ordem.veiculo_cor && (
            <View style={styles.row}>
              <Text style={styles.label}>Cor</Text>
              <Text>{ordem.veiculo_cor}</Text>
            </View>
          )}
        </View>

        {ordem.tem_troca && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Troca</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Marca/Modelo</Text>
              <Text style={styles.value}>
                {ordem.troca_marca} {ordem.troca_modelo}
                {ordem.troca_ano ? ` · ${ordem.troca_ano}` : ''}
                {ordem.troca_placa ? ` · ${ordem.troca_placa}` : ''}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Valor avaliado</Text>
              <Text>{formatBRL(ordem.troca_valor_avaliado ?? 0)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Dívida</Text>
              <Text>{formatBRL(ordem.troca_divida ?? 0)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Valor líquido</Text>
              <Text style={styles.value}>{formatBRL(ordem.troca_valor_liquido ?? 0)}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Valores</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Valor total</Text>
            <Text>{formatBRL(ordem.valor_total)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Desconto</Text>
            <Text>{formatBRL(ordem.desconto)}</Text>
          </View>
          {ordem.valor_financiado > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>
                Valor financiado{ordem.financeira ? ` (${ordem.financeira})` : ''}
              </Text>
              <Text>{formatBRL(ordem.valor_financiado)}</Text>
            </View>
          )}
          {pagamentos.map((p) => (
            <View style={styles.row} key={p.forma}>
              <Text style={styles.label}>{formaPagamentoLabel[p.forma] ?? p.forma}</Text>
              <Text>{formatBRL(p.valor)}</Text>
            </View>
          ))}
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>FALTA RECEBER</Text>
            <Text style={styles.totalValue}>{formatBRL(ordem.falta_receber)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datas</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Venda</Text>
            <Text>{fmtData(ordem.data_venda)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Entrega prevista</Text>
            <Text>{fmtData(ordem.data_entrega)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Aprovada em</Text>
            <Text>{fmtDataHora(ordem.aprovado_em)} · {ordem.aprovador?.nome ?? '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vendedor responsável</Text>
            <Text>{ordem.vendedor?.nome ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.signatureArea}>
          <Image src={ordem.assinatura_gerencia_data_url} style={styles.signatureImg} />
          <View style={styles.signatureLine}>
            <Text style={styles.value}>{ordem.assinatura_gerencia_nome}</Text>
            <Text style={styles.small}>Gerência responsável · {fmtDataHora(ordem.assinado_em)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
