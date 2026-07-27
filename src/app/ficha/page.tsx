import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { AtividadesDia } from '@/components/AtividadesDia'
import { TelefoneInput } from '@/components/TelefoneInput'
import { origemPresencialLabel, origemDigitalLabel } from '@/lib/atendimentos'
import { dataHoraBR } from '@/lib/datas'
import { atividadeCampos, type AtividadeCampo } from '@/lib/atividades'
import { podeVerTudo, isSomenteLeitura, isGerenciaCargo } from '@/lib/membros'
import {
  registrarAtendimento,
  excluirAtendimento,
  registrarDia,
  enviarParaAprovacao,
} from './actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }

type Atendimento = {
  id: string
  consultor_id?: string
  tipo: string
  cliente_nome: string | null
  celular: string | null
  veiculo_interesse: string | null
  cv: string | null
  fechou_negocio: boolean | null
  agendou_visita: boolean | null
  origem: string | null
  observacao: string | null
  data_atendimento: string
}

type Ficha = { status: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function FichaPage({
  searchParams,
}: {
  searchParams: Promise<{
    data?: string
    error?: string
    success?: string
    busca_de?: string
    busca_ate?: string
  }>
}) {
  const { data: dataParam, error, success, busca_de: buscaDe, busca_ate: buscaAte } = await searchParams
  const data = dataParam || hojeISO()
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
  const soLeitura = isSomenteLeitura(profile?.cargo)
  // Gerente/supervisor não preenche ficha — só pesquisa os atendimentos dos
  // consultores da própria unidade.
  const apenasBusca = isGerenciaCargo(profile?.cargo) && !isAdmin

  const idsUnidade: string[] = []
  const nomePorConsultor = new Map<string, string>()
  if (apenasBusca && profile?.unidade_id) {
    const { data: consultores } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('unidade_id', profile.unidade_id)
    for (const c of consultores ?? []) {
      idsUnidade.push(c.id)
      nomePorConsultor.set(c.id, c.nome)
    }
  }

  const inicio = `${data}T00:00:00Z`
  const fim = new Date(new Date(inicio).getTime() + 24 * 60 * 60 * 1000).toISOString()

  const [{ data: atendimentosData }, { data: ficha }, { data: atividades }] = await Promise.all([
    supabase
      .from('atendimentos')
      .select(
        'id, tipo, cliente_nome, celular, veiculo_interesse, cv, fechou_negocio, agendou_visita, origem, observacao, data_atendimento'
      )
      .eq('consultor_id', user.id)
      .gte('data_atendimento', inicio)
      .lt('data_atendimento', fim)
      .order('data_atendimento', { ascending: false })
      .overrideTypes<Atendimento[]>(),
    supabase
      .from('fichas_diarias')
      .select('status')
      .eq('consultor_id', user.id)
      .eq('data', data)
      .maybeSingle<Ficha>(),
    supabase
      .from('atividades_dia')
      .select(atividadeCampos.join(', '))
      .eq('consultor_id', user.id)
      .eq('data', data)
      .maybeSingle<Record<AtividadeCampo, number>>(),
  ])

  const atendimentos = atendimentosData ?? []

  // Buscador de atendimentos por intervalo (só os próprios). Independente do
  // dia da ficha; só roda quando a pessoa preenche de/até.
  const temBusca = Boolean(buscaDe || buscaAte)
  let resultadosBusca: Atendimento[] = []
  if (temBusca) {
    let q = supabase
      .from('atendimentos')
      .select(
        'id, consultor_id, tipo, cliente_nome, celular, veiculo_interesse, cv, fechou_negocio, agendou_visita, origem, observacao, data_atendimento'
      )
      .order('data_atendimento', { ascending: false })
    // Gerente: atendimentos dos consultores da unidade. Consultor: só os dele.
    q = apenasBusca
      ? q.in('consultor_id', idsUnidade.length ? idsUnidade : ['00000000-0000-0000-0000-000000000000'])
      : q.eq('consultor_id', user.id)
    if (buscaDe) q = q.gte('data_atendimento', new Date(`${buscaDe}T00:00:00-03:00`).toISOString())
    if (buscaAte) {
      const fimBusca = new Date(`${buscaAte}T00:00:00-03:00`)
      fimBusca.setDate(fimBusca.getDate() + 1)
      q = q.lt('data_atendimento', fimBusca.toISOString())
    }
    const { data: encontrados } = await q.overrideTypes<Atendimento[]>()
    resultadosBusca = encontrados ?? []
  }
  const presenciais = atendimentos.filter((a) => a.tipo === 'presencial')
  const digitais = atendimentos.filter((a) => a.tipo === 'digital')

  const valoresAtividades = Object.fromEntries(
    atividadeCampos.map((c) => [c, atividades?.[c] ?? 0])
  ) as Record<AtividadeCampo, number>

  const statusFicha = ficha?.status ?? null
  const jaEnviada = statusFicha === 'enviado' || statusFicha === 'aprovado'
  const bloqueado = soLeitura || jaEnviada

  const statusBadge: Record<string, { label: string; classe: string }> = {
    pendente: { label: 'Registrado', classe: 'badge-pendente' },
    enviado: { label: 'Enviado para aprovação', classe: 'badge-enviado' },
    aprovado: { label: 'Aprovado', classe: 'badge-aprovado' },
  }

  // Gerente/supervisor: tela só de busca (não preenche ficha).
  if (apenasBusca) {
    return (
      <>
        <Topbar
          nome={profile?.nome ?? user.email ?? ''}
          cargo={profile?.cargo ?? ''}
          verTudo={verTudo}
          isAdmin={isAdmin}
          active="ficha"
        />
        <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-2xl">
            <div className="sec-header">
              <div className="sec-title">Buscar atendimentos da unidade</div>
            </div>
            <div className="sec-body sec-pad">
              <form method="get" className="flex flex-wrap items-end gap-3">
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 160 }}>
                  <label>De</label>
                  <input type="date" name="busca_de" defaultValue={buscaDe ?? ''} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 160 }}>
                  <label>Até</label>
                  <input type="date" name="busca_ate" defaultValue={buscaAte ?? ''} />
                </div>
                <button type="submit" className="btn btn-red btn-sm">
                  Buscar
                </button>
              </form>

              {temBusca &&
                (resultadosBusca.length === 0 ? (
                  <p className="mt-4 text-[.78rem] text-[var(--text-muted)]">
                    Nenhum atendimento no período.
                  </p>
                ) : (
                  <>
                    <p className="mt-4 text-[.72rem] text-[var(--text-muted)]">
                      {resultadosBusca.length} atendimento{resultadosBusca.length === 1 ? '' : 's'}.
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {resultadosBusca.map((a) => (
                        <li key={a.id} className="border-t border-[var(--border)] pt-2 text-[.78rem]">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="text-[var(--text-muted)]">{dataHoraBR(a.data_atendimento)}</span>
                            <span className="font-semibold text-white">
                              {nomePorConsultor.get(a.consultor_id ?? '') ?? '—'}
                            </span>
                            <span className="badge badge-enviado">
                              {a.tipo === 'presencial' ? 'Presencial' : 'Digital'}
                            </span>
                            {a.tipo === 'presencial' && (
                              <span className={`badge ${a.fechou_negocio ? 'badge-aprovado' : 'badge-rejeitado'}`}>
                                {a.fechou_negocio ? 'Fechou' : 'Não fechou'}
                              </span>
                            )}
                            {a.tipo === 'digital' && (
                              <span className={`badge ${a.agendou_visita ? 'badge-aprovado' : 'badge-rejeitado'}`}>
                                {a.agendou_visita ? 'Agendou' : 'Não agendou'}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 normal-case text-white">
                            {a.cliente_nome ?? '—'}
                            {a.celular && <> · {a.celular}</>}
                            {a.veiculo_interesse && <> · {a.veiculo_interesse}</>}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="ficha"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {error && (
            <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
              {error}
            </p>
          )}
          {success === 'registrado' && (
            <p className="rounded-md bg-[#001600] px-3 py-2 text-[.78rem] normal-case text-[#2db82d]">
              Dia registrado. Confira e envie para aprovação.
            </p>
          )}
          {success === 'enviado' && (
            <p className="rounded-md bg-[#001600] px-3 py-2 text-[.78rem] normal-case text-[#2db82d]">
              Ficha enviada para aprovação.
            </p>
          )}

          {/* ── Registro do dia ─────────────────────────────────────────── */}
          <div>
            <div className="sec-header">
              <div className="sec-title">Registro do dia</div>
              {statusFicha && (
                <span className={`badge ${statusBadge[statusFicha]?.classe ?? 'badge-pendente'}`}>
                  {statusBadge[statusFicha]?.label ?? statusFicha}
                </span>
              )}
            </div>
            <div className="sec-body sec-pad">
              <form method="get" className="flex flex-wrap items-end gap-3">
                <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: 180 }}>
                  <label>Data</label>
                  <input type="date" name="data" defaultValue={data} />
                </div>
                <button type="submit" className="btn btn-outline btn-sm">
                  Trocar data
                </button>
              </form>
            </div>
          </div>

          {/* ── Buscar atendimentos por data (só os próprios) ───────────── */}
          <details className="mt-1">
            <summary className="cursor-pointer list-none text-[.9rem] font-extrabold uppercase tracking-wide text-[var(--text)]">
              🔎 Buscar meus atendimentos por data
            </summary>
            <div className="sec-body sec-pad mt-2">
              <form method="get" className="flex flex-wrap items-end gap-3">
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 160 }}>
                  <label>De</label>
                  <input type="date" name="busca_de" defaultValue={buscaDe ?? ''} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 160 }}>
                  <label>Até</label>
                  <input type="date" name="busca_ate" defaultValue={buscaAte ?? ''} />
                </div>
                <button type="submit" className="btn btn-outline btn-sm">
                  Buscar
                </button>
              </form>

              {temBusca &&
                (resultadosBusca.length === 0 ? (
                  <p className="mt-3 text-[.78rem] text-[var(--text-muted)]">
                    Nenhum atendimento seu no período.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-[.72rem] text-[var(--text-muted)]">
                      {resultadosBusca.length} atendimento{resultadosBusca.length === 1 ? '' : 's'} encontrado
                      {resultadosBusca.length === 1 ? '' : 's'}.
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {resultadosBusca.map((a) => (
                        <li key={a.id} className="border-t border-[var(--border)] pt-2 text-[.78rem]">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="text-[var(--text-muted)]">{dataHoraBR(a.data_atendimento)}</span>
                            <span className="badge badge-enviado">
                              {a.tipo === 'presencial' ? 'Presencial' : 'Digital'}
                            </span>
                            {a.tipo === 'presencial' && (
                              <span className={`badge ${a.fechou_negocio ? 'badge-aprovado' : 'badge-rejeitado'}`}>
                                {a.fechou_negocio ? 'Fechou' : 'Não fechou'}
                              </span>
                            )}
                            {a.tipo === 'digital' && (
                              <span className={`badge ${a.agendou_visita ? 'badge-aprovado' : 'badge-rejeitado'}`}>
                                {a.agendou_visita ? 'Agendou' : 'Não agendou'}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 normal-case text-white">
                            {a.cliente_nome ?? '—'}
                            {a.celular && <> · {a.celular}</>}
                            {a.veiculo_interesse && <> · {a.veiculo_interesse}</>}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                ))}
            </div>
          </details>

          {jaEnviada && (
            <p className="rounded-md bg-[#0f1830] px-3 py-2 text-[.75rem] normal-case text-[var(--text-muted)]">
              Esta ficha já foi enviada para aprovação. Para corrigir algo, peça ao seu gerente.
            </p>
          )}

          {/* ── Novo atendimento ────────────────────────────────────────── */}
          {!bloqueado && (
            <>
              <FormAtendimento tipo="presencial" data={data} />
              <FormAtendimento tipo="digital" data={data} />
            </>
          )}

          {/* ── Enviados hoje ───────────────────────────────────────────── */}
          <div>
            <div className="sec-header">
              <div className="sec-title">Atendimentos já enviados</div>
              <span className="badge badge-enviado">
                {presenciais.length} pres · {digitais.length} dig
              </span>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {atendimentos.length === 0 ? (
                <div className="empty-state">Nenhum atendimento enviado ainda.</div>
              ) : (
                <ul className="flex flex-col">
                  {atendimentos.map((a) => {
                    const origemLabel =
                      a.tipo === 'presencial'
                        ? origemPresencialLabel[a.origem ?? '']
                        : origemDigitalLabel[a.origem ?? '']

                    return (
                      <li
                        key={a.id}
                        className="flex items-start justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                      >
                        <div className="flex flex-col gap-1">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="badge badge-enviado">
                              {a.tipo === 'presencial' ? 'Presencial' : 'Digital'}
                            </span>
                            {a.fechou_negocio && <span className="badge badge-aprovado">Fechou</span>}
                            {a.agendou_visita && <span className="badge badge-pendente">Agendou</span>}
                          </p>
                          <p className="normal-case text-[.85rem] text-white">
                            {a.cliente_nome ?? '—'}
                            {a.celular && <> · {a.celular}</>}
                            {a.veiculo_interesse && <> · {a.veiculo_interesse}</>}
                          </p>
                          {(origemLabel || a.observacao) && (
                            <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
                              {origemLabel}
                              {origemLabel && a.observacao && ' · '}
                              {a.observacao}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {/* "Virou venda" leva os dados do atendimento pra uma
                              OS nova, como o converterEmVenda() do antigo. Fica
                              disponível mesmo com a ficha já enviada — a venda
                              pode fechar depois, e criar OS não altera a ficha. */}
                          <Link
                            href={`/ordens/new?${new URLSearchParams({
                              ...(a.cliente_nome ? { cliente: a.cliente_nome } : {}),
                              ...(a.celular ? { celular: a.celular } : {}),
                              ...(a.veiculo_interesse ? { veiculo: a.veiculo_interesse } : {}),
                            }).toString()}`}
                            className="btn btn-red btn-sm whitespace-nowrap"
                          >
                            → Virou venda
                          </Link>
                          {!bloqueado && (
                            <form action={excluirAtendimento}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="data" value={data} />
                              <ConfirmButton
                                className="btn btn-outline btn-sm"
                                confirmMessage={`Excluir o atendimento de ${a.cliente_nome ?? 'cliente'}?`}
                              >
                                Excluir
                              </ConfirmButton>
                            </form>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* ── Atividades + botões do dia ──────────────────────────────── */}
          <form action={registrarDia}>
            <input type="hidden" name="data" value={data} />
            <div className="sec-header">
              <div className="sec-title">Atividades do dia</div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              <AtividadesDia valores={valoresAtividades} somenteLeitura={bloqueado} />
            </div>

            {!bloqueado && (
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="submit" className="btn btn-red flex-1">
                  Registrar dia
                </button>
                <button
                  type="submit"
                  formAction={enviarParaAprovacao}
                  className="btn btn-outline flex-1"
                >
                  Enviar para aprovação
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  )
}

function FormAtendimento({ tipo, data }: { tipo: 'presencial' | 'digital'; data: string }) {
  const presencial = tipo === 'presencial'
  const origens = presencial ? origemPresencialLabel : origemDigitalLabel

  return (
    <form action={registrarAtendimento}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="data" value={data} />
      <div className="sec-header">
        <div className="sec-title">
          {presencial ? 'Adicionar atendimento presencial' : 'Adicionar atendimento digital'}
        </div>
      </div>
      <div className="sec-body sec-pad flex flex-col gap-3">
        <div className="grid2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Cliente</label>
            <input name="cliente_nome" type="text" required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Celular</label>
            <TelefoneInput name="celular" />
          </div>
        </div>

        <div className="grid2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Veículo de interesse</label>
            <input name="veiculo_interesse" type="text" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Origem</label>
            <select name="origem" defaultValue="">
              <option value="">—</option>
              {Object.entries(origens).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid2">
          {presencial ? (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Compra / Venda</label>
                <select name="cv" defaultValue="">
                  <option value="">—</option>
                  <option value="compra">Compra</option>
                  <option value="venda">Venda</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Fechou negócio?</label>
                <select name="fechou_negocio" defaultValue="nao">
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Agendou visita?</label>
                <select name="agendou_visita" defaultValue="nao">
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Fechou negócio?</label>
                <select name="fechou_negocio" defaultValue="nao">
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Observação</label>
          <textarea name="observacao" rows={2} />
        </div>

        <button type="submit" className="btn btn-red btn-sm self-start">
          Enviar atendimento
        </button>
      </div>
    </form>
  )
}
