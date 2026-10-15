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

// Trimestre do mês de referência (jan-mar, abr-jun, jul-set, out-dez).
export function trimestreRange(mesReferencia: string): { inicio: string; fim: string } {
  const [anoStr, mesStr] = mesReferencia.split('-')
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const mesInicio = Math.floor((mes - 1) / 3) * 3 // offset de janeiro, 0-based
  const toISO = (d: Date) => d.toISOString().slice(0, 10)
  return { inicio: toISO(new Date(ano, mesInicio, 1)), fim: toISO(new Date(ano, mesInicio + 3, 1)) }
}

// Mesmo range de semestreRange, mas a partir de um "YYYY-MM" (formato que o
// Dashboard já usa) em vez do "YYYY-S1"/"YYYY-S2".
export function semestreRangeDoMes(mesReferencia: string): { inicio: string; fim: string } {
  const [anoStr, mesStr] = mesReferencia.split('-')
  const semestre = Number(mesStr) <= 6 ? 'S1' : 'S2'
  return semestreRange(`${anoStr}-${semestre}`)
}

export function rangeDoPeriodo(
  mesReferencia: string,
  tipo: 'mes' | 'trimestre' | 'semestre' | 'ano'
): { inicio: string; fim: string } {
  if (tipo === 'mes') return mesRange(mesReferencia)
  if (tipo === 'trimestre') return trimestreRange(mesReferencia)
  if (tipo === 'semestre') return semestreRangeDoMes(mesReferencia)
  const ano = mesReferencia.slice(0, 4)
  return { inicio: `${ano}-01-01`, fim: `${Number(ano) + 1}-01-01` }
}

export function metaColor(pct: number): { badgeClass: string; fillColor: string } {
  if (pct >= 100) return { badgeClass: 'badge-aprovado', fillColor: 'var(--success)' }
  if (pct >= 70) return { badgeClass: 'badge-pendente', fillColor: 'var(--warning)' }
  return { badgeClass: 'badge-rejeitado', fillColor: 'var(--coral)' }
}
