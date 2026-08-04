import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { MetaWidget } from '@/components/MetaWidget'
import { ConfirmButton } from '@/components/ConfirmButton'
import { formatBRL } from '@/lib/ordens'
import {
  statusLabel,
  statusBadgeClass,
  mesAtualISO,
  mesRange,
  mesLabel,
  protecoesLabel,
  metaColor,
} from '@/lib/metas'
import { toggleVendaProtecaoStatus, deleteVendaProtecao, salvarMetasProtecaoLote } from '../actions'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura } from '@/lib/membros'

type VendaProtecao = {
  id: string
  numero_sequencial: number
  consultor_id: string
  unidade_id: string
  placa: string | null
  cliente: string
  valor: number
  data: string
  status: string
  profiles: { nome: string } | null
  unidades: { nome: string } | null
}

type Meta = { escopo: string; unidade_id: string | null; consultor_id: string | null; valor_meta: number }
type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }
type Vendedor = { id: string; nome: string; unidade_id: string | null; unidades: { nome: string } | null }

const medalha = ['🥇', '🥈', '🥉']

export default async function ProtecaoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string; success?: string }>
}) {
  const { mes: mesParam, error, success } = await searchParams
  const mes = mesParam || mesAtualISO()
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

  const isGerencia = isGerenciaCargo(profile?.cargo)
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'
  const soLeitura = isSomenteLeitura(profile?.cargo)
  // Gerente/supervisor vê só a própria unidade; admin/CEO veem tudo.
  const veTudoUnidades = isAdmin || soLeitura
  const unidadeGerente = !veTudoUnidades && isGerencia ? profile?.unidade_id ?? null : null

  const { inicio, fim } = mesRange(mes)

  // Empresa toda: o progresso por unidade mostra todas as lojas pra todo mundo.
  // Só as listas de NOME (ranking e proteções registradas) ficam restritas à
  // unidade do gerente (via vendasLista/vendedores).
  const { data: vendasData } = await supabase
    .from('vendas_protecao')
    .select(
      'id, numero_sequencial, consultor_id, unidade_id, placa, cliente, valor, data, status, profiles(nome), unidades(nome)'
    )
    .gte('data', inicio)
    .lt('data', fim)
    .order('data', { ascending: false })
    .order('numero_sequencial', { ascending: false })
    .overrideTypes<VendaProtecao[]>()

  const vendas = vendasData ?? []
  // Lista de proteções registradas: gerente só vê a da própria unidade.
  const vendasLista = unidadeGerente ? vendas.filter((v) => v.unidade_id === unidadeGerente) : vendas

  const { data: metasData } = await supabase
    .from('metas')
    .select('escopo, unidade_id, consultor_id, valor_meta')
    .eq('tipo', 'protecao')
    .eq('periodo', mes)
    .overrideTypes<Meta[]>()

  const metas = metasData ?? []
  const metaPorUnidade = new Map(
    metas.filter((m) => m.escopo === 'unidade').map((m) => [m.unidade_id, m.valor_meta])
  )
  const metaPorConsultor = new Map(
    metas.filter((m) => m.escopo === 'consultor').map((m) => [m.consultor_id, m.valor_meta])
  )
  const metaConsultorLogado = metaPorConsultor.get(user.id) ?? 0

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  // Só quem vende entra nas metas por vendedor — supervisor conta junto com o
  // consultor (gs:1671), e gerente também vende proteção. Inativo fora: não
  // vende mais.
  const { data: vendedoresData } = verTudo
    ? await supabase
        .from('profiles')
        .select('id, nome, unidade_id, unidades(nome)')
        .in('cargo', ['consultor', 'supervisor', 'gerente'])
        .eq('ativo', true)
        .order('nome')
        .overrideTypes<Vendedor[]>()
    : { data: [] as Vendedor[] }

  // Ranking "Progresso por consultor" é a competição: mostra todos os
  // vendedores pra todo mundo. Só a lista de proteções registradas (vendasLista)
  // é que fica restrita à unidade do gerente.
  const vendedores = vendedoresData ?? []

  // A meta é contada em unidades ("6/12 seguros"), não em reais: uma proteção
  // de R$ 0,00 conta como 1 igual às outras. Por isso count, não sum(valor).
  // Só proteções ATIVAS contam pra meta — caída não conta. A lista continua
  // mostrando todas.
  const vendasAtivas = vendas.filter((v) => v.status === 'ativa')
  const realizadoPorUnidade = new Map<string, number>()
  const realizadoPorConsultor = new Map<string, number>()
  for (const v of vendasAtivas) {
    realizadoPorUnidade.set(v.unidade_id, (realizadoPorUnidade.get(v.unidade_id) ?? 0) + 1)
    realizadoPorConsultor.set(v.consultor_id, (realizadoPorConsultor.get(v.consultor_id) ?? 0) + 1)
  }
  const realizadoConsultorLogado = realizadoPorConsultor.get(user.id) ?? 0

  const ranking = vendedores
    .map((v) => ({ ...v, realizado: realizadoPorConsultor.get(v.id) ?? 0 }))
    .filter((v) => v.realizado > 0)
    .sort((a, b) => b.realizado - a.realizado)
  const maiorDoRanking = ranking[0]?.realizado ?? 0

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="metas"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Meta de Proteção
            </div>
            <div className="flex flex-wrap gap-2">
              <form method="get" className="flex items-center gap-2">
                <input name="mes" type="month" defaultValue={mes} />
                <button type="submit" className="btn btn-outline btn-sm">
                  Ver
                </button>
              </form>
              <Link href="/metas" className="btn btn-outline btn-sm">
                Vendas
              </Link>
              {!soLeitura && (
                <Link href="/metas/protecao/new" className="btn btn-red btn-sm">
                  + Lançar proteção
                </Link>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}
          {success === 'metas' && (
            <p className="mt-3 rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
              Metas salvas.
            </p>
          )}

          {verTudo ? (
            <>
              {/* ── Progresso por unidade ──────────────────────────────── */}
              <div className="sec-header mt-6">
                <div className="sec-title">Progresso de proteções por unidade</div>
                <span className="badge badge-enviado">{mesLabel(mes)}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {unidades.map((u) => {
                  const realizado = realizadoPorUnidade.get(u.id) ?? 0
                  const meta = metaPorUnidade.get(u.id) ?? 0
                  return (
                    <MetaWidget
                      key={u.id}
                      titulo={u.nome}
                      realizadoLabel={protecoesLabel(realizado)}
                      metaLabel={meta > 0 ? protecoesLabel(meta) : 'sem meta'}
                      pct={meta > 0 ? (realizado / meta) * 100 : 0}
                    />
                  )
                })}
              </div>

              {/* ── Metas em lote: unidades + vendedores num submit só ─── */}
              {isAdmin && (
                <form action={salvarMetasProtecaoLote} className="mt-6">
                  <input type="hidden" name="periodo" value={mes} />

                  <div className="sec-header">
                    <div className="sec-title">Meta de proteção por unidade</div>
                    <button type="submit" className="btn btn-red btn-sm">
                      Salvar metas
                    </button>
                  </div>
                  <div className="sec-body" style={{ padding: 0 }}>
                    {unidades.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2 first:border-t-0"
                      >
                        <span className="font-semibold text-white">{u.nome}</span>
                        <input
                          name={`meta_unidade_${u.id}`}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={metaPorUnidade.get(u.id) ?? 0}
                          className="w-24 text-center"
                          aria-label={`Meta de proteções da unidade ${u.nome}`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="sec-header mt-4">
                    <div className="sec-title">Meta de proteção por vendedor</div>
                  </div>
                  <div className="sec-body" style={{ padding: 0 }}>
                    {vendedores.length === 0 ? (
                      <div className="empty-state">Nenhum vendedor ativo.</div>
                    ) : (
                      vendedores.map((v) => {
                        const realizado = realizadoPorConsultor.get(v.id) ?? 0
                        const meta = metaPorConsultor.get(v.id) ?? 0
                        return (
                          <div
                            key={v.id}
                            className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2 first:border-t-0"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-white">{v.nome}</p>
                              <p className="text-[.7rem] normal-case text-[var(--text-muted)]">
                                {v.unidades?.nome ?? '—'}
                              </p>
                            </div>
                            <input
                              name={`meta_consultor_${v.id}`}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={meta}
                              // width inline (não w-24): o globals.css tem
                              // `input { width: 100% }` fora de @layer, que vence
                              // o utilitário do Tailwind e esticaria o campo,
                              // espremendo o nome do vendedor.
                              style={{ width: '5rem', flex: '0 0 auto' }}
                              className="text-center"
                              aria-label={`Meta de proteções de ${v.nome}`}
                            />
                            <span
                              className="w-16 text-right text-[.78rem] font-bold"
                              style={{ color: metaColor(meta > 0 ? (realizado / meta) * 100 : 0).fillColor }}
                              title="Realizado no mês"
                            >
                              {realizado}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </form>
              )}

              {/* ── Ranking ────────────────────────────────────────────── */}
              <div className="sec-header mt-6">
                <div className="sec-title">Progresso por consultor</div>
              </div>
              <div className="sec-body" style={{ padding: 0 }}>
                {ranking.length === 0 ? (
                  <div className="empty-state">Nenhuma proteção lançada em {mesLabel(mes)}.</div>
                ) : (
                  ranking.map((v, i) => (
                    <div key={v.id} className="border-t border-[var(--border)] px-4 py-3 first:border-t-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-white">
                          {medalha[i] ? `${medalha[i]} ` : ''}
                          {v.nome}
                        </p>
                        <span className="text-[.72rem] font-bold text-[var(--success)]">
                          {protecoesLabel(v.realizado)} · {v.unidades?.nome ?? '—'}
                        </span>
                      </div>
                      {/* Barra relativa ao líder do mês, não à meta: é um
                          ranking entre pares, e o líder ancora a escala. */}
                      <div className="meta-track mt-2">
                        <div
                          className="meta-fill"
                          style={{
                            width: `${maiorDoRanking > 0 ? (v.realizado / maiorDoRanking) * 100 : 0}%`,
                            background: 'var(--success)',
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="mt-4">
              <MetaWidget
                titulo="Minha proteção"
                subtitulo={mesLabel(mes)}
                realizadoLabel={protecoesLabel(realizadoConsultorLogado)}
                metaLabel={metaConsultorLogado > 0 ? protecoesLabel(metaConsultorLogado) : 'sem meta'}
                pct={metaConsultorLogado > 0 ? (realizadoConsultorLogado / metaConsultorLogado) * 100 : 0}
              />
            </div>
          )}

          {/* ── Proteções registradas ─────────────────────────────────── */}
          <div className="sec-header mt-6">
            <div className="sec-title">
              {verTudo ? 'Proteções registradas' : 'Minhas proteções do mês'}
            </div>
            <span className="badge badge-enviado">{protecoesLabel(vendasLista.length)}</span>
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {vendasLista.length === 0 ? (
              <div className="empty-state">Nenhuma proteção lançada em {mesLabel(mes)}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[.78rem]">
                  <thead>
                    <tr className="text-left text-[.68rem] text-[var(--text-muted)]">
                      <th className="px-4 py-2 font-bold">Data</th>
                      {verTudo && <th className="px-4 py-2 font-bold">Vendedor</th>}
                      {verTudo && <th className="px-4 py-2 font-bold">Unidade</th>}
                      <th className="px-4 py-2 font-bold">Placa</th>
                      <th className="px-4 py-2 font-bold">Cliente</th>
                      <th className="px-4 py-2 text-right font-bold">Valor</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {vendasLista.map((v) => (
                      <tr key={v.id} className="border-t border-[var(--border)]">
                        <td className="whitespace-nowrap px-4 py-3 normal-case text-[var(--text-muted)]">
                          {new Date(`${v.data}T12:00:00`).toLocaleDateString('pt-BR')}
                        </td>
                        {verTudo && (
                          <td className="px-4 py-3 normal-case text-white">{v.profiles?.nome ?? '—'}</td>
                        )}
                        {verTudo && (
                          <td className="px-4 py-3 normal-case text-[var(--text-muted)]">
                            {v.unidades?.nome ?? '—'}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3 text-white">{v.placa ?? '—'}</td>
                        <td className="px-4 py-3 normal-case text-white">{v.cliente}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--success)]">
                          {formatBRL(v.valor)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className={`badge ${statusBadgeClass[v.status]}`}>
                              {statusLabel[v.status]}
                            </span>
                            {!soLeitura && (
                              <form action={toggleVendaProtecaoStatus}>
                                <input type="hidden" name="id" value={v.id} />
                                <input type="hidden" name="status_atual" value={v.status} />
                                <button
                                  type="submit"
                                  className="whitespace-nowrap text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white"
                                >
                                  {v.status === 'ativa' ? 'Marcar caída' : 'Reativar'}
                                </button>
                              </form>
                            )}
                            {isGerencia && (
                              <form action={deleteVendaProtecao}>
                                <input type="hidden" name="id" value={v.id} />
                                <ConfirmButton
                                  className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                                  confirmMessage={`Excluir a proteção de ${v.cliente} definitivamente?`}
                                >
                                  Excluir
                                </ConfirmButton>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
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
