export const tipoLabel: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
}

// Placeholder genérico (rotina de loja, cobrança de metas, padrão de
// atendimento) — ajustar o texto exato depois se necessário.
export const perguntasPorTipo: Record<string, string[]> = {
  diario: [
    'Loja abriu no horário previsto?',
    'Vitrine e fachada estão organizadas?',
    'Todos os vendedores registraram ponto?',
    'Atendimentos do dia foram lançados no sistema?',
    'Metas do dia foram repassadas à equipe?',
    'Ambiente de trabalho está limpo e organizado?',
  ],
  semanal: [
    'Reunião semanal de equipe foi realizada?',
    'Metas da semana foram revisadas com a equipe?',
    'Estoque foi conferido fisicamente?',
    'Leads sem atendimento há mais de 3 dias foram verificados?',
    'Feedback individual foi dado a cada vendedor?',
    'Ordens de serviço pendentes de aprovação foram revisadas?',
    'Padrão de atendimento foi reforçado com a equipe?',
    'Reclamações de clientes da semana foram tratadas?',
    'Relatório semanal foi enviado à diretoria?',
  ],
  mensal: [
    'Metas do mês foram atingidas?',
    'Avaliação individual de cada vendedor foi realizada?',
    'Estoque físico foi batido com o sistema?',
    'Comissões e premiações do mês foram conferidas?',
    'Plano de ação para o próximo mês foi definido?',
    'Treinamento ou reciclagem da equipe foi realizado?',
    'Indicadores de conversão (leads → vendas) foram analisados?',
    'Padrões de limpeza/manutenção da unidade foram auditados?',
    'Reunião mensal com a diretoria foi realizada?',
  ],
}

export function percentualColor(pct: number): { badgeClass: string; text: string } {
  if (pct >= 80) return { badgeClass: 'badge-aprovado', text: 'var(--success)' }
  if (pct >= 50) return { badgeClass: 'badge-pendente', text: 'var(--warning)' }
  return { badgeClass: 'badge-rejeitado', text: 'var(--danger)' }
}
