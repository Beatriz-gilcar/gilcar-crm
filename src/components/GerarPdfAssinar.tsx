'use client'

import { useState } from 'react'

// Barreira do "Gerar PDF": antes de gerar, mostra a assinatura automática do
// gerente logado (nome + cargo + agora). Ao confirmar, submete o form pra
// assinarOrdem, que registra a assinatura e leva pro PDF.
export function GerarPdfAssinar({
  ordemId,
  nome,
  cargoLabel,
  action,
}: {
  ordemId: string
  nome: string
  cargoLabel: string
  action: (formData: FormData) => void
}) {
  const [aberto, setAberto] = useState(false)
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn btn-red btn-sm self-start">
        Gerar PDF
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setAberto(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[.85rem] font-extrabold uppercase tracking-wide text-white">🔒 Assinatura digital</p>
            <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">
              Sua assinatura será gerada automaticamente
            </p>

            <div className="my-4 rounded-xl bg-white px-4 py-5 text-neutral-900">
              <p className="text-[1.3rem] font-bold italic" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                {nome}
              </p>
              <div className="mx-auto mt-1 h-px w-3/4 bg-neutral-300" />
              <p className="mt-1 text-[.62rem] font-bold uppercase tracking-wide text-neutral-600">{cargoLabel}</p>
              <p className="text-[.62rem] text-neutral-500">{agora}</p>
            </div>

            <p className="mb-3 text-[.66rem] normal-case text-[var(--text-muted)]">
              Esta assinatura ficará registrada no documento impresso.
            </p>

            <form action={action}>
              <input type="hidden" name="id" value={ordemId} />
              <button type="submit" className="btn btn-red w-full">
                ✅ Confirmar e gerar
              </button>
            </form>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="mt-2 text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
