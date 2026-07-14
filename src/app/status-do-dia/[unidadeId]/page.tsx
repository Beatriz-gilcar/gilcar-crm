import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { origemPresencialLabel, origemDigitalLabel } from '@/lib/atendimentos'
import { aprovarConsultorDia, aprovarDiaUnidade } from '../actions'

type ConsultorStatus = {
  consultor_id: string
  consultor_nome: string
  enviados: number
  aprovado: boolean
}

type AtendimentoDetalhe = {
  id: string
  consultor_id: string
  cliente_id: string
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
  clientes: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }

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
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const isAdmin = profile?.cargo === 'admin'

  if (!isGerencia) {
    redirect('/')
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
            'id, consultor_id, cliente_id, tipo, cliente_nome, celular, veiculo_interesse, cv, fechou_negocio, agendou_visita, origem, observacao, data_atendimento, clientes(nome)'
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

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
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

                    return (
                      <li
                        key={row.consultor_id}
                        className="border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-white">{row.consultor_nome}</p>
                            <p className="text-[.75rem] text-[var(--text-muted)]">
                              {row.enviados} atendimento{row.enviados === 1 ? '' : 's'} enviado
                              {row.enviados === 1 ? '' : 's'}
                            </p>
                          </div>
                          {row.aprovado ? (
                            <span className="badge badge-aprovado">Aprovado</span>
                          ) : (
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

                        {atendimentosDoConsultor.length > 0 && (
                          <ul className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
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
                                      {new Date(atendimento.data_atendimento).toLocaleTimeString(
                                        'pt-BR',
                                        { hour: '2-digit', minute: '2-digit' }
                                      )}
                                    </span>
                                  </p>
                                  <p className="mt-1 normal-case text-white">
                                    <Link href={`/leads/${atendimento.cliente_id}`} className="hover:underline">
                                      {atendimento.clientes?.nome ?? atendimento.cliente_nome ?? '—'}
                                    </Link>
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
