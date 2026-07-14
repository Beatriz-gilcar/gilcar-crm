import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
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
  placa: string
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
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <div className="sec-header">
            <div className="sec-title">Estoque</div>
            <Link href="/estoque/new" className="btn btn-red btn-sm">
              + Novo Veículo
            </Link>
          </div>
          <div className="sec-body sec-pad">
            {error && (
              <p className="mb-3 rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                {error}
              </p>
            )}
            <form className="filtros" method="get">
              <select name="unidade_id" defaultValue={unidade_id ?? ''}>
                <option value="">Todas as unidades</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
              <select name="status" defaultValue={status ?? ''}>
                <option value="">Todos status</option>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input name="busca" type="text" placeholder="Marca, modelo ou placa" defaultValue={busca ?? ''} />
              <button type="submit" className="btn btn-outline btn-sm">
                Filtrar
              </button>
            </form>
          </div>
          <div className="sec-body table-wrap" style={{ padding: 0 }}>
            {veiculos.length === 0 ? (
              <div className="empty-state">Nenhum veículo encontrado.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Marca/Modelo</th>
                    <th>Câmbio</th>
                    <th>GNV</th>
                    <th>Blindado</th>
                    <th>Cor</th>
                    <th>Ano</th>
                    <th>Placa</th>
                    <th>No Site</th>
                    <th>Licenciado</th>
                    <th>Status</th>
                    <th>Obs</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {veiculos.map((veiculo) => {
                    const canEdit = isAdmin || veiculo.unidade_id === profile?.unidade_id
                    return (
                      <tr key={veiculo.id}>
                        <td className="normal-case text-white">
                          {veiculo.marca} {veiculo.modelo}
                          <span className="block text-[.68rem] text-[var(--text-muted)]">
                            {veiculo.unidades?.nome ?? '—'}
                          </span>
                        </td>
                        <td>{cambioLabel[veiculo.cambio]}</td>
                        <td>{veiculo.gnv ? 'Sim' : 'Não'}</td>
                        <td>
                          {veiculo.blindado === true ? 'Sim' : veiculo.blindado === false ? 'Não' : '—'}
                        </td>
                        <td className="normal-case">{veiculo.cor ?? '—'}</td>
                        <td>{veiculo.ano ?? '—'}</td>
                        <td className="normal-case">{veiculo.placa}</td>
                        <td>{veiculo.no_site ? 'Sim' : 'Não'}</td>
                        <td>{veiculo.licenciado_ate ?? '—'}</td>
                        <td>
                          <span className={`badge ${statusBadgeClass[veiculo.status]}`}>
                            {statusLabel[veiculo.status]}
                          </span>
                        </td>
                        <td
                          className="max-w-[160px] truncate normal-case text-[var(--text-muted)]"
                          title={veiculo.observacao ?? ''}
                        >
                          {veiculo.observacao ?? '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            {canEdit ? (
                              <>
                                <Link
                                  href={`/estoque/${veiculo.id}`}
                                  className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white"
                                  aria-label="Editar veículo"
                                >
                                  Editar
                                </Link>
                                <form action={deleteVeiculo}>
                                  <input type="hidden" name="id" value={veiculo.id} />
                                  <ConfirmButton
                                    className="text-[.72rem] font-bold text-[var(--red)] hover:underline"
                                    confirmMessage={`Remover ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa}) do estoque?`}
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
                                Ver
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
