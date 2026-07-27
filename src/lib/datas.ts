// Formatação de data/hora no fuso do Brasil. As páginas renderizam no servidor
// (Vercel roda em UTC), então sem `timeZone` os horários saíam 3h adiantados —
// "bateu o ponto às 16:51" quando eram 13:51. Sempre fixar America/Sao_Paulo.
const TZ = 'America/Sao_Paulo'

// Só a hora: "13:51".
export function horaBR(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}

// Data + hora: "20/07/2026 13:51".
export function dataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: TZ })
}
