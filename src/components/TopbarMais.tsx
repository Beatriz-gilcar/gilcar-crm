'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type Item = { key: string; href: string; label: string }
type Grupo = { titulo: string; itens: Item[] }

// Painel "Mais": reúne as abas menos usadas no dia a dia pra não estourar a
// largura do menu principal (o admin sozinho já tinha 14 abas soltas). É pura
// navegação — quem pode ver o quê continua decidido em Topbar.tsx, aqui só
// muda onde o link aparece.
export function TopbarMais({ grupos, active }: { grupos: Grupo[]; active: string }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const grupoComItens = grupos.filter((g) => g.itens.length > 0)
  const ativo = grupoComItens.some((g) => g.itens.some((i) => i.key === active))

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  if (grupoComItens.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[.75rem] font-bold tracking-wide transition-colors ${
          ativo
            ? 'bg-[var(--coral)] text-white'
            : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-white'
        }`}
      >
        Mais
        <span className={`text-[.6rem] transition-transform ${aberto ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {aberto && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[min(90vw,420px)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl">
          {grupoComItens.map((grupo, i) => (
            <div key={grupo.titulo} className={i > 0 ? 'mt-4 border-t border-[var(--border)] pt-4' : ''}>
              <p className="mb-2 text-[.62rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {grupo.titulo}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {grupo.itens.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setAberto(false)}
                    className={`rounded-xl border px-3 py-2.5 text-[.72rem] font-bold tracking-wide transition-colors ${
                      active === item.key
                        ? 'border-[var(--coral)] bg-[var(--coral-soft)] text-white'
                        : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:border-[var(--coral)] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
