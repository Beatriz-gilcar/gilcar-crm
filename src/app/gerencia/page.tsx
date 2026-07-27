import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { tipoLabel, percentualColor } from '@/lib/checklists'
import { podeVerTudo } from '@/lib/membros'

type ChecklistRow = {
  id: string
  tipo: string
  data: string
  percentual_sim: number
  avaliado: { nome: string } | null
  avaliador: { nome: string } | null
  unidades: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }
type Gerente = { id: string; nome: string }

export default async function GerenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; avaliado_id?: string; mes?: string }>
}) {
  const { tipo, avaliado_id, mes } = await searchParams
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
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  if (!verTudo) {
    redirect('/')
  }

  let gerentes: Gerente[] = []
  if (isAdmin) {
    const { data } = await supabase.from('profiles').select('id, nome').eq('cargo', 'gerente').order('nome')
    gerentes = data ?? []
  }

  let query = supabase
    .from('checklists_gerencia')
    .select(
      'id, tipo, data, percentual_sim, avaliado:profiles!checklists_gerencia_avaliado_id_fkey(nome), avaliador:profiles!checklists_gerencia_avaliador_id_fkey(nome), unidades(nome)'
    )
    .order('data', { ascending: false })

  if (tipo) query = query.eq('tipo', tipo)
  if (isAdmin && avaliado_id) query = query.eq('avaliado_id', avaliado_id)
  if (mes) {
    const [ano, mesNum] = mes.split('-').map(Number)
    const inicio = `${mes}-01`
    const fim = new Date(ano, mesNum, 1).toISOString().slice(0, 10)
    query = query.gte('data', inicio).lt('data', fim)
  }

  const { data: checklistsData } = await query.overrideTypes<ChecklistRow[]>()
  const checklists = checklistsData ?? []

  const media =
    checklists.length > 0
      ? checklists.reduce((acc, c) => acc + c.percentual_sim, 0) / checklists.length
      : 0

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="status-do-dia"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="chip-row mb-4">
            <Link
              href="/status-do-dia"
              className="whitespace-nowrap rounded-full border border-[var(--border)] px-4 py-2 text-[.75rem] font-bold tracking-wide text-[var(--text-muted)] transition-colors hover:text-white"
            >
              Consultores
            </Link>
            <span className="whitespace-nowrap rounded-full bg-[var(--coral)] px-4 py-2 text-[.75rem] font-bold tracking-wide text-white">
              Gerentes
            </span>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Checklists preenchidos</div>
              <div className="kpi-val">{checklists.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Média de "Sim"</div>
              <div className="kpi-val">{media.toFixed(0)}%</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Gerência
            </div>
            <div className="flex gap-2">
              <Link href="/gerencia/regua" className="btn btn-outline btn-sm">
                Régua de Decisão
              </Link>
              <Link href="/gerencia/new" className="btn btn-red btn-sm">
                + Novo checklist
              </Link>
            </div>
          </div>

          <div className="card sec-pad mt-3">
            <form className="flex flex-col gap-3" method="get">
              <div className="chip-row">
                <ToggleGroup
                  name="tipo"
                  defaultValue={tipo ?? ''}
                  options={[
                    { value: '', label: 'Todos os tipos' },
                    ...Object.entries(tipoLabel).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
              <div className="filtros">
                <input name="mes" type="month" defaultValue={mes ?? ''} />
                {isAdmin && (
                  <select name="avaliado_id" defaultValue={avaliado_id ?? ''}>
                    <option value="">Todos os gerentes</option>
                    {gerentes.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                )}
                <button type="submit" className="btn btn-outline btn-sm">
                  Filtrar
                </button>
              </div>
            </form>
          </div>

          <div className="sec-body mt-4" style={{ padding: 0 }}>
            {checklists.length === 0 ? (
              <div className="empty-state">Nenhum checklist encontrado.</div>
            ) : (
              <div className="flex flex-col">
                {checklists.map((c) => {
                  const cor = percentualColor(c.percentual_sim)
                  return (
                    <Link
                      key={c.id}
                      href={`/gerencia/${c.id}`}
                      className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-white/[.03]"
                    >
                      <div>
                        <p className="font-semibold text-white">
                          {tipoLabel[c.tipo]}
                          <span className="ml-2 text-[.68rem] font-normal normal-case text-[var(--text-muted)]">
                            {c.avaliado?.nome ?? '—'}
                          </span>
                        </p>
                        <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
                          {c.unidades?.nome ?? '—'} · {new Date(`${c.data}T12:00:00`).toLocaleDateString('pt-BR')} ·
                          preenchido por {c.avaliador?.nome ?? '—'}
                        </p>
                      </div>
                      <span className={`badge ${cor.badgeClass}`}>{c.percentual_sim.toFixed(0)}% sim</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
