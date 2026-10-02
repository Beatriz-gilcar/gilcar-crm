'use client'

import { useState } from 'react'

type Membro = { id: string; nome: string; unidade_id: string | null; unidadeNome: string | null }
type Unidade = { id: string; nome: string }

// Vendedor "volante" (Gilmar, Junior hoje): perfil sem unidade fixa
// (unidade_id null), pode vender por qualquer loja. Só nesse caso o campo
// Loja aparece — pra vendedor normal a venda já cai na unidade dele, sem
// precisar escolher (e sem deixar escolher errado por engano).
export function SeletorVendedorLoja({
  membros,
  unidades,
  minhaUnidadeId,
}: {
  membros: Membro[]
  unidades: Unidade[]
  minhaUnidadeId: string | null
}) {
  const [vendedorId, setVendedorId] = useState('')
  const vendedorSelecionado = membros.find((m) => m.id === vendedorId)
  const ehVolante = vendedorId === '' ? minhaUnidadeId === null : vendedorSelecionado?.unidade_id === null

  return (
    <>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Vendedor</label>
        <select name="consultor_id" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
          <option value="">Eu mesmo</option>
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome} — {m.unidadeNome ?? 'Todas'}
            </option>
          ))}
        </select>
      </div>

      {ehVolante && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Loja da venda</label>
          <select name="unidade_id" defaultValue="" required>
            <option value="" disabled>
              Selecione...
            </option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
            Esse vendedor não tem unidade fixa — escolha em qual loja essa venda entra.
          </p>
        </div>
      )}
    </>
  )
}
