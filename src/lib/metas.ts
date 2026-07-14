export const statusLabel: Record<string, string> = {
  ativa: 'Ativa',
  caida: 'Caída',
}

export const statusBadgeClass: Record<string, string> = {
  ativa: 'badge-aprovado',
  caida: 'badge-rejeitado',
}

export const escopoLabel: Record<string, string> = {
  empresa: 'Empresa',
  unidade: 'Unidade',
  consultor: 'Consultor',
}

export function mesAtualISO(): string {
  return new Date().toISOString().slice(0, 7)
}

export function semestreAtual(): string {
  const now = new Date()
  const semestre = now.getMonth() < 6 ? 'S1' : 'S2'
  return `${now.getFullYear()}-${semestre}`
}

export function semestreRange(periodo: string): { inicio: string; fim: string } {
  const [anoStr, semestre] = periodo.split('-')
  const ano = Number(anoStr)
  if (semestre === 'S1') {
    return { inicio: `${ano}-01-01`, fim: `${ano}-07-01` }
  }
  return { inicio: `${ano}-07-01`, fim: `${ano + 1}-01-01` }
}

export function mesRange(periodo: string): { inicio: string; fim: string } {
  const [anoStr, mesStr] = periodo.split('-')
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const inicio = `${periodo}-01`
  const fimDate = mes === 12 ? new Date(ano + 1, 0, 1) : new Date(ano, mes, 1)
  const fim = fimDate.toISOString().slice(0, 10)
  return { inicio, fim }
}

export function metaColor(pct: number): { badgeClass: string; fillColor: string } {
  if (pct >= 100) return { badgeClass: 'badge-aprovado', fillColor: 'var(--success)' }
  if (pct >= 70) return { badgeClass: 'badge-pendente', fillColor: 'var(--warning)' }
  return { badgeClass: 'badge-rejeitado', fillColor: 'var(--coral)' }
}
