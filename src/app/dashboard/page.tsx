import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'

type RankingConsultor = {
  consultor_id: string
  consultor_nome: string
  unidade_nome: string
  total: number
}

type RankingUnidade = {
  unidade_id: string
  unidade_nome: string
  total: number
}

type RankingAtendimentoConsultor = {
  consultor_id: string
  consultor_nome: string
  total: number
}

type ProfileSummary = { nome: string; cargo: string }

export default async function DashboardPage() {
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

  const [{ count: totalLeads }, { count: totalAtendimentos }, { count: lembretesPendentes }] =
    await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }),
      supabase.from('atendimentos').select('*', { count: 'exact', head: true }),
      supabase
        .from('lembretes')
        .select('*', { count: 'exact', head: true })
        .eq('concluido', false),
    ])

  let rankingLeadsConsultor: RankingConsultor[] = []
  let rankingLeadsUnidade: RankingUnidade[] = []
  let rankingAtendimentosConsultor: RankingAtendimentoConsultor[] = []

  if (isGerencia) {
    const [leadsConsultor, leadsUnidade, atendConsultor] = await Promise.all([
      supabase.rpc('dashboard_leads_por_consultor'),
      supabase.rpc('dashboard_leads_por_unidade'),
      supabase.rpc('dashboard_atendimentos_por_consultor'),
    ])
    rankingLeadsConsultor = leadsConsultor.data ?? []
    rankingLeadsUnidade = leadsUnidade.data ?? []
    rankingAtendimentosConsultor = atendConsultor.data ?? []
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="dashboard"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
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
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <RankingCard
                title="Leads por consultor"
                rows={rankingLeadsConsultor.map((r) => ({
                  key: r.consultor_id,
                  label: r.consultor_nome,
                  sublabel: r.unidade_nome,
                  total: r.total,
                }))}
              />
              <RankingCard
                title="Leads por unidade"
                rows={rankingLeadsUnidade.map((r) => ({
                  key: r.unidade_id,
                  label: r.unidade_nome,
                  total: r.total,
                }))}
              />
              <RankingCard
                title="Atendimentos por consultor"
                rows={rankingAtendimentosConsultor.map((r) => ({
                  key: r.consultor_id,
                  label: r.consultor_nome,
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
