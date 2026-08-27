import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo } from '@/lib/membros'
import { normalizarTelefone } from '@/lib/whatsapp'
import {
  adicionarLeadSdr,
  salvarLeadsRecebidosProprio,
  validarDiaSdr,
  salvarLeadsRecebidosSdrs,
} from './actions'
import { atualizarVisita } from './historico/actions'

type Profile = { nome: string; cargo: string; valida_sdr: boolean | null }
type Pessoa = { id: string; nome: string; unidade_id: string | null; ativo: boolean }
type Unidade = { id: string; nome: string }
// Cada lead lançado conta como 1 agendamento; visita = 'SIM' conta como
// comparecimento. Substitui os números digitados à mão de antes.
type LeadRow = { consultor_id: string; unidade_id: string | null; lancado_por: string | null; visita: string | null }
type LeadDoDia = {
  id: string
  cliente_nome: string
  cliente_telefone: string | null
  consultor_id: string
  motivo: string | null
  veiculo_interesse: string | null
  origem: string | null
  observacao: string | null
  visita: string | null
}

const visitaBadge: Record<string, string> = {
  SIM: 'badge-aprovado',
  NÃO: 'badge-rejeitado',
  REAGENDOU: 'badge-pendente',
}

function hojeBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
function inicioMesBR(): string {
  return hojeBR().slice(0, 7) + '-01'
}
function pct(part: number, todo: number): number {
  return todo > 0 ? (part / todo) * 100 : 0
}

