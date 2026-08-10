'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { dataHoraBR, horaBR } from '@/lib/datas'

type Lembrete = { id: string; titulo: string; data_vencimento: string | null; concluido: boolean }
type Pessoa = { id: string; nome: string; cargo: string }

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
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch {
    // sem áudio: segue com popup + notificação.
  }
}

export function LembretesWidget() {
  const [lembretes, setLembretes] = useState<Lembrete[]>([])
  const [carregado, setCarregado] = useState(false)
  const [aberto, setAberto] = useState(false)
  // Pisca enquanto houver lembrete vencido ainda não concluído (derivado, não
  // por tempo). Só para quando a pessoa dá baixa (✓) — que tira ele da lista.
  const [temVencido, setTemVencido] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const [titulo, setTitulo] = useState('')
  const [quando, setQuando] = useState('')
  const [destino, setDestino] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [gerentes, setGerentes] = useState<Pessoa[]>([])
  const [consultores, setConsultores] = useState<Pessoa[]>([])
  const ref = useRef<Lembrete[]>([])
  useEffect(() => {
    ref.current = lembretes
  }, [lembretes])

  function buscar() {
    fetch('/api/lembretes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { lembretes: Lembrete[]; isAdmin?: boolean; gerentes?: Pessoa[]; consultores?: Pessoa[] } | null) => {
        if (d) {
          setLembretes(d.lembretes)
          setCarregado(true)
          setIsAdmin(!!d.isAdmin)
          setGerentes(d.gerentes ?? [])
          setConsultores(d.consultores ?? [])
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    buscar()
    const id = setInterval(buscar, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Avalia quem venceu. Toca/notifica/abre só na PRIMEIRA vez de cada lembrete
  // (dedupe), mas o "piscar" (temVencido) fica ligado enquanto existir vencido
  // não concluído — só apaga quando a pessoa dá baixa (✓).
  useEffect(() => {
    const avaliar = () => {
      const agoraMs = Date.now()
      setAgora(agoraMs)
      const vencidos = ref.current.filter(
        (l) => l.data_vencimento && new Date(l.data_vencimento).getTime() <= agoraMs
      )
      const novos = vencidos.filter((l) => !jaAlertado(l.id))
      if (novos.length > 0) {
        for (const l of novos) {
          marcarAlertado(l.id)
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('🔔 Lembrete', {
                body: `${l.titulo}${l.data_vencimento ? ` · ${horaBR(l.data_vencimento)}` : ''}`,
              })
            } catch {
              // ignore
            }
          }
        }
        bip()
        setAberto(true)
      }
      setTemVencido(vencidos.length > 0)
    }
    avaliar()
    const id = setInterval(avaliar, 20 * 1000)
    return () => clearInterval(id)
  }, [lembretes])

  // Pisca também o TÍTULO da aba do navegador (chama atenção mesmo com a aba
  // em segundo plano). Alterna entre o título normal e o alerta; volta ao
  // normal quando não há mais vencido (baixa dada).
  useEffect(() => {
    if (!temVencido) return
    const original = document.title
    let on = false
    const flip = () => {
      on = !on
      if (on) {
        const n = ref.current.filter(
          (l) => l.data_vencimento && new Date(l.data_vencimento).getTime() <= Date.now()
        ).length
        document.title = `🔔 (${n}) Lembrete${n === 1 ? '' : 's'}!`
      } else {
        document.title = original
      }
    }
    flip()
    const idFlip = setInterval(flip, 1200)
    return () => {
      clearInterval(idFlip)
      document.title = original
    }
  }, [temVencido])

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    setSalvando(true)
    await fetch('/api/lembretes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, data_vencimento: quando, destino }),
    }).catch(() => {})
    setTitulo('')
    setQuando('')
    setDestino('')
    setSalvando(false)
    buscar()
  }
  async function concluir(id: string) {
    await fetch(`/api/lembretes/${id}`, { method: 'PATCH' }).catch(() => {})
    buscar()
  }
  async function excluir(id: string) {
    await fetch(`/api/lembretes/${id}`, { method: 'DELETE' }).catch(() => {})
    buscar()
  }

  // Só some quando não autenticado (fetch 401 → nunca carrega).
  if (!carregado) return null

  return (
    <>
      {aberto && (
        <div
          className={`${
            temVencido ? 'lembrete-piscando' : ''
          } fixed bottom-36 right-4 z-50 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl`}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <span className="text-[.8rem] font-extrabold uppercase tracking-wide text-white">🔔 Lembretes</span>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-[var(--text-muted)] hover:text-white"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <form onSubmit={adicionar} className="flex flex-col gap-2 border-b border-[var(--border)] p-3">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: bater ponto"
              required
            />
            {isAdmin && (
              <select value={destino} onChange={(e) => setDestino(e.target.value)} className="text-[.75rem]">
                <option value="">Só eu</option>
                <option value="grupo:gerente">Todos os gerentes/supervisores</option>
                <option value="grupo:consultor">Todos os consultores</option>
                {gerentes.length > 0 && (
                  <optgroup label="Gerentes/supervisores">
                    {gerentes.map((p) => (
                      <option key={p.id} value={`pessoa:${p.id}`}>
                        {p.nome}
                      </option>
                    ))}
                  </optgroup>
                )}
                {consultores.length > 0 && (
                  <optgroup label="Consultores">
                    {consultores.map((p) => (
                      <option key={p.id} value={`pessoa:${p.id}`}>
                        {p.nome}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
                className="flex-1"
              />
              <button type="submit" disabled={salvando} className="btn btn-red btn-sm">
                {salvando ? '…' : 'Add'}
              </button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto p-2">
            {lembretes.length === 0 ? (
              <p className="py-4 text-center text-[.75rem] text-[var(--text-muted)]">Nenhum lembrete.</p>
            ) : (
              <ul className="flex flex-col">
                {lembretes.map((l) => {
                  const vencido = l.data_vencimento ? new Date(l.data_vencimento).getTime() <= agora : false
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 border-t border-[var(--border)] px-2 py-2 first:border-t-0"
                    >
                      <button
                        type="button"
                        onClick={() => concluir(l.id)}
                        aria-label="Concluir"
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-transparent hover:border-white hover:text-white"
                      >
                        ✓
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[.8rem] font-semibold text-white">{l.titulo}</p>
                        {l.data_vencimento && (
                          <p className={`text-[.66rem] ${vencido ? 'text-[var(--coral)]' : 'text-[var(--text-muted)]'}`}>
                            ⏰ {dataHoraBR(l.data_vencimento)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => excluir(l.id)}
                        className="text-[.7rem] font-bold text-[var(--danger)] hover:underline"
                      >
                        Excluir
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`${
          temVencido ? 'lembrete-piscando' : ''
        } fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-[var(--coral)] px-4 py-2.5 text-[.72rem] font-extrabold uppercase tracking-wide text-white shadow-lg hover:brightness-110`}
      >
        🔔 Lembretes
        {lembretes.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[.66rem] font-bold text-[var(--coral)]">
            {lembretes.length}
          </span>
        )}
      </button>
    </>
  )
}
