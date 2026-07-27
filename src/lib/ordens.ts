export const tipoLabel: Record<string, string> = {
  venda: 'Venda',
  compra: 'Compra',
}

export const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
}

export const statusBadgeClass: Record<string, string> = {
  pendente: 'badge-pendente',
  aprovada: 'badge-aprovado',
  reprovada: 'badge-rejeitado',
}

export const formaPagamentoLabel: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  pix: 'PIX',
  boleto: 'Boleto',
  consorcio: 'Consórcio',
  transferencia: 'Transferência',
}

// Bancos/financeiras usados no financiamento. Vira as opções do dropdown do
// campo "Financeira". A lista é sugestão (datalist), não trava: financeira
// rara ainda pode ser digitada à mão, sem virar cadastro novo.
export const bancos: string[] = [
  'BV',
  'Santander',
  'Itaú',
  'Bradesco',
  'Safra',
  'Creditas',
  'Panamericano',
  'BRB',
  'C6',
  'Omni',
  'Carbank',
  'Casa 8',
]

export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
