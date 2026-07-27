import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { formaPagamentoLabel, formatBRL } from '@/lib/ordens'
import { GILCAR_LOGO } from '@/lib/logo'

export type OrdemPdfData = {
  tipo: string
  origem_cliente: string | null
  numero_venda: string | null
  retorno: string | null
  cliente_nome: string
  cliente_cpf_cnpj: string | null
  cliente_rg: string | null
  cliente_cep: string | null
  cliente_numero: string | null
  cliente_endereco: string | null
  cliente_celular: string | null
  cliente_email: string | null
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: string | null
  veiculo_placa: string | null
  veiculo_cor: string | null
  veiculo_km: string | null
  manutencao: string | null
  observacao: string | null
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
  // Nulos na prévia (antes de aprovar/assinar).
  assinatura_gerencia_data_url: string | null
  assinatura_gerencia_nome: string | null
  assinado_em: string | null
  unidades: { nome: string } | null
  vendedor: { nome: string } | null
  aprovador: { nome: string } | null
}

export type TrocaLinha = {
  marca: string | null
  modelo: string | null
  ano: string | null
  placa: string | null
  valor_avaliado: number
  divida: number
  valor_liquido: number
}

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, color: '#1a1a2e', fontFamily: 'Helvetica' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#ff6f5e',
  },
  logoBox: {
    backgroundColor: '#12121c',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoImg: { width: 104, height: 28, objectFit: 'contain' },
  headerFields: { flex: 1 },
  row: { flexDirection: 'row' },
  campo: { flex: 1, marginRight: 10, marginBottom: 6 },
  campoLabel: {
    fontSize: 6.5,
    color: '#8a8a8a',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  campoValue: {
    fontSize: 9.5,
    color: '#1a1a2e',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cccccc',
    paddingTop: 1.5,
    paddingBottom: 2,
  },
  secTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 6,
  },
  assRow: { flexDirection: 'row', marginTop: 22 },
  assItem: { flex: 1, marginHorizontal: 14, alignItems: 'center' },
  sigImg: { width: 150, height: 42, objectFit: 'contain', marginBottom: 1 },
  // Assinatura "digital": o nome do gerente em itálico (como no preview da tela).
  sigName: { fontFamily: 'Helvetica-Oblique', fontSize: 15, color: '#1a1a2e', marginBottom: 2 },
  assLine: { borderTopWidth: 0.8, borderTopColor: '#999999', width: '100%', paddingTop: 3, alignItems: 'center' },
  assLabel: { fontSize: 7, color: '#555555', textTransform: 'uppercase', letterSpacing: 0.3 },
  dashed: { borderTopWidth: 1, borderTopColor: '#999999', borderStyle: 'dashed', marginTop: 16, marginBottom: 2 },
  verse: { marginTop: 20, textAlign: 'center', fontSize: 7.5, color: '#888888', fontFamily: 'Helvetica-Oblique' },
})

function Campo({ label, value, flex = 1 }: { label: string; value: string | null | undefined; flex?: number }) {
  return (
    <View style={[styles.campo, { flex }]}>
      <Text style={styles.campoLabel}>{label}</Text>
      <Text style={styles.campoValue}>{value ? value : '—'}</Text>
    </View>
  )
}

