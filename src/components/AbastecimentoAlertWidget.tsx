'use client'

import { useEffect, useState } from 'react'

type Alerta = { tipo: 'hoje' | 'amanha'; unidade: string } | null

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}
function jaAlertado(tipo: string): boolean {
  try {
    return localStorage.getItem(`abastecimento-alertado-${tipo}-${hojeISO()}`) === '1'
  } catch {
    return false
  }
}
function marcarAlertado(tipo: string) {
  try {
    localStorage.setItem(`abastecimento-alertado-${tipo}-${hojeISO()}`, '1')
  } catch {
    // sem localStorage: no pior caso alerta de novo — sem quebrar.
  }
}
function bip() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 520
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch {
    // sem áudio: segue com popup + notificação.
  }
}

// Avisa o gerente logado, dentro do sistema, na véspera e na manhã do dia de
// abastecimento da própria unidade — a API já filtra isso (só gerente, só
// unidade dele, só se houver dia configurado).
export function AbastecimentoAlertWidget() {
  const [mensagem, setMensagem] = useState<string | null>(null)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const checar = () => {
      fetch('/api/abastecimento-alerta')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { alerta: Alerta } | null) => {
          if (!d?.alerta || jaAlertado(d.alerta.tipo)) return
          const { tipo, unidade } = d.alerta
          marcarAlertado(tipo)
          const texto =
            tipo === 'hoje'
              ? `Hoje é dia de abastecimento em ${unidade}`
              : `Amanhã é dia de abastecimento em ${unidade}`
          setMensagem(texto)
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('⛽ Abastecimento', { body: texto })
            } catch {
              // ignore
            }
          }
          bip()
        })
        .catch(() => {})
    }
    checar()
    // Não precisa granularidade fina — é um aviso por dia, não por horário.
    const id = setInterval(checar, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!mensagem) return null

  return (
    <div className="lembrete-piscando fixed bottom-4 left-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="rounded-full bg-[var(--coral)] px-3 py-1 text-[.72rem] font-extrabold uppercase tracking-wide text-white">
          ⛽ Abastecimento
        </span>
        <button
          type="button"
          onClick={() => setMensagem(null)}
          className="text-[var(--text-muted)] hover:text-white"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="font-semibold text-white">{mensagem}</p>
      </div>
      <div className="px-4 pb-3">
        <button type="button" onClick={() => setMensagem(null)} className="btn btn-red btn-sm w-full">
          OK, entendi
        </button>
      </div>
    </div>
  )
}
