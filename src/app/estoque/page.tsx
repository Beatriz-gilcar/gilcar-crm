import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ToggleGroup } from '@/components/ToggleGroup'
import { statusLabel, statusBadgeClass, cambioLabel } from '@/lib/veiculos'
import { deleteVeiculo } from './actions'

type Veiculo = {
  id: string
  marca: string
  modelo: string
  cambio: string
  gnv: boolean
  blindado: boolean | null
  cor: string | null
  ano: string | null
  placa: string | null
  licenciado_ate: number | null
  no_site: boolean
  status: string
  observacao: string | null
  unidade_id: string
  unidades: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; unidade_id?: string; busca?: string; error?: string }>
}) {
  const { status, unidade_id, busca, error } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo, unidade_id')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const isAdmin = profile?.cargo === 'admin'

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  const [{ count: total }, { count: disponiveis }, { count: reservados }, { count: vendidos }] =
    await Promise.all([
      supabase.from('veiculos').select('*', { count: 'exact', head: true }),
      supabase.from('veiculos').select('*', { count: 'exact', head: true }).eq('status', 'disponivel'),
      supabase.from('veiculos').select('*', { count: 'exact', head: true }).eq('status', 'reservado'),
      supabase.from('veiculos').select('*', { count: 'exact', head: true }).eq('status', 'vendido'),
    ])

  let query = supabase
    .from('veiculos')
    .select(
      'id, marca, modelo, cambio, gnv, blindado, cor, ano, placa, licenciado_ate, no_site, status, observacao, unidade_id, unidades(nome)'
    )
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (unidade_id) query = query.eq('unidade_id', unidade_id)
  if (busca) {
    const termo = `%${busca}%`
    query = query.or(`marca.ilike.${termo},modelo.ilike.${termo},placa.ilike.${termo}`)
  }

  const { data: veiculosData } = await query.overrideTypes<Veiculo[]>()
  const veiculos = veiculosData ?? []

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="estoque"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Total em estoque</div>
              <div className="kpi-val">{total ?? 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Disponíveis</div>
              <div className="kpi-val">{disponiveis ?? 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Reservados</div>
              <div className="kpi-val">{reservados ?? 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Vendidos</div>
              <div className="kpi-val">{vendidos ?? 0}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Estoque
            </div>
            <Link href="/estoque/new" className="btn btn-red btn-sm">
              + Novo Veículo
            </Link>
          </div>

          <div className="card sec-pad mt-3">
            {error && (
              <p className="mb-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
                {error}
              </p>
            )}
            <form className="flex flex-col gap-3" method="get">
              <div className="filtros">
                <div className="search-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input name="busca" type="text" placeholder="Marca, modelo ou placa" defaultValue={busca ?? ''} />
                </div>
                <button type="submit" className="btn btn-outline btn-sm">
                  Filtrar
                </button>
              </div>

              <div className="chip-row">
                <ToggleGroup
                  name="unidade_id"
                  defaultValue={unidade_id ?? ''}
                  options={[{ value: '', label: 'Todas as unidades' }, ...unidades.map((u) => ({ value: u.id, label: u.nome }))]}
                />
              </div>
              <div className="chip-row">
                <ToggleGroup
                  name="status"
                  defaultValue={status ?? ''}
                  options={[
                    { value: '', label: 'Todos status' },
                    ...Object.entries(statusLabel).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
            </form>
          </div>

          <div className="mt-4">
            {veiculos.length === 0 ? (
              <div className="card empty-state">Nenhum veículo encontrado.</div>
            ) : (
              <div className="item-grid">
                {veiculos.map((veiculo) => {
                  const canEdit = isAdmin || veiculo.unidade_id === profile?.unidade_id
                  return (
                    <div key={veiculo.id} className="item-card">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-white">
                            {veiculo.marca} {veiculo.modelo}
                          </p>
                          <p className="text-[.7rem] normal-case text-[var(--text-muted)]">
                            {veiculo.ano ? `${veiculo.ano} · ` : ''}
                            {veiculo.placa ?? 'sem placa'}
                          </p>
                        </div>
                        <span className={`badge ${statusBadgeClass[veiculo.status]}`}>
                          {statusLabel[veiculo.status]}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <span className="badge badge-enviado">{cambioLabel[veiculo.cambio]}</span>
                        {veiculo.gnv && <span className="badge badge-enviado">GNV</span>}
                        {veiculo.blindado && <span className="badge badge-enviado">Blindado</span>}
                        {veiculo.no_site && <span className="badge badge-aprovado">No site</span>}
                      </div>

                      <p className="text-[.75rem] normal-case text-[var(--text-muted)]">
                        {veiculo.cor ? `${veiculo.cor} · ` : ''}
                        {veiculo.unidades?.nome ?? 'sem unidade'}
                        {veiculo.licenciado_ate ? ` · licenciado até ${veiculo.licenciado_ate}` : ''}
                      </p>

                      {veiculo.observacao && (
                        <p className="truncate text-[.72rem] normal-case text-[var(--text-muted)]" title={veiculo.observacao}>
                          {veiculo.observacao}
                        </p>
                      )}

                      <div className="mt-1 flex items-center gap-3 border-t border-[var(--border)] pt-3">
                        {canEdit ? (
                          <>
                            <Link
                              href={`/estoque/${veiculo.id}`}
                              className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white"
                            >
                              Editar
                            </Link>
                            <form action={deleteVeiculo}>
                              <input type="hidden" name="id" value={veiculo.id} />
                              <ConfirmButton
                                className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                                confirmMessage={`Remover ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa ?? 'sem placa'}) do estoque?`}
                              >
                                Excluir
                              </ConfirmButton>
                            </form>
                          </>
                        ) : (
                          <Link
                            href={`/estoque/${veiculo.id}`}
                            className="text-[.72rem] text-[var(--text-muted)] hover:text-white"
                          >
                            Ver detalhes
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
