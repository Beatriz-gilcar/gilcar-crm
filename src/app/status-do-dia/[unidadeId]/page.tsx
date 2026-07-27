import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { origemPresencialLabel, origemDigitalLabel } from '@/lib/atendimentos'
import { atividadeGrupos } from '@/lib/atividades'
import { horaBR } from '@/lib/datas'
import { aprovarConsultorDia, aprovarDiaUnidade } from '../actions'
import { podeVerTudo, isSomenteLeitura } from '@/lib/membros'

type ConsultorStatus = {
  consultor_id: string
  consultor_nome: string
  enviados: number
  presenciais: number
  digitais: number
  fechamentos: number
  ficha_status: string
}

type AtendimentoDetalhe = {
  id: string
  consultor_id: string
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

// sem_ficha: o consultor pode até ter lançado atendimento, mas não registrou o
// dia. pendente: registrou e ainda está mexendo. enviado: fechou o dia e passou
// pro gerente — é o único estado que pede ação.
const fichaBadge: Record<string, { label: string; classe: string }> = {
  sem_ficha: { label: 'Não registrou', classe: 'badge-rejeitado' },
  pendente: { label: 'Registrando', classe: 'badge-pendente' },
  enviado: { label: 'Aguardando aprovação', classe: 'badge-enviado' },
  aprovado: { label: 'Aprovado', classe: 'badge-aprovado' },
}

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function StatusDoDiaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ unidadeId: string }>
  searchParams: Promise<{ data?: string }>
}) {
  const { unidadeId } = await params
  const { data: dataParam } = await searchParams
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

  if (!verTudo) {
    redirect('/')
  }

  // Gerente/supervisor só acessa a própria unidade (admin/visualizador, todas).
  const veTodas = isAdmin || isSomenteLeitura(profile?.cargo)
  if (!veTodas && unidadeId !== profile?.unidade_id) {
    redirect('/status-do-dia')
  }

  const { data: unidade } = await supabase
    .from('unidades')
    .select('id, nome')
    .eq('id', unidadeId)
    .single<{ id: string; nome: string }>()

  if (!unidade) {
    notFound()
  }

  const { data: aprovacaoDia } = await supabase
    .from('aprovacoes_dia')
    .select('status')
    .eq('unidade_id', unidadeId)
    .eq('data', data)
    .maybeSingle<{ status: string }>()

  const diaAprovado = aprovacaoDia?.status === 'aprovado'

  const { data: consultores } = await supabase.rpc('status_dia_detalhe', {
    p_data: data,
    p_unidade_id: unidadeId,
  })
  const rows = (consultores ?? []) as ConsultorStatus[]

  const consultorIds = rows.map((r) => r.consultor_id)
  const inicio = `${data}T00:00:00Z`
  const fim = new Date(new Date(inicio).getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data: atendimentos } =
    consultorIds.length > 0
      ? await supabase
          .from('atendimentos')
          .select(
            'id, consultor_id, tipo, cliente_nome, celular, veiculo_interesse, cv, fechou_negocio, agendou_visita, origem, observacao, data_atendimento'
          )
          .in('consultor_id', consultorIds)
          .gte('data_atendimento', inicio)
          .lt('data_atendimento', fim)
          .order('data_atendimento', { ascending: false })
          .overrideTypes<AtendimentoDetalhe[]>()
      : { data: [] as AtendimentoDetalhe[] }

  const atendimentosPorConsultor = new Map<string, AtendimentoDetalhe[]>()
  for (const atendimento of atendimentos ?? []) {
    const lista = atendimentosPorConsultor.get(atendimento.consultor_id) ?? []
    lista.push(atendimento)
    atendimentosPorConsultor.set(atendimento.consultor_id, lista)
  }

  // Atividades do dia (Feed, Reels, ..., Ligações) de cada consultor, pra
  // aparecerem junto da aprovação, com o realizado vs. meta.
  const { data: atividadesData } =
    consultorIds.length > 0
      ? await supabase
          .from('atividades_dia')
          .select(
            'consultor_id, feed, reels, stories, wa_status, tiktok, marketplace, olx, avaliacoes, ligacoes'
          )
          .in('consultor_id', consultorIds)
          .eq('data', data)
          .overrideTypes<(Record<string, number> & { consultor_id: string })[]>()
      : { data: [] as (Record<string, number> & { consultor_id: string })[] }

  const atividadesPorConsultor = new Map(
    (atividadesData ?? []).map((a) => [a.consultor_id, a])
  )
  const itensAtividade = atividadeGrupos.flatMap((g) => g.itens)

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="status-do-dia"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={`/status-do-dia?data=${data}`}
            className="text-[.72rem] text-[var(--text-muted)] hover:text-white"
          >
            ← Status do Dia
          </Link>

          <div className="mt-2">
            <div className="sec-header">
              <div className="sec-title">
                {unidade.nome} — {new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR')}
              </div>
              <span className={`badge ${diaAprovado ? 'badge-aprovado' : 'badge-pendente'}`}>
                {diaAprovado ? 'Aprovado' : 'Aberto'}
              </span>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {rows.length === 0 ? (
                <div className="empty-state">Nenhum consultor nesta unidade.</div>
              ) : (
                <ul className="flex flex-col">
                  {rows.map((row) => {
                    const atendimentosDoConsultor = atendimentosPorConsultor.get(row.consultor_id) ?? []
                    const atividade = atividadesPorConsultor.get(row.consultor_id)

                    return (
                      <li
                        key={row.consultor_id}
                        className="border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{row.consultor_nome}</p>
                            <p className="text-[.75rem] text-[var(--text-muted)]">
                              {row.enviados} atendimento{row.enviados === 1 ? '' : 's'}
                              {row.ficha_status !== 'sem_ficha' && (
                                <>
                                  {' · '}
                                  {row.presenciais} pres · {row.digitais} dig · {row.fechamentos} fech
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${fichaBadge[row.ficha_status]?.classe}`}>
                              {fichaBadge[row.ficha_status]?.label ?? row.ficha_status}
                            </span>
                            {/* Só faz sentido aprovar o que o consultor já fechou e mandou. */}
                            {row.ficha_status === 'enviado' && (
                              <form action={aprovarConsultorDia}>
                                <input type="hidden" name="consultor_id" value={row.consultor_id} />
                                <input type="hidden" name="data" value={data} />
                                <input type="hidden" name="unidade_id" value={unidadeId} />
                                <button type="submit" className="btn btn-outline btn-sm">
                                  Aprovar
                                </button>
                              </form>
                            )}
                          </div>
                        </div>

                        {/* Atividades do dia (realizado/meta) junto da aprovação. */}
                        {atividade && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[.68rem] normal-case">
                            {itensAtividade.map((it) => {
                              const v = atividade[it.campo] ?? 0
                              const ok = v >= it.meta
                              return (
                                <span
                                  key={it.campo}
                                  className={ok ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}
                                >
                                  {it.label} <span className="font-bold">{v}</span>/{it.meta}
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {atendimentosDoConsultor.length > 0 && (
                          <details className="mt-3 border-t border-[var(--border)] pt-3">
                            <summary className="cursor-pointer list-none text-[.74rem] font-bold text-[var(--coral)] hover:underline">
                              ▸ Ver {atendimentosDoConsultor.length} atendimento
                              {atendimentosDoConsultor.length === 1 ? '' : 's'}
                            </summary>
                            <ul className="mt-2 flex flex-col gap-2">
                            {atendimentosDoConsultor.map((atendimento) => {
                              const origemLabel =
                                atendimento.tipo === 'presencial'
                                  ? origemPresencialLabel[atendimento.origem ?? '']
                                  : origemDigitalLabel[atendimento.origem ?? '']

                              return (
                                <li key={atendimento.id} className="text-[.78rem]">
                                  <p className="flex flex-wrap items-center gap-2">
                                    <span className="badge badge-enviado">
                                      {atendimento.tipo === 'presencial' ? 'Presencial' : 'Digital'}
                                    </span>
                                    {atendimento.tipo === 'presencial' && atendimento.cv && (
                                      <span className="badge badge-pendente">
                                        {atendimento.cv === 'compra' ? 'Compra' : 'Venda'}
                                      </span>
                                    )}
                                    {atendimento.tipo === 'presencial' && (
                                      <span
                                        className={`badge ${atendimento.fechou_negocio ? 'badge-aprovado' : 'badge-rejeitado'}`}
                                      >
                                        {atendimento.fechou_negocio ? 'Fechou' : 'Não fechou'}
                                      </span>
                                    )}
                                    {atendimento.tipo === 'digital' && (
                                      <span
                                        className={`badge ${atendimento.agendou_visita ? 'badge-aprovado' : 'badge-rejeitado'}`}
                                      >
                                        {atendimento.agendou_visita ? 'Agendou' : 'Não agendou'}
                                      </span>
                                    )}
                                    <span className="text-[var(--text-muted)]">
                                      {horaBR(atendimento.data_atendimento)}
                                    </span>
                                  </p>
                                  <p className="mt-1 normal-case text-white">
                                    {atendimento.cliente_nome ?? '—'}
                                    {atendimento.celular && <> · {atendimento.celular}</>}
                                    {atendimento.veiculo_interesse && (
                                      <> · {atendimento.veiculo_interesse}</>
                                    )}
                                    {origemLabel && (
                                      <span className="text-[var(--text-muted)]"> · {origemLabel}</span>
                                    )}
                                  </p>
                                  {atendimento.observacao && (
                                    <p className="mt-1 whitespace-pre-wrap normal-case text-[var(--text-muted)]">
                                      {atendimento.observacao}
                                    </p>
                                  )}
                                </li>
                              )
                            })}
                            </ul>
                          </details>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {!diaAprovado && (
              <form action={aprovarDiaUnidade} className="mt-4">
                <input type="hidden" name="unidade_id" value={unidadeId} />
                <input type="hidden" name="data" value={data} />
                <ConfirmButton
                  className="btn btn-red"
                  confirmMessage={`Aprovar o dia inteiro para ${unidade.nome}? Depois disso ninguém mais poderá enviar atendimentos para essa data.`}
                >
                  Aprovar o dia inteiro
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
