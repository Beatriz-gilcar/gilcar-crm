'use client'

import { useEffect, useState } from 'react'
import { metaColor } from '@/lib/metas'

type Item = { nome: string; realizado: number; meta: number }
type Dados = { lojas: Item[]; consultores: Item[] }

const EMOJIS = ['🎉', '✨', '🎊', '🏁', '🥳', '⭐']

function Confetti() {
  // Peças fixas pro tempo de vida do componente: posição/atraso/duração
  // aleatórios sorteados uma vez só, no inicializador do useState — diferente
  // de useMemo, essa função roda garantidamente uma única vez (na montagem).
  const [pecas] = useState(() =>
    Array.from({ length: 60 }).map((_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      dur: 2.6 + Math.random() * 2.2,
      emoji: EMOJIS[i % EMOJIS.length],
    }))
  )
  return (
    <div className="confetti-full" aria-hidden>
      {pecas.map((p) => (
        <span
          key={p.key}
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}

function Linha({ item }: { item: Item }) {
  const pct = item.meta > 0 ? (item.realizado / item.meta) * 100 : 0
  const pctClamped = Math.min(Math.max(pct, 0), 100)
  const cor = metaColor(pct)
  const bateu = item.meta > 0 && item.realizado >= item.meta
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[.64rem] font-bold uppercase tracking-wide">
        <span className="truncate text-white">{item.nome}</span>
        <span style={{ color: cor.fillColor }}>
          {item.realizado}/{item.meta > 0 ? item.meta : '—'} {bateu ? '✅' : ''}
        </span>
      </div>
      <div className="meta-track" style={{ margin: '6px 0 12px' }}>
        <div className="meta-fill" style={{ width: `${pctClamped}%`, background: cor.fillColor }} />
        <span className="meta-runner" style={{ left: `${pctClamped}%` }}>
          🚗
        </span>
      </div>
    </div>
  )
}

export function CorridaMeta() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState<'lojas' | 'consultores'>('lojas')
  const [confete, setConfete] = useState(false)

  useEffect(() => {
    let cancel = false
    fetch('/api/corrida-meta')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Dados | null) => {
        if (cancel || !d) return
        setDados(d)
        // Confete SÓ na primeira vez que cada meta é batida (não toda vez que
        // abre). Guardamos no navegador, por mês, quem já foi comemorado; o
        // confete só dispara quando aparece uma batida NOVA ainda não celebrada.
        try {
          const mes = new Date().toISOString().slice(0, 7)
          const chave = `corrida-confete-${mes}`
          const idsBateu = [
            ...d.lojas.filter((i) => i.meta > 0 && i.realizado >= i.meta).map((i) => `L:${i.nome}`),
            ...d.consultores.filter((i) => i.meta > 0 && i.realizado >= i.meta).map((i) => `C:${i.nome}`),
          ]
          const celebrados: string[] = JSON.parse(localStorage.getItem(chave) || '[]')
          const novos = idsBateu.filter((id) => !celebrados.includes(id))
          if (novos.length > 0) {
            setConfete(true)
            setTimeout(() => {
              if (!cancel) setConfete(false)
            }, 5000)
            localStorage.setItem(chave, JSON.stringify([...celebrados, ...novos]))
          }
        } catch {
          // localStorage indisponível: não trava o widget.
        }
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [])

  // Escondido enquanto não carrega ou quando não autenticado (ex.: /login).
  if (!dados) return null

  const lista = aba === 'lojas' ? dados.lojas : dados.consultores

  return (
    <>
      {confete && <Confetti />}

      {aberto && (
        <div className="fixed bottom-20 right-4 z-50 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <span className="text-[.8rem] font-extrabold uppercase tracking-wide text-white">🏁 Corrida da Meta</span>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-[var(--text-muted)] hover:text-white"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-1 p-2">
            {(['lojas', 'consultores'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAba(k)}
                className={`flex-1 rounded-full px-3 py-1.5 text-[.7rem] font-bold uppercase tracking-wide transition-colors ${
                  aba === k ? 'bg-[var(--coral)] text-white' : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {k === 'lojas' ? 'Lojas' : 'Consultores'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1">
            {lista.length === 0 ? (
              <p className="py-4 text-center text-[.75rem] text-[var(--text-muted)]">Sem metas definidas.</p>
            ) : (
              lista.map((item) => <Linha key={item.nome} item={item} />)
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-[var(--coral)] px-4 py-2.5 text-[.72rem] font-extrabold uppercase tracking-wide text-white shadow-lg hover:brightness-110"
      >
        🏁 Corrida da Meta
      </button>
    </>
  )
}
