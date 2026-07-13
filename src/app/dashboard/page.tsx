import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'

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
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-4 py-10 dark:bg-black sm:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Início
        </Link>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Dashboard</h1>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={isGerencia ? 'Leads' : 'Meus leads'}
            value={totalLeads ?? 0}
          />
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
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-black dark:text-zinc-50">{value}</p>
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
    <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-black dark:text-zinc-50">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Sem dados ainda.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {rows.map((row, i) => (
            <li key={row.key} className="flex items-center justify-between text-sm">
              <span className="text-black dark:text-zinc-50">
                <span className="mr-2 text-zinc-400 dark:text-zinc-500">{i + 1}.</span>
                {row.label}
                {row.sublabel && (
                  <span className="ml-1 text-zinc-500 dark:text-zinc-400">· {row.sublabel}</span>
                )}
              </span>
              <span className="font-medium text-black dark:text-zinc-50">{row.total}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