export default async function SdrPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; de?: string; ate?: string; vdia?: string; error?: string; success?: string }>
}) {
  const { data: dataParam, de, ate, vdia, error, success } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo, valida_sdr')
    .eq('id', user.id)
    .single<Profile>()

  const isAdmin = profile?.cargo === 'admin'
  const isSdrCargo = profile?.cargo === 'sdr'
  // Thuane (valida_sdr) e Junior (admin) veem o consolidado; as SDRs comuns
  // preenchem o próprio lançamento.
  const podeValidar = profile?.valida_sdr === true || isAdmin
  if (!isAdmin && !isSdrCargo) redirect('/')

  const admin = createAdminClient()
  const [pessoasRes, unidadesRes, sdrsRes] = await Promise.all([
    // Ativo normalmente; quem tem a flag visivel_sdr_mesmo_inativo continua
    // aparecendo mesmo desativado (compromissos já marcados antes de sair) —
    // sem isso, TODO inativo voltaria à lista, inclusive cadastros antigos
    // já substituídos por um cadastro novo (duplicata visual).
    admin
      .from('profiles')
      .select('id, nome, unidade_id, ativo')
      .in('cargo', ['consultor', 'supervisor'])
      .or('ativo.eq.true,visivel_sdr_mesmo_inativo.eq.true')
      .order('nome')
      .overrideTypes<Pessoa[]>(),
    admin.from('unidades').select('id, nome').order('nome').overrideTypes<Unidade[]>(),
    admin.from('profiles').select('id, nome').eq('cargo', 'sdr').eq('ativo', true).order('nome').overrideTypes<{ id: string; nome: string }[]>(),
  ])
  const pessoas = pessoasRes.data ?? []
  const unidades = unidadesRes.data ?? []
  const sdrs = sdrsRes.data ?? []
  const nomeConsultor = new Map(pessoas.map((p) => [p.id, p.nome]))
  const nomeUnidade = new Map(unidades.map((u) => [u.id, u.nome]))
  const nomeSdr = new Map(sdrs.map((s) => [s.id, s.nome]))

  const topbar = (
    <Topbar nome={profile?.nome ?? user.email ?? ''} cargo={profile?.cargo ?? ''} verTudo={podeVerTudo(profile?.cargo)} isAdmin={isAdmin} active="sdr" />
  )
  const aviso = (
    <>
      {error && <p className="rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">{error}</p>}
      {success && <p className="rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">{success === 'salvo' ? 'Lançamento salvo.' : success === 'validado' ? 'Dia validado.' : 'Validação desfeita.'}</p>}
    </>
  )

  // ── CONSOLIDADO (Thuane e Junior) ────────────────────────────────────────
  if (podeValidar) {
    const inicio = de || inicioMesBR()
    const fim = ate || hojeBR()
    const vDia = vdia || hojeBR()
    const [{ data: linhasData }, { data: diasData }, { data: valDia }, { data: leadsInicioData }] = await Promise.all([
      supabase
        .from('sdr_leads_historico')
        .select('consultor_id, unidade_id, lancado_por, visita')
        .gte('data', inicio)
        .lte('data', fim)
        .overrideTypes<LeadRow[]>(),
      supabase.from('sdr_dia').select('sdr_id, leads_recebidos').gte('data', inicio).lte('data', fim).overrideTypes<{ sdr_id: string; leads_recebidos: number }[]>(),
      supabase.from('sdr_dia_validado').select('data').eq('data', vDia).maybeSingle<{ data: string }>(),
      // O lançamento por SDR fica ancorado no início do período (De) — é o
      // valor que representa "o total desse período", não um dia avulso.
      supabase.from('sdr_dia').select('sdr_id, leads_recebidos').eq('data', inicio).overrideTypes<{ sdr_id: string; leads_recebidos: number }[]>(),
    ])
    const linhas = linhasData ?? []
    const dias = diasData ?? []
    const validadoDia = Boolean(valDia)
    const leadsInicio = new Map((leadsInicioData ?? []).map((d) => [d.sdr_id, d.leads_recebidos]))

    const porLoja = new Map<string, { ag: number; comp: number }>()
    const porConsultor = new Map<string, { ag: number; comp: number }>()
    const porSdr = new Map<string, { leads: number; ag: number; comp: number }>()
    const geral = { ag: 0, comp: 0 }
    for (const l of linhas) {
      const u = l.unidade_id ?? '—'
      const sdrId = l.lancado_por ?? '—'
      const comp = l.visita === 'SIM' ? 1 : 0
      const cl = porLoja.get(u) ?? { ag: 0, comp: 0 }; cl.ag += 1; cl.comp += comp; porLoja.set(u, cl)
      const cc = porConsultor.get(l.consultor_id) ?? { ag: 0, comp: 0 }; cc.ag += 1; cc.comp += comp; porConsultor.set(l.consultor_id, cc)
      const cs = porSdr.get(sdrId) ?? { leads: 0, ag: 0, comp: 0 }; cs.ag += 1; cs.comp += comp; porSdr.set(sdrId, cs)
      geral.ag += 1; geral.comp += comp
    }
    let leadsRecebidos = 0
    for (const d of dias) {
      leadsRecebidos += d.leads_recebidos
      const cs = porSdr.get(d.sdr_id) ?? { leads: 0, ag: 0, comp: 0 }; cs.leads += d.leads_recebidos; porSdr.set(d.sdr_id, cs)
    }

    const sdrOrd = [...porSdr.entries()]
      .map(([id, v]) => ({ nome: nomeSdr.get(id) ?? '—', ...v }))
      .filter((s) => s.leads || s.ag || s.comp)
      .sort((a, b) => b.leads - a.leads || b.ag - a.ag)
    const consultoresOrd = [...porConsultor.entries()]
      .map(([id, v]) => ({ nome: nomeConsultor.get(id) ?? '—', unidade: nomeUnidade.get(pessoas.find((p) => p.id === id)?.unidade_id ?? '') ?? '', ...v }))
      .filter((c) => c.ag || c.comp)
      .sort((a, b) => b.ag - a.ag || b.comp - a.comp)

    return (
      <>
        {topbar}
        <div className="flex flex-1 flex-col gap-5 px-4 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-4xl">
            <div className="chip-row mb-4">
              <span className="toggle-btn ativo">Consolidado</span>
              <Link href="/sdr/historico" className="toggle-btn">
                Histórico de leads
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>SDR — Consolidado</div>
              <form method="get" className="flex flex-wrap items-end gap-2">
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 150 }}><label>De</label><input type="date" name="de" defaultValue={inicio} /></div>
                <div className="form-group" style={{ marginBottom: 0, maxWidth: 150 }}><label>Até</label><input type="date" name="ate" defaultValue={fim} /></div>
                <button type="submit" className="btn btn-outline btn-sm">Ver</button>
              </form>
            </div>

            {aviso}

            {/* Validação do dia (Thuane) */}
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <form method="get" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="de" value={inicio} />
                <input type="hidden" name="ate" value={fim} />
                <span className="text-[.74rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">Validar dia</span>
                <input type="date" name="vdia" defaultValue={vDia} />
                <button type="submit" className="btn btn-outline btn-sm">Ver dia</button>
              </form>
              <form action={validarDiaSdr} className="mt-2 flex items-center gap-3">
                <input type="hidden" name="data" value={vDia} />
                <input type="hidden" name="desvalidar" value={validadoDia ? '1' : '0'} />
                <button type="submit" className={`btn btn-sm ${validadoDia ? 'btn-outline' : 'btn-red'}`}>
                  {validadoDia ? 'Desfazer validação' : `Validar ${vDia.split('-').reverse().join('/')}`}
                </button>
                {validadoDia && <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-[.72rem] font-bold text-[var(--success)]">✓ Dia validado</span>}
              </form>
            </div>

            {/* Leads recebidos por SDR — total do período De/Até escolhido acima
                (não de um dia avulso), pra Thuane lançar o total do mês de uma vez. */}
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <span className="text-[.74rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Leads recebidos por SDR — total de {inicio.split('-').reverse().join('/')} a {fim.split('-').reverse().join('/')}
              </span>
              <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
                Digite o total do período (ex.: o mês inteiro) — não é um lançamento por dia.
              </p>
              {sdrs.length === 0 ? (
                <p className="mt-2 text-[.78rem] normal-case text-[var(--text-muted)]">Nenhuma SDR cadastrada.</p>
              ) : (
                <form action={salvarLeadsRecebidosSdrs} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="data" value={inicio} />
                  <input type="hidden" name="de" value={inicio} />
                  <input type="hidden" name="ate" value={fim} />
                  {sdrs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3">
                      <span className="text-[.8rem] normal-case text-white">{s.nome}</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        name={`leads_${s.id}`}
                        defaultValue={leadsInicio.get(s.id) ?? 0}
                        aria-label={`Leads recebidos de ${s.nome}`}
                        className="text-center"
                        style={{ width: '6rem', flex: '0 0 auto' }}
                      />
                    </div>
                  ))}
                  <button type="submit" className="btn btn-outline btn-sm mt-1 self-start">Salvar leads recebidos</button>
                </form>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[.8rem] font-extrabold uppercase tracking-wide text-white">Total da empresa</span>
                <span className="flex flex-wrap gap-4 text-[.95rem] font-extrabold tabular-nums">
                  <span className="text-[var(--coral)]">{leadsRecebidos} leads</span>
                  <span className="text-white">{geral.ag} agend.</span>
                  <span className="text-[var(--success)]">{geral.comp} compar.</span>
                  <span className="text-[var(--text-muted)]">{Math.round(pct(geral.ag, leadsRecebidos))}% agend. · {Math.round(pct(geral.comp, geral.ag))}% comparec.</span>
                </span>
              </div>
            </div>

            {/* Por SDR */}
            <div className="sec-header mt-6"><div className="sec-title">Por SDR</div></div>
            <div className="sec-body" style={{ padding: 0 }}>
              {sdrOrd.length === 0 ? (
                <div className="empty-state">Nenhum lançamento no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[.82rem]">
                    <thead><tr className="text-left text-[.64rem] uppercase tracking-wide text-[var(--text-muted)]">
                      <th className="px-4 py-2 font-bold">SDR</th><th className="px-3 py-2 text-right font-bold">Leads</th><th className="px-3 py-2 text-right font-bold">Agend.</th><th className="px-3 py-2 text-right font-bold">Compar.</th><th className="px-3 py-2 text-right font-bold">% agend.</th><th className="px-4 py-2 text-right font-bold">% comparec.</th>
                    </tr></thead>
                    <tbody>
                      {sdrOrd.map((s, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="px-4 py-2.5 font-semibold text-white">{s.nome}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-[var(--coral)]">{s.leads}</td>
                          <td className="px-3 py-2.5 text-right text-white">{s.ag}</td>
                          <td className="px-3 py-2.5 text-right text-[var(--success)]">{s.comp}</td>
                          <td className="px-3 py-2.5 text-right text-[var(--text-muted)]">{Math.round(pct(s.ag, s.leads))}%</td>
                          <td className="px-4 py-2.5 text-right font-bold text-white">{Math.round(pct(s.comp, s.ag))}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Por loja */}
            <div className="sec-header mt-6"><div className="sec-title">Por loja</div></div>
            <div className="sec-body" style={{ padding: 0 }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[.82rem]">
                  <thead><tr className="text-left text-[.64rem] uppercase tracking-wide text-[var(--text-muted)]">
                    <th className="px-4 py-2 font-bold">Loja</th><th className="px-3 py-2 text-right font-bold">Agend.</th><th className="px-3 py-2 text-right font-bold">Compar.</th><th className="px-4 py-2 text-right font-bold">% comparec.</th>
                  </tr></thead>
                  <tbody>
                    {unidades.map((u) => {
                      const v = porLoja.get(u.id) ?? { ag: 0, comp: 0 }
                      return (
                        <tr key={u.id} className="border-t border-[var(--border)]">
                          <td className="px-4 py-2.5 font-semibold text-white">{u.nome}</td>
                          <td className="px-3 py-2.5 text-right text-white">{v.ag}</td>
                          <td className="px-3 py-2.5 text-right text-[var(--success)]">{v.comp}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-white">{Math.round(pct(v.comp, v.ag))}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Por consultor */}
            <div className="sec-header mt-6"><div className="sec-title">Por consultor</div></div>
            <div className="sec-body" style={{ padding: 0 }}>
              {consultoresOrd.length === 0 ? (
                <div className="empty-state">Nenhum lançamento no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[.82rem]">
                    <thead><tr className="text-left text-[.64rem] uppercase tracking-wide text-[var(--text-muted)]">
                      <th className="px-4 py-2 font-bold">Consultor</th><th className="px-3 py-2 text-right font-bold">Agend.</th><th className="px-3 py-2 text-right font-bold">Compar.</th><th className="px-4 py-2 text-right font-bold">% comparec.</th>
                    </tr></thead>
                    <tbody>
                      {consultoresOrd.map((c, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="px-4 py-2.5"><p className="font-semibold text-white">{c.nome}</p><p className="text-[.66rem] normal-case text-[var(--text-muted)]">{c.unidade}</p></td>
                          <td className="px-3 py-2.5 text-right text-white">{c.ag}</td>
                          <td className="px-3 py-2.5 text-right text-[var(--success)]">{c.comp}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-white">{Math.round(pct(c.comp, c.ag))}%</td>
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

  // ── LANÇAMENTO (cada SDR preenche o dela) ────────────────────────────────
  const dia = dataParam || hojeBR()
  const [{ data: leadsDiaData }, { data: val }, { data: diaRow }] = await Promise.all([
    supabase
      .from('sdr_leads_historico')
      .select('id, cliente_nome, cliente_telefone, consultor_id, motivo, veiculo_interesse, origem, observacao, visita')
      .eq('data', dia)
      .eq('lancado_por', user.id)
      .order('created_at', { ascending: false })
      .overrideTypes<LeadDoDia[]>(),
    supabase.from('sdr_dia_validado').select('data').eq('data', dia).maybeSingle<{ data: string }>(),
    supabase.from('sdr_dia').select('leads_recebidos').eq('data', dia).eq('sdr_id', user.id).maybeSingle<{ leads_recebidos: number }>(),
  ])
  const leadsDia = leadsDiaData ?? []
  const validado = Boolean(val)
  const leadsRecebidosInicial = diaRow?.leads_recebidos ?? 0
  // Depois de validado, ninguém lança lead novo (a Thuane valida no consolidado).
  const podeEditar = !validado

  // Inativo só entra no seletor do dia se já tiver lead lançado NESSE dia —
  // some do dia de hoje (não faz sentido lançar pra quem já saiu), mas
  // continua aparecendo num dia antigo que já tem lead dele.
  const idsComLancamentoHoje = new Set(leadsDia.map((l) => l.consultor_id))
  const lojas = unidades.map((u) => ({
    id: u.id,
    nome: u.nome,
    consultores: pessoas
      .filter((p) => p.unidade_id === u.id && (p.ativo || idsComLancamentoHoje.has(p.id)))
      .map((p) => ({ id: p.id, nome: p.nome })),
  }))

  const voltarParaDia = `/sdr?data=${dia}`

  return (
    <>
      {topbar}
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <div className="chip-row mb-4">
            <span className="toggle-btn ativo">Meu lançamento</span>
            <Link href="/sdr/historico" className="toggle-btn">
              Histórico de leads
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>Meu lançamento de leads — SDR</div>
            <form method="get" className="flex items-center gap-2">
              <input type="date" name="data" defaultValue={dia} />
              <button type="submit" className="btn btn-outline btn-sm">Ver dia</button>
            </form>
          </div>

          {aviso}
          {validado && (
            <p className="mt-2 rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
              Dia já validado pela gerente — não é mais editável.
            </p>
          )}

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <form action={salvarLeadsRecebidosProprio} className="flex flex-wrap items-center justify-between gap-3">
              <input type="hidden" name="data" value={dia} />
              <div>
                <p className="text-[.8rem] font-extrabold uppercase tracking-wide text-white">Leads recebidos (empresa)</p>
                <p className="text-[.66rem] normal-case text-[var(--text-muted)]">Total de leads que a equipe recebeu no dia.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  name="leads_recebidos"
                  disabled={!podeEditar}
                  defaultValue={leadsRecebidosInicial}
                  aria-label="Total de leads recebidos"
                  className="text-center font-extrabold"
                  style={{ width: '7rem', flex: '0 0 auto', fontSize: '1.1rem' }}
                />
                {podeEditar && <button type="submit" className="btn btn-outline btn-sm">Salvar</button>}
              </div>
            </form>
          </div>

          {podeEditar && (
            <form action={adicionarLeadSdr} className="card sec-pad mt-4 flex flex-col gap-3">
              <input type="hidden" name="data" value={dia} />
              <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0, fontSize: '.82rem' }}>
                Novo lead
              </div>
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Consultor</label>
                  <select name="consultor_id" required defaultValue="">
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {lojas.map((loja) => (
                      <optgroup key={loja.id} label={loja.nome}>
                        {loja.consultores.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nome do cliente</label>
                  <input name="cliente_nome" type="text" required />
                </div>
              </div>
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Telefone</label>
                  <input name="cliente_telefone" type="text" placeholder="21999999999" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Motivo</label>
                  <input name="motivo" type="text" placeholder="Ex.: Compra" />
                </div>
              </div>
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Veículo de interesse</label>
                  <input name="veiculo_interesse" type="text" placeholder="Ex.: Biz" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Origem</label>
                  <input name="origem" type="text" placeholder="Ex.: WhatsApp, indicação..." />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Observação</label>
                <input name="observacao" type="text" />
              </div>
              <button type="submit" className="btn btn-red self-start">
                Adicionar lead
              </button>
            </form>
          )}

          <div className="mt-4">
            <div className="sec-header">
              <div className="sec-title">Leads lançados hoje ({leadsDia.length})</div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {leadsDia.length === 0 ? (
                <div className="empty-state">Nenhum lead lançado nesse dia.</div>
              ) : (
                <div className="flex flex-col">
                  {leadsDia.map((l) => {
                    const telefoneWa = normalizarTelefone(l.cliente_telefone)
                    return (
                      <div key={l.id} className="flex flex-col gap-1 border-t border-[var(--border)] px-4 py-3 first:border-t-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {telefoneWa ? (
                            <a
                              href={`https://wa.me/${telefoneWa}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-white underline decoration-[var(--text-muted)] hover:text-[var(--coral)]"
                            >
                              {l.cliente_nome}
                              {l.cliente_telefone ? ` · ${l.cliente_telefone}` : ''}
                            </a>
                          ) : (
                            <p className="font-semibold text-white">{l.cliente_nome}</p>
                          )}
                          <form action={atualizarVisita} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={l.id} />
                            <input type="hidden" name="voltar_para" value={voltarParaDia} />
                            {(['SIM', 'NÃO', 'REAGENDOU'] as const).map((v) => (
                              <button
                                key={v}
                                type="submit"
                                name="visita"
                                value={v}
                                className={`badge ${l.visita === v ? (visitaBadge[v] ?? 'badge-neutro') : 'badge-neutro'}`}
                                style={{ cursor: 'pointer', opacity: l.visita === v ? 1 : 0.45 }}
                                title={`Marcar como ${v}`}
                              >
                                {v}
                              </button>
                            ))}
                          </form>
                        </div>
                        <p className="text-[.72rem] text-[var(--text-muted)]">
                          {nomeConsultor.get(l.consultor_id) ?? '—'}
                        </p>
                        <p className="normal-case text-white">
                          {[l.motivo, l.veiculo_interesse, l.origem].filter(Boolean).join(' · ')}
                        </p>
                        {l.observacao && <p className="text-[.78rem] normal-case text-[var(--text-muted)]">{l.observacao}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
