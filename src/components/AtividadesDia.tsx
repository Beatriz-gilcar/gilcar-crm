'use client'

import { useState } from 'react'
import { atividadeGrupos, type AtividadeCampo } from '@/lib/atividades'

export function AtividadesDia({
  valores,
  somenteLeitura = false,
}: {
  valores: Record<AtividadeCampo, number>
  somenteLeitura?: boolean
}) {
  const [contagem, setContagem] = useState(valores)

  const ajustar = (campo: AtividadeCampo, delta: number) =>
    setContagem((atual) => ({ ...atual, [campo]: Math.max(0, (atual[campo] ?? 0) + delta) }))

  return (
    <div className="flex flex-col">
      {atividadeGrupos.map((grupo) => (
        <div key={grupo.titulo}>
          <div className="border-t border-[var(--border)] px-4 pb-1 pt-3 text-[.68rem] font-bold tracking-wide text-[var(--coral)]">
            {grupo.titulo}
          </div>
          {grupo.itens.map((item) => {
            const valor = contagem[item.campo] ?? 0
            const bateuMeta = valor >= item.meta

            return (
              <div
                key={item.campo}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <span className="text-[.8rem] normal-case text-white">
                  {item.label}{' '}
                  <span className="text-[.68rem] text-[var(--text-muted)]">(meta: {item.meta})</span>
                </span>

                {/* O valor vai no form pelo hidden; os botões só mexem no estado. */}
                <input type="hidden" name={item.campo} value={valor} />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Diminuir ${item.label}`}
                    disabled={somenteLeitura}
                    onClick={() => ajustar(item.campo, -1)}
                    className="h-7 w-7 rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:border-white hover:text-white disabled:opacity-40"
                  >
                    −
                  </button>
                  <span
                    className={`w-8 text-center text-[.85rem] font-bold ${
                      bateuMeta ? 'text-[var(--success)]' : 'text-white'
                    }`}
                  >
                    {valor}
                  </span>
                  <button
                    type="button"
                    aria-label={`Aumentar ${item.label}`}
                    disabled={somenteLeitura}
                    onClick={() => ajustar(item.campo, 1)}
                    className="h-7 w-7 rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:border-white hover:text-white disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
