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

// "Agora" na loja (Brasília) pra código que roda no servidor (Vercel = UTC) e
// precisa decidir o dia da semana ou a data corrente — mesma técnica do cron
// de lembretes (src/app/api/cron/lembretes/route.ts).
export function agoraNaLoja(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000)
}

export const diasSemana = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
]
