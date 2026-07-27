export const tipoLabel: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
}

// As perguntas reais do sistema antigo (const CHECKLIST, Html:2263).
//
// O que estava aqui antes era um placeholder inventado ("Loja abriu no horário
// previsto?", "Vitrine e fachada estão organizadas?") que nunca foi conferido
// contra o original. As de verdade são sobre condução da equipe e da
// negociação, não sobre rotina de loja — e são as que os gerentes já
// responderam nos 15 checklists da planilha.
export const perguntasPorTipo: Record<string, string[]> = {
  diario: [
    'Revisou atendimentos presenciais, on-line, postagens e avaliações?',
    'Deu feedback individual pro vendedor que não converteu?',
    'Identificou clientes quentes pra retorno amanhã?',
    'Criou uma estratégia para esse atendimento?',
    'Alguma negociação travada que precisa de ação amanhã?',
    'Aprovou o dia de todos os consultores que enviaram a ficha?',
  ],
  semanal: [
    'A sua loja está dentro da meta?',
    'Quais vendedores estão abaixo da meta?',
    'O que fez pra corrigi-los?',
    'Os agendamentos compareceram?',
    'Algum cliente gerou problema na sua loja? Como resolveu?',
    'Qual vendedor teve o melhor comportamento essa semana? Não existe empate!',
    'Qual vendedor teve o pior comportamento essa semana?',
    'Qual o seu plano de ação pra próxima semana?',
    'Quando será sua reunião semanal com a equipe? Data e hora:',
  ],
  mensal: [
    'Meta x Resultado — como fechou o mês?',
    'Ranking dos vendedores: conversão individual, on-line, agendamentos x comparecimentos',
    'O que funcionou melhor esse mês? Por quê?',
    'O que não funcionou? Por quê?',
    'Vendedores que precisam de treinamento?',
    'Vendedores que precisam de advertência ou desligamento?',
    'Sugestão de melhoria na sua unidade — processo/venda?',
    'Sobre o seu desenvolvimento pessoal: o que aprendeu esse mês?',
    'Quando será a sua reunião mensal com a equipe? Data e hora:',
  ],
}

export function percentualColor(pct: number): { badgeClass: string; text: string } {
  if (pct >= 80) return { badgeClass: 'badge-aprovado', text: 'var(--success)' }
  if (pct >= 50) return { badgeClass: 'badge-pendente', text: 'var(--warning)' }
  return { badgeClass: 'badge-rejeitado', text: 'var(--danger)' }
}
