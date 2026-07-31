'use client'

import { useMemo, useState } from 'react'

type Consultor = { id: string; nome: string }
type Loja = { id: string; nome: string; consultores: Consultor[] }
type Valor = { leads: number; agendamentos: number; comparecimentos: number; observacao: string }

const CAMPOS: { key: 'agendamentos' | 'comparecimentos'; label: string }[] = [
  { key: 'agendamentos', label: 'Agend.' },
  { key: 'comparecimentos', label: 'Compar.' },
]

const zero = (): Valor => ({ leads: 0, agendamentos: 0, comparecimentos: 0, observacao: '' })

export function SdrLancamento({
  data,
  lojas,
  valoresIniciais,
  leadsRecebidosInicial,
  validado,
  podeValidar,
  podeEditar,
  salvarAction,
  validarAction,
}: {
  data: string
  lojas: Loja[]
  valoresIniciais: Record<string, Valor>
  leadsRecebidosInicial: number
  validado: boolean
  podeValidar: boolean
  podeEditar: boolean
  salvarAction: (formData: FormData) => void
  validarAction: (formData: FormData) => void
}) {
  const [valores, setValores] = useState<Record<string, Valor>>(() => {
    const v: Record<string, Valor> = {}
    for (const loja of lojas) for (const c of loja.consultores) v[c.id] = valoresIniciais[c.id] ?? zero()
    return v
  })
  const [leadsRecebidos, setLeadsRecebidos] = useState<number>(leadsRecebidosInicial)

  const set = (cid: string, key: 'agendamentos' | 'comparecimentos', raw: string) => {
    const n = Math.max(0, Math.trunc(Number(raw) || 0))
    setValores((prev) => ({ ...prev, [cid]: { ...prev[cid], [key]: n } }))
  }

  const setObservacao = (cid: string, raw: string) => {
    setValores((prev) => ({ ...prev, [cid]: { ...(prev[cid] ?? zero()), observacao: raw } }))
  }

  const subtotais = useMemo(() => {
    const porLoja: Record<string, Valor> = {}
    const geral = zero()
    for (const loja of lojas) {
      const s = zero()
      for (const c of loja.consultores) {
        const v = valores[c.id] ?? zero()
        s.leads += v.leads; s.agendamentos += v.agendamentos; s.comparecimentos += v.comparecimentos
      }
      porLoja[loja.id] = s
      geral.leads += s.leads; geral.agendamentos += s.agendamentos; geral.comparecimentos += s.comparecimentos
    }
    return { porLoja, geral }
  }, [valores, lojas])

  const linhasJson = useMemo(() => {
    const linhas = lojas.flatMap((loja) =>
      loja.consultores.map((c) => ({ consultor_id: c.id, unidade_id: loja.id, ...(valores[c.id] ?? zero()) }))
    )
    return JSON.stringify(linhas)
  }, [valores, lojas])

  const totalPill = (v: Valor) => (
    <span className="flex gap-3 text-[.72rem] font-bold tabular-nums">
      <span className="text-white">{v.agendamentos} ag.</span>
      <span className="text-[var(--success)]">{v.comparecimentos} comp.</span>
    </span>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Leads recebidos (empresa) — número único do dia, preenchido pela SDR. */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[.8rem] font-extrabold uppercase tracking-wide text-white">Leads recebidos (empresa)</p>
            <p className="text-[.66rem] normal-case text-[var(--text-muted)]">Total de leads que a equipe recebeu no dia.</p>
          </div>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            disabled={!podeEditar}
            value={leadsRecebidos}
            onChange={(e) => setLeadsRecebidos(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
            aria-label="Total de leads recebidos"
            className="text-center font-extrabold"
            style={{ width: '7rem', flex: '0 0 auto', fontSize: '1.1rem' }}
          />
        </div>
      </div>

      {/* Total geral fixo no topo */}
      <div className="rounded-2xl border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[.8rem] font-extrabold uppercase tracking-wide text-white">Total da empresa</span>
          <span className="flex gap-4 text-[.95rem] font-extrabold tabular-nums">
            <span className="text-white">{subtotais.geral.agendamentos} agend.</span>
            <span className="text-[var(--success)]">{subtotais.geral.comparecimentos} compar.</span>
          </span>
        </div>
      </div>

      {lojas.map((loja) => (
        <div key={loja.id}>
          <div className="sec-header">
            <div className="sec-title">{loja.nome}</div>
            {totalPill(subtotais.porLoja[loja.id] ?? zero())}
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {loja.consultores.length === 0 ? (
              <div className="empty-state">Sem consultores nesta loja.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[.8rem]">
                  <thead>
                    <tr className="text-left text-[.64rem] uppercase tracking-wide text-[var(--text-muted)]">
                      <th className="px-4 py-2 font-bold">Consultor</th>
                      {CAMPOS.map((c) => (
                        <th key={c.key} className="px-2 py-2 text-center font-bold">{c.label}</th>
                      ))}
                      <th className="px-2 py-2 text-left font-bold">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loja.consultores.map((c) => (
                      <tr key={c.id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2 font-semibold text-white">{c.nome}</td>
                        {CAMPOS.map((campo) => (
                          <td key={campo.key} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              disabled={!podeEditar}
                              value={valores[c.id]?.[campo.key] ?? 0}
                              onChange={(e) => set(c.id, campo.key, e.target.value)}
                              aria-label={`${campo.label} de ${c.nome}`}
                              className="text-center"
                              style={{ width: '4.5rem', flex: '0 0 auto' }}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            disabled={!podeEditar}
                            value={valores[c.id]?.observacao ?? ''}
                            onChange={(e) => setObservacao(c.id, e.target.value)}
                            placeholder="Ex: trocou de consultor, não compareceu..."
                            aria-label={`Observação de ${c.nome}`}
                            style={{ minWidth: '180px' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        {podeEditar && (
          <form action={salvarAction}>
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="linhas" value={linhasJson} />
            <input type="hidden" name="leads_recebidos" value={leadsRecebidos} />
            <button type="submit" className="btn btn-red">Salvar lançamento</button>
          </form>
        )}
        {podeValidar && (
          <form action={validarAction}>
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="desvalidar" value={validado ? '1' : '0'} />
            <button type="submit" className={`btn ${validado ? 'btn-outline' : 'btn-red'}`}>
              {validado ? 'Desfazer validação' : 'Validar dia'}
            </button>
          </form>
        )}
        {validado && (
          <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-[.72rem] font-bold text-[var(--success)]">
            ✓ Dia validado
          </span>
        )}
      </div>
    </div>
  )
}
