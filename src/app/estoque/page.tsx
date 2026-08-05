import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ToggleGroup } from '@/components/ToggleGroup'
import { statusLabel, statusBadgeClass, cambioLabel, ehMoto } from '@/lib/veiculos'
import { deleteVeiculo } from './actions'
import { podeVerTudo } from '@/lib/membros'

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

function GrupoHeader({ titulo, total }: { titulo: string; total: number }) {
  return (
    <tr className="border-t border-[var(--border)] bg-white/[.03]">
      <td colSpan={13} className="px-2 py-1.5 text-[.68rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
        {titulo} ({total})
      </td>
    </tr>
  )
}

function VeiculoRow({ veiculo, canEdit }: { veiculo: Veiculo; canEdit: boolean }) {
  // Blindado é nullable de propósito (89 registros sem informação): "—"
  // distingue "não sei" de "não é".
  const simNao = (v: boolean | null) => (v === null ? '—' : v ? 'Sim' : 'Não')
  return (
    <tr className="border-t border-[var(--border)] hover:bg-white/[.02]">
      <td className="px-2 py-2.5 font-semibold text-white">
        {veiculo.marca} {veiculo.modelo}
      </td>
      <td className="px-2 py-2.5 normal-case text-[var(--text-muted)]">{cambioLabel[veiculo.cambio]}</td>
      <td className="px-2 py-2.5 text-[var(--text-muted)]">{veiculo.gnv ? 'Sim' : 'Não'}</td>
      <td className="px-2 py-2.5 text-[var(--text-muted)]">{simNao(veiculo.blindado)}</td>
      <td className="px-2 py-2.5 normal-case text-[var(--text-muted)]">{veiculo.cor ?? '—'}</td>
      <td className="px-2 py-2.5 text-[var(--text-muted)]">{veiculo.ano ?? '—'}</td>
      <td className="px-2 py-2.5 text-white">{veiculo.placa ?? '—'}</td>
      <td className="px-2 py-2.5 text-[var(--text-muted)]">{veiculo.no_site ? 'Sim' : 'Não'}</td>
      <td className="px-2 py-2.5 text-[var(--text-muted)]">{veiculo.licenciado_ate ?? '—'}</td>
      <td className="px-2 py-2.5 normal-case text-[var(--text-muted)]">{veiculo.unidades?.nome ?? '—'}</td>
      <td className="px-2 py-2.5">
        <span className={`badge ${statusBadgeClass[veiculo.status]}`}>{statusLabel[veiculo.status]}</span>
      </td>
      <td
        className="max-w-[150px] truncate px-2 py-2.5 normal-case text-[var(--text-muted)]"
        title={veiculo.observacao ?? undefined}
      >
        {veiculo.observacao ?? '—'}
      </td>
      <td className="px-2 py-2.5 text-right">
        <div className="flex items-center justify-end gap-3">
          {canEdit ? (
            <>
              <Link href={`/estoque/${veiculo.id}`} className="font-bold text-[var(--text-muted)] hover:text-white">
                Editar
              </Link>
              <form action={deleteVeiculo}>
                <input type="hidden" name="id" value={veiculo.id} />
                <ConfirmButton
                  className="font-bold text-[var(--danger)] hover:underline"
                  confirmMessage={`Remover ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa ?? 'sem placa'}) do estoque?`}
                >
                  Excluir
                </ConfirmButton>
              </form>
            </>
          ) : (
            <Link href={`/estoque/${veiculo.id}`} className="text-[var(--text-muted)] hover:text-white">
              Ver
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}

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
  const verTudo = podeVerTudo(profile?.cargo)
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

  // Separador visual carro/moto — o cadastro não tem um campo "tipo", então
  // classifica pela mesma heurística de marca/modelo usada no cálculo de
  // comissão (ehMoto), sem precisar de coluna nova nem de digitar de novo.
  const carros = veiculos.filter((v) => !ehMoto(v.marca, v.modelo))
  const motos = veiculos.filter((v) => ehMoto(v.marca, v.modelo))

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="estoque"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-[1700px]">
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
              // Tabela em linha, como o estoque do sistema antigo. Usa
              // .table-wrap (não a utility overflow-x-auto do Tailwind) porque
              // .sec-body tem overflow:hidden — e só .table-wrap, definido
              // depois no CSS, consegue reativar o overflow-x:auto. Assim a
              // tabela rola dentro do container e o Status não é cortado.
              <div className="sec-body table-wrap" style={{ padding: 0 }}>
                <table className="w-full whitespace-nowrap text-[.78rem]">
                  <thead>
                    <tr className="text-left text-[.66rem] uppercase tracking-wide text-[var(--text-muted)]">
                      <th className="px-2 py-2 font-bold">Marca/Modelo</th>
                      <th className="px-2 py-2 font-bold">Câmbio</th>
                      <th className="px-2 py-2 font-bold">GNV</th>
                      <th className="px-2 py-2 font-bold">Blindado</th>
                      <th className="px-2 py-2 font-bold">Cor</th>
                      <th className="px-2 py-2 font-bold">Ano</th>
                      <th className="px-2 py-2 font-bold">Placa</th>
                      <th className="px-2 py-2 font-bold">No site</th>
                      <th className="px-2 py-2 font-bold">Licenciado</th>
                      <th className="px-2 py-2 font-bold">Unidade</th>
                      <th className="px-2 py-2 font-bold">Status</th>
                      <th className="px-2 py-2 font-bold">Obs</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {carros.length > 0 && (
                      <>
                        <GrupoHeader titulo="🚗 Carros" total={carros.length} />
                        {carros.map((veiculo) => (
                          <VeiculoRow
                            key={veiculo.id}
                            veiculo={veiculo}
                            canEdit={isAdmin || veiculo.unidade_id === profile?.unidade_id}
                          />
                        ))}
                      </>
                    )}
                    {motos.length > 0 && (
                      <>
                        <GrupoHeader titulo="🏍️ Motos" total={motos.length} />
                        {motos.map((veiculo) => (
                          <VeiculoRow
                            key={veiculo.id}
                            veiculo={veiculo}
                            canEdit={isAdmin || veiculo.unidade_id === profile?.unidade_id}
                          />
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
