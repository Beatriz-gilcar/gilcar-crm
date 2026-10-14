// Lista fixa das etapas do treinamento de novo consultor — hardcoded de
// propósito (sem customização pedida ainda). Mesma decisão de
// ITENS_CONFERENCIA_PADRAO em src/lib/veiculos.ts. "chave" é o que fica
// salvo em treinamento_progresso.etapa — não reordenar/renomear sem
// migrar os dados já marcados.
export const ETAPAS_TREINAMENTO: { chave: string; titulo: string }[] = [
  { chave: 'apresentacao_empresa', titulo: 'Apresentação da empresa' },
  { chave: 'tour_loja_equipe', titulo: 'Tour pela loja e equipe' },
  { chave: 'treinamento_sistema', titulo: 'Treinamento do sistema (Ficha/Estoque/Ordens)' },
  { chave: 'treinamento_produto', titulo: 'Treinamento de produto' },
  { chave: 'acompanhamento_atendimento', titulo: 'Acompanhamento de atendimento real' },
  { chave: 'primeira_venda', titulo: 'Primeira venda acompanhada' },
]

export function calcularProgresso(etapasFeitas: Set<string>) {
  const total = ETAPAS_TREINAMENTO.length
  const feitas = ETAPAS_TREINAMENTO.filter((e) => etapasFeitas.has(e.chave)).length
  return { total, feitas, percentual: total === 0 ? 0 : Math.round((feitas / total) * 100) }
}
