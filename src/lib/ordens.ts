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
  'Externo',
]

export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type OrdemDedupInput = {
  id: string
  veiculo_placa: string | null
  cliente_nome: string
  created_at: string
}

// Mesma placa+cliente com mais de uma ordem aprovada = duplicata: duplo
// clique/reenvio do form (segundos de diferença, mesmo valor) ou ordem
// relançada com valor corrigido sem reprovar a antiga (dias de diferença,
// valor diferente) — os dois casos achados na prática (setembro/2026).
// Fica só com a mais recente (created_at) de cada grupo; sem placa não dá
// pra agrupar com segurança, então mantém todas. Usado nos relatórios
// financeiros que somam ordens_servico (/pagamentos, /despesas).
export function dedupOrdensPorPlacaCliente<T extends OrdemDedupInput>(ordens: T[]): T[] {
  const maisRecentePorChave = new Map<string, T>()
  for (const o of ordens) {
    const chave = o.veiculo_placa ? `${o.veiculo_placa.trim().toUpperCase()}::${o.cliente_nome.trim().toLowerCase()}` : o.id
    const atual = maisRecentePorChave.get(chave)
    if (!atual || o.created_at > atual.created_at) {
      maisRecentePorChave.set(chave, o)
    }
  }
  return [...maisRecentePorChave.values()]
}
