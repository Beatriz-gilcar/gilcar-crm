import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { MetaWidget } from '@/components/MetaWidget'
import { mesAtualISO, mesRange, mesLabel, metaColor } from '@/lib/metas'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura } from '@/lib/membros'

type RankingUnidade = {
  unidade_id: string
  unidade_nome: string
  total: number
}

// Desempenho cruzado por pessoa: leads recebidos × atendimentos × vendas, com a
// taxa de conversão (vendas ÷ leads). É o que o CEO usa pra achar "recebeu muito
// lead mas converteu pouco".
type DesempenhoRow = {
  id: string
  nome: string
  unidade: string
  leads: number
  atend: number
  vendas: number
  conv: number
}

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }

// Fim exclusivo do range (dia seguinte, no fuso do Brasil) — assim o "até" é
// inclusivo daquele dia inteiro mesmo com created_at/data em UTC.
function fimExclusivoISO(dia: string): string {
  const d = new Date(`${dia}T00:00:00-03:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}
function inicioISO(dia: string): string {
  return new Date(`${dia}T00:00:00-03:00`).toISOString()
}
type MetaRow = { escopo: string; unidade_id: string | null; consultor_id: string | null; valor_meta: number }
type VendaMin = { consultor_id: string; unidade_id: string }
type UnidadeRow = { id: string; nome: string }

function faltamDe(meta: number, realizado: number): number {
  return Math.max(0, meta - realizado)
}
function pctDe(meta: number, realizado: number): number {
  return meta > 0 ? (realizado / meta) * 100 : 0
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; unidade?: string; consultor?: string }>
}) {
  const { de, ate, unidade: unidadeFiltro = '', consultor: consultorFiltro = '' } = await searchParams
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
  // Só admin/CEO veem todas as unidades e ganham os seletores de drill.
  const veTodasUnidades = isAdmin || isSomenteLeitura(profile?.cargo)

  // Escopo EFETIVO do Dashboard: admin/CEO usam o filtro escolhido; gerente/
  // supervisor ficam presos à própria unidade (o RLS deixaria ver tudo, então
  // travamos aqui). Consultor não filtra (o RLS já dá só o dele).
  const filtroConsultor = veTodasUnidades ? consultorFiltro : ''
  const filtroUnidade = veTodasUnidades ? unidadeFiltro : isGerencia ? profile?.unidade_id ?? '' : ''

  // Dropdowns (só admin/CEO).
  let unidadesFiltro: { id: string; nome: string }[] = []
  let pessoasFiltro: { id: string; nome: string }[] = []
  if (veTodasUnidades) {
    const [uRes, pRes] = await Promise.all([
      supabase.from('unidades').select('id, nome').order('nome'),
      supabase
        .from('profiles')
        .select('id, nome')
        .eq('ativo', true)
        .neq('cargo', 'visualizador')
        .order('nome'),
    ])
    unidadesFiltro = uRes.data ?? []
    pessoasFiltro = pRes.data ?? []
  }

  // Consultores da unidade filtrada — pra filtrar atendimentos (que não têm
  // unidade_id, só consultor_id).
  let idsDaUnidade: string[] | null = null
  if (filtroUnidade) {
    const { data: pu } = await supabase.from('profiles').select('id').eq('unidade_id', filtroUnidade)
    idsDaUnidade = (pu ?? []).map((p) => p.id as string)
  }

  // ── Contador de meta de vendas do mês ────────────────────────────────────
  // Consultor vê a própria; gerente/supervisor vê a da sua unidade; admin (e
  // gerência de rede, sem unidade) vê a empresa + todas as unidades.
  const mes = mesAtualISO()
  const { inicio, fim } = mesRange(mes)
  const veTudoMetas = isAdmin || (isGerencia && !profile?.unidade_id)

  const { data: metasVendasData } = await supabase
    .from('metas')
    .select('escopo, unidade_id, consultor_id, valor_meta')
    .eq('tipo', 'vendas')
    .eq('periodo', mes)
    .overrideTypes<MetaRow[]>()
  const metasVendas = metasVendasData ?? []
  const metaEmpresa = metasVendas.find((m) => m.escopo === 'empresa')?.valor_meta ?? 0
  const metaPorUnidade = new Map(
    metasVendas.filter((m) => m.escopo === 'unidade').map((m) => [m.unidade_id, m.valor_meta])
  )
  const metaConsultor =
    metasVendas.find((m) => m.escopo === 'consultor' && m.consultor_id === user.id)?.valor_meta ?? 0

  // Realizado do mês. Só vendas ATIVAS contam pra meta — caída não conta (igual
  // à "Corrida da Meta" do sistema antigo). Gerência lê tudo; consultor só as suas.
  let vendasQuery = supabase
    .from('vendas')
    .select('consultor_id, unidade_id')
    .eq('status', 'ativa')
    .gte('data', inicio)
    .lt('data', fim)
  if (!isGerencia) vendasQuery = vendasQuery.eq('consultor_id', user.id)
  const { data: vendasMesData } = await vendasQuery.overrideTypes<VendaMin[]>()
  const vendasMes = vendasMesData ?? []

  const realizadoConsultor = vendasMes.filter((v) => v.consultor_id === user.id).length
  const realizadoEmpresa = vendasMes.length
  const realizadoPorUnidade = new Map<string, number>()
  for (const v of vendasMes) {
    realizadoPorUnidade.set(v.unidade_id, (realizadoPorUnidade.get(v.unidade_id) ?? 0) + 1)
  }

  let unidadesMeta: UnidadeRow[] = []
  if (isGerencia) {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome').overrideTypes<UnidadeRow[]>()
    unidadesMeta = data ?? []
  }

  // Progresso por consultor (só na visão de tudo): "faltam X" de cada vendedor.
  let consultoresMeta: { nome: string; realizado: number; meta: number }[] = []
  if (veTudoMetas) {
    const metaPorConsultor = new Map<string, number>()
    for (const m of metasVendas) {
      if (m.escopo === 'consultor' && m.consultor_id) metaPorConsultor.set(m.consultor_id, m.valor_meta)
    }
    const realizadoPorConsultor = new Map<string, number>()
    for (const v of vendasMes) {
      realizadoPorConsultor.set(v.consultor_id, (realizadoPorConsultor.get(v.consultor_id) ?? 0) + 1)
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('ativo', true)
      .neq('cargo', 'visualizador')
    consultoresMeta = (profs ?? [])
      .map((p) => ({
        nome: p.nome,
        realizado: realizadoPorConsultor.get(p.id) ?? 0,
        meta: metaPorConsultor.get(p.id) ?? 0,
      }))
      .filter((c) => c.meta > 0 || c.realizado > 0)
      .sort((a, b) => b.realizado - a.realizado)
  }

  // Valores da unidade do gerente (quando ele é preso a uma unidade).
  const unidadeGerente = isGerencia && !veTudoMetas ? profile?.unidade_id ?? null : null
  const metaUnidadeGerente = unidadeGerente ? metaPorUnidade.get(unidadeGerente) ?? 0 : 0
  const realizadoUnidadeGerente = unidadeGerente ? realizadoPorUnidade.get(unidadeGerente) ?? 0 : 0
  const nomeUnidadeGerente = unidadeGerente
    ? unidadesMeta.find((u) => u.id === unidadeGerente)?.nome ?? 'sua unidade'
    : ''

  // Quando o admin filtra por pessoa ou unidade, a seção de Meta foca só nela
  // (em vez de mostrar empresa + todas as unidades).
  const metaFiltroConsultor = filtroConsultor
    ? metasVendas.find((m) => m.escopo === 'consultor' && m.consultor_id === filtroConsultor)?.valor_meta ?? 0
    : 0
  const realizadoFiltroConsultor = filtroConsultor
    ? vendasMes.filter((v) => v.consultor_id === filtroConsultor).length
    : 0
  const nomeFiltroConsultor = pessoasFiltro.find((p) => p.id === filtroConsultor)?.nome ?? 'Consultor'
  const metaFiltroUnidade = filtroUnidade ? metaPorUnidade.get(filtroUnidade) ?? 0 : 0
  const realizadoFiltroUnidade = filtroUnidade ? realizadoPorUnidade.get(filtroUnidade) ?? 0 : 0
  const nomeFiltroUnidade = unidadesFiltro.find((u) => u.id === filtroUnidade)?.nome ?? 'Unidade'

  // Corrida da meta da unidade do consultor: disputa entre os colegas da mesma
  // loja. Precisa do service role porque o RLS esconde as vendas/perfis alheios.
  let corridaUnidade: { nome: string; realizado: number; meta: number; voce: boolean }[] = []
  let nomeUnidadeConsultor = ''
  if (!isGerencia && profile?.unidade_id) {
    const admin = createAdminClient()
    const [peersRes, vendRes, metasCRes, uniRes] = await Promise.all([
      admin
        .from('profiles')
        .select('id, nome')
        .eq('unidade_id', profile.unidade_id)
        .eq('ativo', true)
        .neq('cargo', 'visualizador'),
      admin.from('vendas').select('consultor_id').eq('status', 'ativa').gte('data', inicio).lt('data', fim),
      admin
        .from('metas')
        .select('consultor_id, valor_meta')
        .eq('tipo', 'vendas')
        .eq('escopo', 'consultor')
        .eq('periodo', mes),
      admin.from('unidades').select('nome').eq('id', profile.unidade_id).single<{ nome: string }>(),
    ])
    nomeUnidadeConsultor = uniRes.data?.nome ?? ''
    const realMap = new Map<string, number>()
    for (const v of vendRes.data ?? []) {
      realMap.set(v.consultor_id, (realMap.get(v.consultor_id) ?? 0) + 1)
    }
    const metaMap = new Map((metasCRes.data ?? []).map((m) => [m.consultor_id, m.valor_meta]))
    corridaUnidade = (peersRes.data ?? [])
      .map((p) => ({
        nome: p.nome,
        realizado: realMap.get(p.id) ?? 0,
        meta: metaMap.get(p.id) ?? 0,
        voce: p.id === user.id,
      }))
      .filter((c) => c.meta > 0 || c.realizado > 0 || c.voce)
      .sort((a, b) => b.realizado - a.realizado || pctDe(b.meta, b.realizado) - pctDe(a.meta, a.realizado))
  }

  // Filtro de período (de/até), ancorado no fuso do Brasil. Sem filtro = tudo.
  let qLeads = supabase.from('clientes').select('*', { count: 'exact', head: true })
  let qAtend = supabase.from('atendimentos').select('*', { count: 'exact', head: true })
  if (de) {
    qLeads = qLeads.gte('created_at', inicioISO(de))
    qAtend = qAtend.gte('data_atendimento', inicioISO(de))
  }
  if (ate) {
    qLeads = qLeads.lt('created_at', fimExclusivoISO(ate))
    qAtend = qAtend.lt('data_atendimento', fimExclusivoISO(ate))
  }
  // Drill por pessoa vence o por unidade. Atendimento não tem unidade_id, então
  // filtra pela lista de consultores da unidade. NENHUM = id impossível (0 resultados).
  const NENHUM = '00000000-0000-0000-0000-000000000000'
  if (filtroConsultor) {
    qLeads = qLeads.eq('consultor_id', filtroConsultor)
    qAtend = qAtend.eq('consultor_id', filtroConsultor)
  } else if (filtroUnidade) {
    qLeads = qLeads.eq('unidade_id', filtroUnidade)
    qAtend = qAtend.in('consultor_id', idsDaUnidade && idsDaUnidade.length ? idsDaUnidade : [NENHUM])
  }

  const [{ count: totalLeads }, { count: totalAtendimentos }, { count: lembretesPendentes }] =
    await Promise.all([
      qLeads,
      qAtend,
      supabase.from('lembretes').select('*', { count: 'exact', head: true }).eq('concluido', false),
    ])

  let rankingLeadsUnidade: RankingUnidade[] = []
  let desempenho: DesempenhoRow[] = []

  if (isGerencia) {
    // Rankings por consulta direta (não RPC) pra respeitar o filtro de período.
    let qCli = supabase.from('clientes').select('consultor_id, unidade_id')
    let qAt = supabase.from('atendimentos').select('consultor_id')
    // Vendas ATIVAS no mesmo recorte (a conversão precisa casar com os leads).
    let qVen = supabase.from('vendas').select('consultor_id').eq('status', 'ativa')
    if (de) {
      qCli = qCli.gte('created_at', inicioISO(de))
      qAt = qAt.gte('data_atendimento', inicioISO(de))
      qVen = qVen.gte('data', de)
    }
    if (ate) {
      qCli = qCli.lt('created_at', fimExclusivoISO(ate))
      qAt = qAt.lt('data_atendimento', fimExclusivoISO(ate))
      qVen = qVen.lte('data', ate)
    }
    if (filtroConsultor) {
      qCli = qCli.eq('consultor_id', filtroConsultor)
      qAt = qAt.eq('consultor_id', filtroConsultor)
      qVen = qVen.eq('consultor_id', filtroConsultor)
    } else if (filtroUnidade) {
      qCli = qCli.eq('unidade_id', filtroUnidade)
      qAt = qAt.in('consultor_id', idsDaUnidade && idsDaUnidade.length ? idsDaUnidade : [NENHUM])
      qVen = qVen.eq('unidade_id', filtroUnidade)
    }

    const [cliRes, atRes, venRes, profsRes, unisRes] = await Promise.all([
      qCli.overrideTypes<{ consultor_id: string; unidade_id: string | null }[]>(),
      qAt.overrideTypes<{ consultor_id: string }[]>(),
      qVen.overrideTypes<{ consultor_id: string }[]>(),
      supabase.from('profiles').select('id, nome, unidade_id'),
      supabase.from('unidades').select('id, nome'),
    ])
    const cli = cliRes.data ?? []
    const at = atRes.data ?? []
    const ven = venRes.data ?? []
    const nomeConsultor = new Map((profsRes.data ?? []).map((p) => [p.id, p.nome as string]))
    const unidadeDoConsultor = new Map((profsRes.data ?? []).map((p) => [p.id, p.unidade_id as string | null]))
    const nomeUnidade = new Map((unisRes.data ?? []).map((u) => [u.id, u.nome as string]))

    const leadsC = new Map<string, number>()
    const leadsU = new Map<string, number>()
    for (const c of cli) {
      leadsC.set(c.consultor_id, (leadsC.get(c.consultor_id) ?? 0) + 1)
      if (c.unidade_id) leadsU.set(c.unidade_id, (leadsU.get(c.unidade_id) ?? 0) + 1)
    }
    const atendC = new Map<string, number>()
    for (const a of at) atendC.set(a.consultor_id, (atendC.get(a.consultor_id) ?? 0) + 1)
    const vendasC = new Map<string, number>()
    for (const v of ven) vendasC.set(v.consultor_id, (vendasC.get(v.consultor_id) ?? 0) + 1)

    rankingLeadsUnidade = [...leadsU.entries()]
      .map(([id, total]) => ({ unidade_id: id, unidade_nome: nomeUnidade.get(id) ?? '—', total }))
      .sort((a, b) => b.total - a.total)

    // Uma linha por pessoa que teve lead, atendimento ou venda no recorte.
    const idsDesempenho = new Set<string>([...leadsC.keys(), ...atendC.keys(), ...vendasC.keys()])
    desempenho = [...idsDesempenho]
      .map((id) => {
        const leads = leadsC.get(id) ?? 0
        const vendas = vendasC.get(id) ?? 0
        return {
          id,
          nome: nomeConsultor.get(id) ?? '—',
          unidade: nomeUnidade.get(unidadeDoConsultor.get(id) ?? '') ?? '',
          leads,
          atend: atendC.get(id) ?? 0,
          vendas,
          conv: leads > 0 ? (vendas / leads) * 100 : 0,
        }
      })
      // Mais leads no topo: é ali que "muito lead, pouca venda" aparece.
      .sort((a, b) => b.leads - a.leads || b.vendas - a.vendas)
  }
  // Conversão colorida relativa ao melhor da lista (não a um alvo fixo, que
  // varia por operação): o líder fica verde, os demais escalam pra baixo.
  const maiorConv = Math.max(0, ...desempenho.map((d) => d.conv))

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="dashboard"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          {/* Filtro de período: afeta Leads, Atendimentos e os rankings. */}
          <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 160 }}>
              <label>De</label>
              <input type="date" name="de" defaultValue={de ?? ''} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 160 }}>
              <label>Até</label>
              <input type="date" name="ate" defaultValue={ate ?? ''} />
            </div>
            {veTodasUnidades && (
              <>
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 170 }}>
                  <label>Unidade</label>
                  <select name="unidade" defaultValue={unidadeFiltro}>
                    <option value="">Todas</option>
                    {unidadesFiltro.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 190 }}>
                  <label>Consultor / gerente</label>
                  <select name="consultor" defaultValue={consultorFiltro}>
                    <option value="">Todos</option>
                    {pessoasFiltro.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <button type="submit" className="btn btn-outline btn-sm">
              Ver
            </button>
            {(de || ate || unidadeFiltro || consultorFiltro) && (
              <a href="/dashboard" className="btn btn-outline btn-sm">
                Limpar
              </a>
            )}
          </form>

          {/* ── Contador de meta de vendas ─────────────────────────────── */}
          <div className="mb-6 flex flex-col gap-4">
            {!isGerencia && (
              <div>
                <div className="sec-header">
                  <div className="sec-title">
                    🏁 Corrida da meta{nomeUnidadeConsultor ? ` — ${nomeUnidadeConsultor}` : ''}
                  </div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-3">
                  <p className="normal-case text-white">
                    {metaConsultor <= 0 ? (
                      <span className="text-[var(--text-muted)]">Sua meta ainda não foi definida.</span>
                    ) : realizadoConsultor >= metaConsultor ? (
                      <span className="text-[1.05rem] font-extrabold text-[var(--success)]">
                        Você bateu a meta! 🎉
                      </span>
                    ) : (
                      <>
                        Faltam{' '}
                        <span className="text-[1.4rem] font-extrabold text-[var(--coral)]">
                          {faltamDe(metaConsultor, realizadoConsultor)}
                        </span>{' '}
                        vendas para a sua meta
                      </>
                    )}
                  </p>

                  {corridaUnidade.map((c, i) => {
                    const pct = pctDe(c.meta, c.realizado)
                    const pctClamped = Math.min(Math.max(pct, 0), 100)
                    const cor = metaColor(pct)
                    const bateu = c.meta > 0 && c.realizado >= c.meta
                    return (
                      <div
                        key={c.nome}
                        className={`rounded-xl px-3 py-2 ${c.voce ? 'bg-[var(--coral-soft)] ring-1 ring-[var(--coral)]' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[.74rem]">
                          <span className="flex items-center gap-2 truncate">
                            <span className="text-[var(--text-muted)]">{i + 1}º</span>
                            <span className="font-semibold text-white">{c.nome}</span>
                            {c.voce && (
                              <span className="rounded-full bg-[var(--coral)] px-2 py-0.5 text-[.58rem] font-bold uppercase text-white">
                                Você
                              </span>
                            )}
                          </span>
                          <span className="whitespace-nowrap" style={{ color: cor.fillColor }}>
                            {c.realizado}/{c.meta > 0 ? c.meta : '—'} {bateu ? '✅' : ''}
                          </span>
                        </div>
                        <div className="meta-track" style={{ margin: '6px 0 2px' }}>
                          <div className="meta-fill" style={{ width: `${pctClamped}%`, background: cor.fillColor }} />
                          <span className="meta-runner" style={{ left: `${pctClamped}%` }}>
                            🚗
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {unidadeGerente && (
              <MetaWidget
                titulo={`Meta da unidade — ${nomeUnidadeGerente}`}
                subtitulo={mesLabel(mes)}
                semMeta={metaUnidadeGerente <= 0}
                faltam={faltamDe(metaUnidadeGerente, realizadoUnidadeGerente)}
                realizadoLabel={`${realizadoUnidadeGerente} vendas`}
                metaLabel={`${metaUnidadeGerente} vendas`}
                pct={pctDe(metaUnidadeGerente, realizadoUnidadeGerente)}
              />
            )}

            {veTudoMetas && filtroConsultor ? (
              <MetaWidget
                titulo={`Meta — ${nomeFiltroConsultor}`}
                subtitulo={mesLabel(mes)}
                semMeta={metaFiltroConsultor <= 0}
                faltam={faltamDe(metaFiltroConsultor, realizadoFiltroConsultor)}
                realizadoLabel={`${realizadoFiltroConsultor} vendas`}
                metaLabel={`${metaFiltroConsultor} vendas`}
                pct={pctDe(metaFiltroConsultor, realizadoFiltroConsultor)}
              />
            ) : veTudoMetas && filtroUnidade ? (
              <MetaWidget
                titulo={`Meta da unidade — ${nomeFiltroUnidade}`}
                subtitulo={mesLabel(mes)}
                semMeta={metaFiltroUnidade <= 0}
                faltam={faltamDe(metaFiltroUnidade, realizadoFiltroUnidade)}
                realizadoLabel={`${realizadoFiltroUnidade} vendas`}
                metaLabel={`${metaFiltroUnidade} vendas`}
                pct={pctDe(metaFiltroUnidade, realizadoFiltroUnidade)}
              />
            ) : veTudoMetas ? (
              <>
                <MetaWidget
                  titulo="Meta da empresa"
                  subtitulo={mesLabel(mes)}
                  semMeta={metaEmpresa <= 0}
                  faltam={faltamDe(metaEmpresa, realizadoEmpresa)}
                  realizadoLabel={`${realizadoEmpresa} vendas`}
                  metaLabel={`${metaEmpresa} vendas`}
                  pct={pctDe(metaEmpresa, realizadoEmpresa)}
                />
                {unidadesMeta.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {unidadesMeta.map((u) => {
                      const metaU = metaPorUnidade.get(u.id) ?? 0
                      const realU = realizadoPorUnidade.get(u.id) ?? 0
                      return (
                        <MetaWidget
                          key={u.id}
                          titulo={u.nome}
                          semMeta={metaU <= 0}
                          faltam={faltamDe(metaU, realU)}
                          realizadoLabel={`${realU} vendas`}
                          metaLabel={`${metaU} vendas`}
                          pct={pctDe(metaU, realU)}
                        />
                      )
                    })}
                  </div>
                )}

                {consultoresMeta.length > 0 && (
                  <div>
                    <div className="sec-header">
                      <div className="sec-title">Metas por consultor</div>
                    </div>
                    <div className="sec-body sec-pad flex flex-col gap-3">
                      {consultoresMeta.map((c) => {
                        const pct = pctDe(c.meta, c.realizado)
                        const pctClamped = Math.min(Math.max(pct, 0), 100)
                        const faltam = faltamDe(c.meta, c.realizado)
                        const cor = metaColor(pct)
                        const bateu = c.meta > 0 && c.realizado >= c.meta
                        return (
                          <div key={c.nome}>
                            <div className="flex items-center justify-between gap-2 text-[.74rem]">
                              <span className="truncate font-semibold text-white">{c.nome}</span>
                              <span className="whitespace-nowrap" style={{ color: cor.fillColor }}>
                                {c.realizado}/{c.meta > 0 ? c.meta : '—'}
                                {bateu ? ' · bateu ✅' : c.meta > 0 ? ` · faltam ${faltam}` : ''}
                              </span>
                            </div>
                            <div className="meta-track" style={{ margin: '6px 0 2px' }}>
                              <div className="meta-fill" style={{ width: `${pctClamped}%`, background: cor.fillColor }} />
                              <span className="meta-runner" style={{ left: `${pctClamped}%` }}>
                                🚗
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div className="kpi-grid">
            <StatCard label={isGerencia ? 'Leads' : 'Meus leads'} value={totalLeads ?? 0} />
            <StatCard
              label={isGerencia ? 'Atendimentos' : 'Meus atendimentos'}
              value={totalAtendimentos ?? 0}
            />
            <StatCard
              label={isGerencia ? 'Lembretes pendentes' : 'Meus lembretes pendentes'}
              value={lembretesPendentes ?? 0}
            />
          </div>

          {isGerencia && (
            <div className="mt-6 flex flex-col gap-6">
              <DesempenhoTable rows={desempenho} maiorConv={maiorConv} />
              <RankingCard
                title="Leads por unidade"
                rows={rankingLeadsUnidade.map((r) => ({
                  key: r.unidade_id,
                  label: r.unidade_nome,
                  total: r.total,
                }))}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">{value}</div>
    </div>
  )
}

function DesempenhoTable({ rows, maiorConv }: { rows: DesempenhoRow[]; maiorConv: number }) {
  return (
    <div>
      <div className="sec-header">
        <div className="sec-title">Desempenho por consultor</div>
        <span className="text-[.66rem] normal-case text-[var(--text-muted)]">
          Conversão = vendas ÷ leads
        </span>
      </div>
      <div className="sec-body" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <p className="sec-pad text-[.8rem] text-[var(--text-muted)]">Sem dados no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[.8rem]">
              <thead>
                <tr className="text-left text-[.64rem] uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-4 py-2 font-bold">Consultor</th>
                  <th className="px-3 py-2 text-right font-bold">Leads</th>
                  <th className="px-3 py-2 text-right font-bold">Atend.</th>
                  <th className="px-3 py-2 text-right font-bold">Vendas</th>
                  <th className="px-4 py-2 text-right font-bold">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  // Barra/​cor relativas ao melhor conversor da lista.
                  const rel = maiorConv > 0 ? (r.conv / maiorConv) * 100 : 0
                  const cor = metaColor(rel).fillColor
                  return (
                    <tr key={r.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{r.nome}</p>
                        {r.unidade && (
                          <p className="text-[.66rem] normal-case text-[var(--text-muted)]">{r.unidade}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-white">{r.leads}</td>
                      <td className="px-3 py-3 text-right text-[var(--text-muted)]">{r.atend}</td>
                      <td className="px-3 py-3 text-right font-bold text-white">{r.vendas}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/10 sm:block"
                            title="Conversão relativa ao melhor da lista"
                          >
                            <div style={{ width: `${Math.min(rel, 100)}%`, height: '100%', background: cor }} />
                          </div>
                          <span className="w-12 text-right font-bold" style={{ color: cor }}>
                            {r.leads > 0 ? `${Math.round(r.conv)}%` : '—'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function RankingCard({
  title,
  rows,
}: {
  title: string
  rows: { key: string; label: string; sublabel?: string; total: number }[]
}) {
  return (
    <div>
      <div className="sec-header">
        <div className="sec-title">{title}</div>
      </div>
      <div className="sec-body sec-pad">
        {rows.length === 0 ? (
          <p className="text-[.8rem] text-[var(--text-muted)]">Sem dados ainda.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <li key={row.key} className="flex items-center justify-between text-[.82rem]">
                <span className="text-white">
                  <span className="mr-2 text-[var(--text-muted)]">{i + 1}.</span>
                  {row.label}
                  {row.sublabel && (
                    <span className="ml-1 text-[var(--text-muted)]">· {row.sublabel}</span>
                  )}
                </span>
                <span className="font-bold text-white">{row.total}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
