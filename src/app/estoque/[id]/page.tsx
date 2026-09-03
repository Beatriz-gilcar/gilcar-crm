import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { ConfirmButton } from '@/components/ConfirmButton'
import { statusLabel } from '@/lib/veiculos'
import { updateVeiculo, deleteVeiculo, marcarRenaveEntrada, desmarcarRenaveEntrada } from '../actions'
import { podeVerTudo, isGerenciaCargo } from '@/lib/membros'

type VeiculoDetail = {
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
  renave_entrada_registrado: boolean
  renave_entrada_em: string | null
}

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }

export default async function VeiculoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
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
  // Gerência (gerente/supervisor) sem o admin: edita qualquer veículo, de
  // qualquer unidade, igual admin. isGerenciaCargo() inclui admin, então
  // tira ele fora aqui pra não contar duas vezes.
  const isGerenciaSemAdmin = isGerenciaCargo(profile?.cargo) && !isAdmin

  const { data: veiculo } = await supabase
    .from('veiculos')
    .select(
      'id, marca, modelo, cambio, gnv, blindado, cor, ano, placa, licenciado_ate, no_site, status, observacao, unidade_id, unidades(nome), renave_entrada_registrado, renave_entrada_em'
    )
    .eq('id', id)
    .single<VeiculoDetail>()

  if (!veiculo) {
    notFound()
  }

  // Edição completa: admin ou gerência (qualquer veículo, qualquer unidade),
  // ou consultor na própria unidade — espelha a policy do banco.
  const podeEditarCompleto =
    isAdmin || isGerenciaSemAdmin || (profile?.cargo === 'consultor' && veiculo.unidade_id === profile?.unidade_id)
  // Poder extra da gerência (e do admin): pode mudar a unidade do veículo
  // (transferir), coisa que consultor não faz.
  const podeTransferirUnidade = isAdmin || isGerenciaSemAdmin

  let unidades: Unidade[] = []
  if (podeTransferirUnidade) {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome')
    unidades = data ?? []
  }

  const blindadoDefault = veiculo.blindado === true ? 'sim' : veiculo.blindado === false ? 'nao' : 'indefinido'

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="estoque"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <Link href="/estoque" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Estoque
          </Link>

          {!podeEditarCompleto ? (
            <div className="mt-2">
              <div className="sec-header">
                <div className="sec-title">
                  {veiculo.marca} {veiculo.modelo}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${veiculo.renave_entrada_registrado ? 'badge-aprovado' : 'badge-rejeitado'}`}>
                    {veiculo.renave_entrada_registrado ? 'Renave OK' : 'Renave pendente'}
                  </span>
                  <span className={`badge badge-enviado`}>{statusLabel[veiculo.status]}</span>
                </div>
              </div>
              <div className="sec-body sec-pad flex flex-col gap-1 text-[.82rem] normal-case text-white">
                <p>Placa: {veiculo.placa ?? '—'}</p>
                <p>Câmbio: {veiculo.cambio === 'manual' ? 'Manual' : 'Automático'}</p>
                <p>Ano: {veiculo.ano ?? '—'}</p>
                <p>Cor: {veiculo.cor ?? '—'}</p>
                <p>GNV: {veiculo.gnv ? 'Sim' : 'Não'}</p>
                <p>Blindado: {veiculo.blindado === true ? 'Sim' : veiculo.blindado === false ? 'Não' : 'Não informado'}</p>
                <p>Licenciado até: {veiculo.licenciado_ate ?? '—'}</p>
                <p>No site: {veiculo.no_site ? 'Sim' : 'Não'}</p>
                <p>Unidade: {veiculo.unidades?.nome ?? '—'}</p>
                {veiculo.observacao && <p>Obs: {veiculo.observacao}</p>}
                <p className="mt-2 text-[.72rem] text-[var(--text-muted)]">
                  Você não tem permissão para editar este veículo.
                </p>
              </div>
            </div>
          ) : (
            <form action={updateVeiculo} className="mt-2">
              <div className="sec-header">
                <div className="sec-title">Editar veículo</div>
                <span className={`badge ${veiculo.renave_entrada_registrado ? 'badge-aprovado' : 'badge-rejeitado'}`}>
                  {veiculo.renave_entrada_registrado ? 'Renave OK' : 'Renave pendente'}
                </span>
              </div>
              <div className="sec-body sec-pad flex flex-col gap-3">
                {error && (
                  <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                    {error}
                  </p>
                )}

                <input type="hidden" name="id" value={veiculo.id} />

                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Marca</label>
                    <input name="marca" type="text" required defaultValue={veiculo.marca} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Modelo</label>
                    <input name="modelo" type="text" required defaultValue={veiculo.modelo} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Câmbio</label>
                  <ToggleGroup
                    name="cambio"
                    defaultValue={veiculo.cambio}
                    options={[
                      { value: 'manual', label: 'Manual' },
                      { value: 'automatico', label: 'Automático' },
                    ]}
                  />
                </div>

                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>GNV</label>
                    <ToggleGroup
                      name="gnv"
                      defaultValue={veiculo.gnv ? 'sim' : 'nao'}
                      options={[
                        { value: 'sim', label: 'Sim' },
                        { value: 'nao', label: 'Não' },
                      ]}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Blindado</label>
                    <ToggleGroup
                      name="blindado"
                      defaultValue={blindadoDefault}
                      options={[
                        { value: 'sim', label: 'Sim' },
                        { value: 'nao', label: 'Não' },
                        { value: 'indefinido', label: 'Não informado' },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Cor</label>
                    <input name="cor" type="text" defaultValue={veiculo.cor ?? ''} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Ano</label>
                    <input name="ano" type="text" placeholder="2023/2024" defaultValue={veiculo.ano ?? ''} />
                  </div>
                </div>

                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Placa</label>
                    <input name="placa" type="text" className="uppercase" defaultValue={veiculo.placa ?? ''} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Licenciado até</label>
                    <input
                      name="licenciado_ate"
                      type="number"
                      min="1900"
                      max="2100"
                      defaultValue={veiculo.licenciado_ate ?? ''}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>No site</label>
                  <ToggleGroup
                    name="no_site"
                    defaultValue={veiculo.no_site ? 'sim' : 'nao'}
                    options={[
                      { value: 'sim', label: 'Sim' },
                      { value: 'nao', label: 'Não' },
                    ]}
                  />
                </div>

                {podeTransferirUnidade ? (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Unidade</label>
                    <select name="unidade_id" required defaultValue={veiculo.unidade_id}>
                      {unidades.map((unidade) => (
                        <option key={unidade.id} value={unidade.id}>
                          {unidade.nome}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
                      Mudar aqui transfere o veículo pro estoque da outra unidade.
                    </p>
                  </div>
                ) : (
                  <input type="hidden" name="unidade_id" value={veiculo.unidade_id} />
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Status</label>
                  <ToggleGroup
                    name="status"
                    defaultValue={veiculo.status}
                    options={[
                      { value: 'disponivel', label: 'Disponível' },
                      { value: 'reservado', label: 'Reservado' },
                      { value: 'vendido', label: 'Vendido' },
                    ]}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Manutenção / Observação</label>
                  <textarea name="observacao" rows={2} defaultValue={veiculo.observacao ?? ''} />
                </div>

                <div className="mt-1 flex items-center gap-3">
                  <button type="submit" className="btn btn-red self-start">
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          )}

          {podeEditarCompleto && (
            <div className="mt-3">
              <div className="sec-header">
                <div className="sec-title">Registro Renave (entrada)</div>
              </div>
              <div className="sec-body sec-pad flex flex-wrap items-center justify-between gap-3">
                <p className="text-[.78rem] normal-case text-[var(--text-muted)]">
                  {veiculo.renave_entrada_registrado
                    ? `Registrado${veiculo.renave_entrada_em ? ` em ${new Date(`${veiculo.renave_entrada_em}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}.`
                    : 'Ainda não registrado no Renave.'}
                </p>
                {veiculo.renave_entrada_registrado ? (
                  <form action={desmarcarRenaveEntrada}>
                    <input type="hidden" name="id" value={veiculo.id} />
                    <button type="submit" className="btn btn-outline btn-sm">
                      Desmarcar
                    </button>
                  </form>
                ) : (
                  <form action={marcarRenaveEntrada}>
                    <input type="hidden" name="id" value={veiculo.id} />
                    <button type="submit" className="btn btn-red btn-sm">
                      Marcar registro Renave feito
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {podeEditarCompleto && (
            <form action={deleteVeiculo} className="mt-3">
              <input type="hidden" name="id" value={veiculo.id} />
              <ConfirmButton
                className="text-[.72rem] font-bold text-[var(--red)] hover:underline"
                confirmMessage={`Remover ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa ?? 'sem placa'}) do estoque?`}
              >
                Remover veículo
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