export function OrdemPdfDocument({
  ordem,
  pagamentos,
  trocas = [],
}: {
  ordem: OrdemPdfData
  pagamentos: { forma: string; valor: number }[]
  trocas?: TrocaLinha[]
}) {
  const isVenda = ordem.tipo === 'venda'

  const trocasMostrar: TrocaLinha[] =
    trocas.length > 0
      ? trocas
      : ordem.tem_troca && (ordem.troca_valor_avaliado ?? 0) > 0
        ? [
            {
              marca: ordem.troca_marca,
              modelo: ordem.troca_modelo,
              ano: ordem.troca_ano,
              placa: ordem.troca_placa,
              valor_avaliado: ordem.troca_valor_avaliado ?? 0,
              divida: ordem.troca_divida ?? 0,
              valor_liquido: ordem.troca_valor_liquido ?? 0,
            },
          ]
        : []

  const formaPagamento = [
    ...pagamentos.map((p) => `${formaPagamentoLabel[p.forma] ?? p.forma}: ${formatBRL(p.valor)}`),
    ...(ordem.valor_financiado > 0 ? [`Financiado: ${formatBRL(ordem.valor_financiado)}`] : []),
    ...trocasMostrar.map(
      (t, i) => `Troca ${i + 1}: ${[t.marca, t.modelo].filter(Boolean).join(' ')} (líq. ${formatBRL(t.valor_liquido)})`
    ),
  ].join('   ·   ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Image src={GILCAR_LOGO} style={styles.logoImg} />
          </View>
          <View style={styles.headerFields}>
            <View style={styles.row}>
              <Campo label="Origem do cliente" value={ordem.origem_cliente} />
              <Campo label="Nº venda" value={ordem.numero_venda} />
              <Campo label="Retorno" value={ordem.retorno} />
            </View>
            <View style={styles.row}>
              <Campo label="Data venda" value={fmtData(ordem.data_venda)} />
              <Campo label="Data entrega" value={fmtData(ordem.data_entrega)} />
              <Campo label="Tipo" value={isVenda ? 'Venda' : 'Compra'} />
            </View>
          </View>
        </View>

        <Text style={styles.secTitle}>Pedido</Text>
        <View style={styles.row}>
          <Campo label={isVenda ? 'Vendedor' : 'Comprador'} value={ordem.vendedor?.nome} />
        </View>
        <View style={styles.row}>
          <Campo label={isVenda ? 'Comprador' : 'Vendedor'} value={ordem.cliente_nome} />
        </View>
        <View style={styles.row}>
          <Campo label="Endereço" value={ordem.cliente_endereco} flex={2} />
          <Campo label="Número" value={ordem.cliente_numero} />
          <Campo label="CEP" value={ordem.cliente_cep} />
        </View>
        <View style={styles.row}>
          <Campo label="Alienado a" value={ordem.financeira} />
          <Campo label="Valor financiado" value={ordem.valor_financiado > 0 ? formatBRL(ordem.valor_financiado) : '—'} />
          <Campo label="Celular" value={ordem.cliente_celular} />
        </View>
        <View style={styles.row}>
          <Campo label="CPF" value={ordem.cliente_cpf_cnpj} />
          <Campo label="RG" value={ordem.cliente_rg} />
          <Campo label="E-mail" value={ordem.cliente_email} />
        </View>

        <Text style={styles.secTitle}>Dados do Veículo</Text>
        <View style={styles.row}>
          <Campo label="Marca" value={ordem.veiculo_marca} />
          <Campo label="Modelo" value={ordem.veiculo_modelo} />
          <Campo label="Ano" value={ordem.veiculo_ano} />
        </View>
        <View style={styles.row}>
          <Campo label="Cor" value={ordem.veiculo_cor} />
          <Campo label="Placa" value={ordem.veiculo_placa} />
          <Campo label="KM" value={ordem.veiculo_km} />
        </View>
        <View style={styles.row}>
          <Campo label="Valor do veículo" value={formatBRL(ordem.valor_total)} />
        </View>
        <View style={styles.row}>
          <Campo label="Forma de pagamento" value={formaPagamento} />
        </View>
        <View style={styles.row}>
          <Campo label="Observações" value={ordem.observacao} />
        </View>

        <View style={styles.assRow}>
          <View style={styles.assItem}>
            {ordem.assinatura_gerencia_data_url ? (
              <Image src={ordem.assinatura_gerencia_data_url} style={styles.sigImg} />
            ) : ordem.assinado_em ? (
              <Text style={styles.sigName}>{ordem.assinatura_gerencia_nome ?? ''}</Text>
            ) : null}
            <View style={styles.assLine}>
              <Text style={styles.assLabel}>
                Ass. Gerência {ordem.assinado_em ? `· ${ordem.assinatura_gerencia_nome ?? ''}` : '___/___/___'}
              </Text>
            </View>
          </View>
          <View style={styles.assItem}>
            <View style={styles.assLine}>
              <Text style={styles.assLabel}>Ass. Direção ___/___/___</Text>
            </View>
          </View>
        </View>

        <View style={styles.dashed} />
        <Text style={styles.secTitle}>Manutenção — Pós-venda</Text>
        <View style={styles.row}>
          <Campo label="Carro" value={ordem.veiculo_marca} />
          <Campo label="Modelo" value={ordem.veiculo_modelo} />
          <Campo label="Ano" value={ordem.veiculo_ano} />
        </View>
        <View style={styles.row}>
          <Campo label="Placa" value={ordem.veiculo_placa} />
          <Campo label="Cor" value={ordem.veiculo_cor} />
          <Campo label="KM" value={ordem.veiculo_km} />
        </View>
        <View style={styles.row}>
          <Campo label="Data da venda" value={fmtData(ordem.data_venda)} />
          <Campo label="Data da entrega" value={fmtData(ordem.data_entrega)} />
        </View>
        <View style={styles.row}>
          <Campo label="Manutenção" value={ordem.manutencao} />
        </View>

        <View style={styles.assRow}>
          <View style={styles.assItem}>
            <View style={styles.assLine}>
              <Text style={styles.assLabel}>Ass. Gerência / Supervisor ___/___/___</Text>
            </View>
          </View>
          <View style={styles.assItem}>
            <View style={styles.assLine}>
              <Text style={styles.assLabel}>Ass. Consultor ___/___/___</Text>
            </View>
          </View>
        </View>

        <Text style={styles.verse}>
          &quot;TUDO O QUE FIZERES, FAÇAM DE TODO O CORAÇÃO, COMO PARA O SENHOR, E NÃO PARA OS HOMENS&quot;
          {'\n'}COLOSSENSES 3:23
        </Text>
      </Page>
    </Document>
  )
}
