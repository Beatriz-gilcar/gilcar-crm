'use client'

import { useEffect, useState } from 'react'

type PostAlerta = { id: string; tipo: string; titulo: string; autor: string }

function jaAlertado(id: string): boolean {
  try {
    return localStorage.getItem(`mural-alertado-${id}`) === '1'
  } catch {
    return false
  }
}
function marcarAlertado(id: string) {
  try {
    localStorage.setItem(`mural-alertado-${id}`, '1')
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

// Avisa gerência/admin (a API já filtra por cargo) quando alguém publica no
// Mural — dúvida ou sugestão. Só dispara pra post que ainda não foi visto
// (localStorage), igual ao LembreteWatcher.
export function MuralAlertWidget() {
  const [novos, setNovos] = useState<PostAlerta[]>([])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const checar = () => {
      fetch('/api/mural-alerta')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { posts: PostAlerta[] } | null) => {
          if (!d?.posts?.length) return
          const inedito = d.posts.filter((p) => !jaAlertado(p.id))
          if (inedito.length === 0) return
          for (const p of inedito) {
            marcarAlertado(p.id)
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('💬 Mural', { body: `${p.autor}: ${p.titulo}` })
              } catch {
                // ignore
              }
            }
          }
          bip()
          setNovos((prev) => [...inedito, ...prev])
        })
        .catch(() => {})
    }
    checar()
    const id = setInterval(checar, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (novos.length === 0) return null

  return (
    <div className="lembrete-piscando fixed bottom-56 left-4 z-50 flex max-h-[50vh] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="rounded-full bg-[var(--coral)] px-3 py-1 text-[.72rem] font-extrabold uppercase tracking-wide text-white">
          💬 Mural
        </span>
        <button
          type="button"
          onClick={() => setNovos([])}
          className="text-[var(--text-muted)] hover:text-white"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ul className="flex flex-col gap-2">
          {novos.map((p) => (
            <li key={p.id}>
              <p className="text-[.7rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {p.tipo === 'sugestao' ? 'Sugestão' : 'Dúvida'}
              </p>
              <p className="font-semibold text-white">{p.titulo}</p>
              <p className="text-[.7rem] text-[var(--text-muted)]">{p.autor}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-4 pb-3">
        <a href="/mural" className="btn btn-red btn-sm block w-full text-center">
          Ver no Mural
        </a>
      </div>
    </div>
  )
}
