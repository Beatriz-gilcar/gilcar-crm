'use client'

import { useState } from 'react'

type Membro = { id: string; nome: string; unidadeNome: string }
type Unidade = { id: string; nome: string }
type LinhaInicial = {
  id: string
  consultor_id: string
  unidade_id: string | null
  veiculo: string
  status: string
  tipo: string
}

type Row = {
  key: string
  id: string | null
  consultor_id: string
  unidade_id: string
  veiculo: string
  status: string
  tipo: string
}

let contador = 0
function novaKey() {
  contador += 1
  return `nova-${contador}`
}

export function EditarListaVendas({
  mes,
  membros,
  unidades,
  linhasIniciais,
  action,
}: {
  mes: string
  membros: Membro[]
  unidades: Unidade[]
  linhasIniciais: LinhaInicial[]
  action: (formData: FormData) => void
}) {
  const [rows, setRows] = useState<Row[]>(
    linhasIniciais.map((l) => ({
      key: l.id,
      id: l.id,
      consultor_id: l.consultor_id,
      unidade_id: l.unidade_id ?? '',
      veiculo: l.veiculo,
      status: l.status,
      tipo: l.tipo,
    }))
  )

  function set(i: number, campo: keyof Row, valor: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)))
  }
  function mover(i: number, dir: -1 | 1) {
    setRows((rs) => {
      const j = i + dir
      if (j < 0 || j >= rs.length) return rs
      const copia = [...rs]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })
  }
  function remover(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i))
  }
  function adicionar() {
    setRows((rs) => [
      ...rs,
      { key: novaKey(), id: null, consultor_id: '', unidade_id: '', veiculo: '', status: 'ativa', tipo: 'carro' },
    ])
  }

  const payload = rows
    .filter((r) => r.consultor_id && r.veiculo.trim())
    .map((r) => ({
      id: r.id ?? undefined,
      consultor_id: r.consultor_id,
      unidade_id: r.unidade_id || null,
      veiculo: r.veiculo.trim(),
      status: r.status,
      tipo: r.tipo,
    }))

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="rows" value={JSON.stringify(payload)} />

      <div className="sec-body" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty-state">Nenhuma venda. Use &quot;+ Adicionar venda&quot;.</div>
        ) : (
          <div className="flex flex-col">
            {rows.map((r, i) => (
              <div
                key={r.key}
                className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-3 py-2 first:border-t-0"
              >
                <span className="w-6 text-center text-[.72rem] font-bold text-[var(--text-muted)]">#{i + 1}</span>
                <div className="flex flex-col">
                  <button type="button" onClick={() => mover(i, -1)} className="text-[.6rem] leading-none text-[var(--text-muted)] hover:text-white" aria-label="Subir">
                    ▲
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} className="text-[.6rem] leading-none text-[var(--text-muted)] hover:text-white" aria-label="Descer">
                    ▼
                  </button>
                </div>

                <select
                  value={r.consultor_id}
                  onChange={(e) => set(i, 'consultor_id', e.target.value)}
                  style={{ flex: '1 1 180px' }}
                >
                  <option value="">Selecione o vendedor</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} — {m.unidadeNome}
                    </option>
                  ))}
                </select>

                <select
                  value={r.unidade_id}
                  onChange={(e) => set(i, 'unidade_id', e.target.value)}
                  style={{ flex: '0 1 140px' }}
                  title="Loja da venda (volante)"
                >
                  <option value="">Loja do vendedor</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={r.veiculo}
                  onChange={(e) => set(i, 'veiculo', e.target.value)}
                  placeholder="Veículo vendido"
                  style={{ flex: '2 1 180px' }}
                />

                <button
                  type="button"
                  onClick={() => set(i, 'tipo', r.tipo === 'moto' ? 'carro' : 'moto')}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-[.66rem] font-bold uppercase text-white hover:bg-white/5"
                  title="Alternar moto/carro"
                >
                  {r.tipo === 'moto' ? '🏍️ Moto' : '🚗 Carro'}
                </button>

                <button
                  type="button"
                  onClick={() => set(i, 'status', r.status === 'caida' ? 'ativa' : 'caida')}
                  className={`rounded-full px-3 py-1 text-[.66rem] font-bold uppercase ${
                    r.status === 'caida' ? 'badge-rejeitado' : 'badge-aprovado'
                  }`}
                >
                  {r.status === 'caida' ? 'Caída' : 'Ativa'}
                </button>

                <button
                  type="button"
                  onClick={() => remover(i)}
                  className="text-[.9rem] font-bold text-[var(--danger)] hover:opacity-80"
                  aria-label="Remover"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={adicionar} className="btn btn-outline btn-sm">
          + Adicionar venda
        </button>
        <button type="submit" className="btn btn-red btn-sm">
          Salvar lista
        </button>
        <span className="text-[.72rem] text-[var(--text-muted)]">
          Ao salvar, a lista é renumerada 1..N na ordem acima.
        </span>
      </div>
    </form>
  )
}
