import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { SdrLancamento } from '@/components/SdrLancamento'
import { podeVerTudo } from '@/lib/membros'
import { salvarSdrLeads, validarDiaSdr, salvarLeadsRecebidosSdrs } from './actions'

type Profile = { nome: string; cargo: string; valida_sdr: boolean | null }
type Pessoa = { id: string; nome: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }
type LeadRow = { consultor_id: string; unidade_id: string | null; agendamentos: number; comparecimentos: number; lancado_por: string }

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
      .select('id, nome, unidade_id')
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
  const lojas = unidades.map((u) => ({
    id: u.id,
    nome: u.nome,
    consultores: pessoas.filter((p) => p.unidade_id === u.id).map((p) => ({ id: p.id, nome: p.nome })),
  }))
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
      supabase.from('sdr_leads').select('consultor_id, unidade_id, agendamentos, comparecimentos, lancado_por').gte('data', inicio).lte('data', fim).overrideTypes<LeadRow[]>(),
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
      const cl = porLoja.get(u) ?? { ag: 0, comp: 0 }; cl.ag += l.agendamentos; cl.comp += l.comparecimentos; porLoja.set(u, cl)
      const cc = porConsultor.get(l.consultor_id) ?? { ag: 0, comp: 0 }; cc.ag += l.agendamentos; cc.comp += l.comparecimentos; porConsultor.set(l.consultor_id, cc)
      const cs = porSdr.get(l.lancado_por) ?? { leads: 0, ag: 0, comp: 0 }; cs.ag += l.agendamentos; cs.comp += l.comparecimentos; porSdr.set(l.lancado_por, cs)
      geral.ag += l.agendamentos; geral.comp += l.comparecimentos
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
  const [{ data: leadsDia }, { data: val }, { data: diaRow }] = await Promise.all([
    supabase.from('sdr_leads').select('consultor_id, agendamentos, comparecimentos, observacao').eq('data', dia).eq('lancado_por', user.id).overrideTypes<{ consultor_id: string; agendamentos: number; comparecimentos: number; observacao: string | null }[]>(),
    supabase.from('sdr_dia_validado').select('data').eq('data', dia).maybeSingle<{ data: string }>(),
    supabase.from('sdr_dia').select('leads_recebidos').eq('data', dia).eq('sdr_id', user.id).maybeSingle<{ leads_recebidos: number }>(),
  ])
  const validado = Boolean(val)
  const leadsRecebidosInicial = diaRow?.leads_recebidos ?? 0
  const valoresIniciais: Record<string, { leads: number; agendamentos: number; comparecimentos: number; observacao: string }> = {}
  for (const l of leadsDia ?? [])
    valoresIniciais[l.consultor_id] = {
      leads: 0,
      agendamentos: l.agendamentos,
      comparecimentos: l.comparecimentos,
      observacao: l.observacao ?? '',
    }
  // Depois de validado, ninguém mexe (a Thuane valida no consolidado).
  const podeEditar = !validado

  return (
    <>
      {topbar}
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
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

          <div className="mt-4">
            <SdrLancamento
              data={dia}
              lojas={lojas}
              valoresIniciais={valoresIniciais}
              leadsRecebidosInicial={leadsRecebidosInicial}
              validado={validado}
              podeValidar={false}
              podeEditar={podeEditar}
              salvarAction={salvarSdrLeads}
              validarAction={validarDiaSdr}
            />
          </div>
        </div>
      </div>
    </>
  )
}
