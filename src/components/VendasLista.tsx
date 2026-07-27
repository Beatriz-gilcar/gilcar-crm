'use client'

import { useMemo, useState } from 'react'
import { ConfirmButton } from '@/components/ConfirmButton'
import { statusLabel, statusBadgeClass } from '@/lib/metas'

type Venda = {
  id: string
  numero: number
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  status: string
  enviado_autocerto: boolean
  consultorNome: string
}

export function VendasLista({
  vendas,
  isAdmin,
  isGerencia,
  mes,
  toggleVendaStatus,
  toggleVendaAutocerto,
  deleteVenda,
}: {
  vendas: Venda[]
  isAdmin: boolean
  isGerencia: boolean
  mes: string
  toggleVendaStatus: (formData: FormData) => void
  toggleVendaAutocerto: (formData: FormData) => void
  deleteVenda: (formData: FormData) => void
}) {
  const [busca, setBusca] = useState('')

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return vendas
    return vendas.filter((v) => v.consultorNome.toLowerCase().includes(termo))
  }, [vendas, busca])

  return (
    <>
      <div className="mt-6">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por consultor..."
          className="w-full sm:max-w-xs"
        />
      </div>

      <div className="sec-body mt-3" style={{ padding: 0 }}>
        {vendasFiltradas.length === 0 ? (
          <div className="empty-state">
            {busca ? 'Nenhuma venda encontrada para esse consultor.' : `Nenhuma venda lançada em ${mes}.`}
          </div>
        ) : (
          <div className="flex flex-col">
            {vendasFiltradas.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
              >
                <div>
                  <p className="normal-case text-white">
                    <span className="mr-2 text-[.68rem] text-[var(--text-muted)]">#{v.numero}</span>
                    {v.veiculo_marca} {v.veiculo_modelo}
                    {v.veiculo_placa ? ` · ${v.veiculo_placa}` : ''}
                  </p>
                  <p className="text-[.78rem] normal-case font-semibold text-white">{v.consultorNome}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${statusBadgeClass[v.status]}`}>{statusLabel[v.status]}</span>
                  {v.status === 'ativa' && (
                    <span className={`badge ${v.enviado_autocerto ? 'badge-aprovado' : 'badge-pendente'}`}>
                      {v.enviado_autocerto ? 'No Autocerto' : 'Falta Autocerto'}
                    </span>
                  )}
                  {isGerencia && v.status === 'ativa' && (
                    <form action={toggleVendaAutocerto}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="enviado_atual" value={v.enviado_autocerto ? '1' : '0'} />
                      <button type="submit" className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white">
                        {v.enviado_autocerto ? 'Desmarcar' : 'Marcar Autocerto'}
                      </button>
                    </form>
                  )}
                  {isAdmin && (
                    <form action={toggleVendaStatus}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="status_atual" value={v.status} />
                      <button type="submit" className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white">
                        {v.status === 'ativa' ? 'Marcar caída' : 'Reativar'}
                      </button>
                    </form>
                  )}
                  {isAdmin && (
                    <form action={deleteVenda}>
                      <input type="hidden" name="id" value={v.id} />
                      <ConfirmButton
                        className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                        confirmMessage={`Excluir a venda #${v.numero} definitivamente? Use só pra corrigir erro de digitação.`}
                      >
                        Excluir
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
