import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { ConfirmButton } from '@/components/ConfirmButton'
import { podeVerTudo, podeEditarPosVenda } from '@/lib/membros'
import { posVendaStatusLabel, posVendaStatusBadgeClass } from '@/lib/pos_venda'
import { deletePosVenda } from './actions'

type PosVenda = {
  id: string
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  status: string
  prestador: string | null
  entrega_em: string | null
  revisao_em: string | null
  unidades: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }

function dataBR(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

export default async function PosVendaPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>
}) {
  const { busca, status } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'
  const podeEditar = podeEditarPosVenda(profile?.cargo)

  let query = supabase
    .from('pos_venda')
    .select(
      'id, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, status, prestador, entrega_em, revisao_em, unidades(nome)'
    )
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (busca) {
    const termo = `%${busca}%`
    query = query.or(
      `cliente_nome.ilike.${termo},veiculo_marca.ilike.${termo},veiculo_modelo.ilike.${termo},veiculo_placa.ilike.${termo},prestador.ilike.${termo}`
    )
  }

  const { data: registrosData } = await query.overrideTypes<PosVenda[]>()
  const registros = registrosData ?? []

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="pos-venda"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Pós-venda
            </div>
            {podeEditar && (
              <Link href="/pos-venda/new" className="btn btn-red btn-sm">
                + Novo registro
              </Link>
            )}
          </div>

          <div className="card sec-pad mt-3">
            <form className="flex flex-col gap-3" method="get">
              <div className="filtros">
                <div className="search-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input name="busca" type="text" placeholder="Cliente, veículo, placa ou prestador" defaultValue={busca ?? ''} />
                </div>
                <button type="submit" className="btn btn-outline btn-sm">
                  Filtrar
                </button>
              </div>
              <div className="chip-row">
                <ToggleGroup
                  name="status"
                  defaultValue={status ?? ''}
                  options={[
                    { value: '', label: 'Todos status' },
                    ...Object.entries(posVendaStatusLabel).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
            </form>
          </div>

          <div className="sec-body mt-4" style={{ padding: 0 }}>
            {registros.length === 0 ? (
              <div className="empty-state">Nenhum registro de pós-venda encontrado.</div>
            ) : (
              <div className="flex flex-col">
                {registros.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                  >
                    <div>
                      <p className="font-semibold text-white">{r.cliente_nome}</p>
                      <p className="text-[.72rem] text-[var(--text-muted)]">
                        {r.veiculo_marca} {r.veiculo_modelo}
                        {r.veiculo_placa ? ` · ${r.veiculo_placa}` : ''}
                        {r.unidades?.nome ? ` · ${r.unidades.nome}` : ''}
                        {r.prestador ? ` · Em: ${r.prestador}` : ''}
                      </p>
                      <p className="text-[.68rem] text-[var(--text-muted)]">
                        Entrega: {dataBR(r.entrega_em)} · Revisão: {dataBR(r.revisao_em)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge ${posVendaStatusBadgeClass[r.status]}`}>
                        {posVendaStatusLabel[r.status]}
                      </span>
                      <Link
                        href={`/pos-venda/${r.id}`}
                        className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white"
                      >
                        {podeEditar ? 'Editar' : 'Ver'}
                      </Link>
                      {podeEditar && (
                        <form action={deletePosVenda}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmButton
                            className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                            confirmMessage={`Excluir o registro de pós-venda de ${r.cliente_nome} (${r.veiculo_marca} ${r.veiculo_modelo})?`}
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
        </div>
      </div>
    </>
  )
}
