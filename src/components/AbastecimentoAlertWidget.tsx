'use client'

import { useEffect, useRef, useState } from 'react'

type Alerta = { tipo: 'hoje' | 'amanha'; unidade: string } | null

const REPETIR_A_CADA_MS = 2 * 60 * 60 * 1000 // insiste a cada 2h até ser dispensado

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}
// Dispensado (X ou "OK, entendi"): para de vez até o dia mudar. Diferente de
// só "mostrado", que só evita repetir antes da hora — dispensar é a pessoa
// dizendo "já vi, pode parar".
function foiDispensadoHoje(tipo: string): boolean {
  try {
    return localStorage.getItem(`abastecimento-dispensado-${tipo}-${hojeISO()}`) === '1'
  } catch {
    return false
  }
}
function marcarDispensado(tipo: string) {
  try {
    localStorage.setItem(`abastecimento-dispensado-${tipo}-${hojeISO()}`, '1')
  } catch {
    // sem localStorage: no pior caso o aviso segue repetindo — sem quebrar.
  }
}
function ultimaVezMostrado(tipo: string): number {
  try {
    return Number(localStorage.getItem(`abastecimento-mostrado-em-${tipo}-${hojeISO()}`)) || 0
  } catch {
    return 0
  }
}
function marcarMostradoAgora(tipo: string) {
  try {
    localStorage.setItem(`abastecimento-mostrado-em-${tipo}-${hojeISO()}`, String(Date.now()))
  } catch {
    // sem localStorage: no pior caso o aviso segue repetindo — sem quebrar.
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
// unidade dele, só se houver dia configurado). Insiste a cada 2h (repete o
// popup + som) até a pessoa dispensar explicitamente, pra não passar batido
// se fechar sem perceber ou aparecer num momento ruim.
export function AbastecimentoAlertWidget() {
  const [mensagem, setMensagem] = useState<string | null>(null)
  const tipoAtualRef = useRef<'hoje' | 'amanha' | null>(null)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const checar = () => {
      fetch('/api/abastecimento-alerta')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { alerta: Alerta } | null) => {
          if (!d?.alerta) return
          const { tipo, unidade } = d.alerta
          if (foiDispensadoHoje(tipo)) return
          if (Date.now() - ultimaVezMostrado(tipo) < REPETIR_A_CADA_MS) return

          marcarMostradoAgora(tipo)
          tipoAtualRef.current = tipo
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
    // 30 min: a janela de repetição é de 2h, então isso ainda pega ela várias
    // vezes sem sobrecarregar a cota de invocações da Vercel.
    const id = setInterval(checar, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  function dispensar() {
    if (tipoAtualRef.current) marcarDispensado(tipoAtualRef.current)
    setMensagem(null)
  }

  if (!mensagem) return null

  return (
    <div className="lembrete-piscando fixed bottom-4 left-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="rounded-full bg-[var(--coral)] px-3 py-1 text-[.72rem] font-extrabold uppercase tracking-wide text-white">
          ⛽ Abastecimento
        </span>
        <button
          type="button"
          onClick={dispensar}
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
        <button type="button" onClick={dispensar} className="btn btn-red btn-sm w-full">
          OK, entendi
        </button>
      </div>
    </div>
  )
}
