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

// "2026-07" → "julho de 2026". O ISO cru estava vazando pra tela.
export function mesLabel(periodo: string): string {
  const [ano, mes] = periodo.split('-')
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

// A meta de proteção é contada em unidades ("6/12 seguros"), não em reais: no
// antigo uma proteção de R$ 0,00 conta como 1 seguro igual às outras.
export function protecoesLabel(qtd: number): string {
  return `${qtd} ${qtd === 1 ? 'proteção' : 'proteções'}`
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
