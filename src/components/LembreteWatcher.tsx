'use client'

import { useEffect, useRef, useState } from 'react'
import { horaBR } from '@/lib/datas'

type Lembrete = { id: string; titulo: string; data_vencimento: string }

function jaAlertado(id: string): boolean {
  try {
    return localStorage.getItem(`lembrete-alertado-${id}`) === '1'
  } catch {
    return false
  }
}
function marcarAlertado(id: string) {
  try {
    localStorage.setItem(`lembrete-alertado-${id}`, '1')
  } catch {
    // localStorage indisponível: pior caso, alerta de novo — sem quebrar.
  }
}

// Bip curto via Web Audio (sem asset externo).
function bip() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch {
    // Sem áudio (ex.: bloqueado): segue com popup + notificação.
  }
}

export function LembreteWatcher() {
  const [lembretes, setLembretes] = useState<Lembrete[]>([])
  const [disparados, setDisparados] = useState<Lembrete[]>([])
  const lembretesRef = useRef<Lembrete[]>([])
  useEffect(() => {
    lembretesRef.current = lembretes
  }, [lembretes])

  // Busca inicial + a cada 2 min; pede permissão de notificação uma vez.
  useEffect(() => {
    let cancel = false
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const buscar = () => {
      fetch('/api/lembretes-proximos')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { lembretes: Lembrete[] } | null) => {
          if (!cancel && d) setLembretes(d.lembretes)
        })
        .catch(() => {})
    }
    buscar()
    const id = setInterval(buscar, 2 * 60 * 1000)
    return () => {
      cancel = true
      clearInterval(id)
    }
  }, [])

  // A cada 20s, checa quem venceu e ainda não foi alertado.
  useEffect(() => {
    const checar = () => {
      const agora = Date.now()
      const vencidos = lembretesRef.current.filter(
        (l) => !jaAlertado(l.id) && new Date(l.data_vencimento).getTime() <= agora
      )
      if (vencidos.length === 0) return
      for (const l of vencidos) {
        marcarAlertado(l.id)
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('🔔 Lembrete', { body: `${l.titulo} · ${horaBR(l.data_vencimento)}` })
          } catch {
            // ignore
          }
        }
      }
      bip()
      setDisparados((prev) => [...prev, ...vencidos])
    }
    checar()
    const id = setInterval(checar, 20 * 1000)
    return () => clearInterval(id)
  }, [lembretes])

  if (disparados.length === 0) return null

  return (
    <div className="lembrete-piscando fixed bottom-4 right-4 z-50 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="rounded-full bg-[var(--coral)] px-3 py-1 text-[.72rem] font-extrabold uppercase tracking-wide text-white">
          🔔 Lembrete
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
          {disparados.map((l) => (
            <li key={l.id}>
              <p className="font-semibold text-white">{l.titulo}</p>
              <p className="text-[.7rem] text-[var(--text-muted)]">⏰ {horaBR(l.data_vencimento)}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-4 pb-3">
        <button type="button" onClick={() => setDisparados([])} className="btn btn-red btn-sm w-full">
          OK, dispensar
        </button>
      </div>
    </div>
  )
}
