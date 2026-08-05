'use client'

import { useEffect, useRef, useState } from 'react'

type Alerta = { id: string; hora: string; tarefa: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}
function horaAgoraBR(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  })
}
function jaAlertado(id: string): boolean {
  try {
    return localStorage.getItem(`rotina-alertado-${id}-${hojeISO()}`) === '1'
  } catch {
    return false
  }
}
function marcarAlertado(id: string) {
  try {
    localStorage.setItem(`rotina-alertado-${id}-${hojeISO()}`, '1')
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
    osc.frequency.value = 660
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch {
    // sem áudio: segue com popup + notificação.
  }
}

// Avisa quando chega a hora de uma tarefa "Destacar" da rotina (bater ponto,
// preparar fechamento...) que ainda não foi marcada feita hoje. Só pra quem
// tem loja fixa — a API já filtra isso.
export function RotinaAlertWidget() {
  const [pendentes, setPendentes] = useState<Alerta[]>([])
  const [disparados, setDisparados] = useState<Alerta[]>([])
  const ref = useRef<Alerta[]>([])
  useEffect(() => {
    ref.current = pendentes
  }, [pendentes])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const buscar = () => {
      fetch('/api/rotina-alertas')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { alertas: Alerta[] } | null) => {
          if (d) setPendentes(d.alertas)
        })
        .catch(() => {})
    }
    buscar()
    const id = setInterval(buscar, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const checar = () => {
      const agora = horaAgoraBR()
      const chegou = ref.current.filter((a) => !jaAlertado(a.id) && a.hora <= agora)
      if (chegou.length === 0) return
      for (const a of chegou) {
        marcarAlertado(a.id)
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('⏰ Rotina', { body: `${a.tarefa} · ${a.hora}` })
          } catch {
            // ignore
          }
        }
      }
      bip()
      setDisparados((prev) => [...prev, ...chegou])
    }
    checar()
    const id = setInterval(checar, 20 * 1000)
    return () => clearInterval(id)
  }, [pendentes])

  // Repete o bipe tipo alarme enquanto o aviso não for dispensado — um bipe só
  // não chama atenção o suficiente no barulho da loja.
  const temPendente = disparados.length > 0
  useEffect(() => {
    if (!temPendente) return
    const id = setInterval(bip, 8000)
    return () => clearInterval(id)
  }, [temPendente])

  if (disparados.length === 0) return null

  return (
    <div className="lembrete-piscando fixed top-4 right-4 z-50 flex max-h-[60vh] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="rounded-full bg-[var(--coral)] px-3 py-1 text-[.72rem] font-extrabold uppercase tracking-wide text-white">
          ⏰ Hora da rotina
        </span>
        <button
          type="button"
          onClick={() => setDisparados([])}
          className="text-[var(--text-muted)] hover:text-white"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ul className="flex flex-col gap-2">
          {disparados.map((a) => (
            <li key={a.id}>
              <p className="font-semibold text-white">{a.tarefa}</p>
              <p className="text-[.7rem] text-[var(--text-muted)]">⏰ {a.hora}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-4 pb-3">
        <button type="button" onClick={() => setDisparados([])} className="btn btn-red btn-sm w-full">
          OK, entendi
        </button>
      </div>
    </div>
  )
}
