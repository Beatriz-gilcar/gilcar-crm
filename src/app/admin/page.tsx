import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { cargoLabel, cargoBadgeClass } from '@/lib/membros'

type Membro = {
  id: string
  nome: string
  cargo: string
  unidade_id: string | null
  unidades: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade_id?: string; cargo?: string }>
}) {
  const { unidade_id, cargo } = await searchParams
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

  if (profile?.cargo !== 'admin') {
    redirect('/')
  }

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  let query = supabase
    .from('profiles')
    .select('id, nome, cargo, unidade_id, unidades(nome)')
    .order('nome')

  if (unidade_id) query = query.eq('unidade_id', unidade_id)
  if (cargo) query = query.eq('cargo', cargo)

  const { data: membrosData } = await query.overrideTypes<Membro[]>()
  const membros = membrosData ?? []

  const adminClient = createAdminClient()
  const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 200 })
  const emailById = new Map(usersData?.users.map((u) => [u.id, u.email ?? '—']) ?? [])

  const porCargo = { consultor: 0, gerente: 0, admin: 0 } as Record<string, number>
  for (const m of membros) porCargo[m.cargo] = (porCargo[m.cargo] ?? 0) + 1

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia
        isAdmin
        active="admin"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Total da equipe</div>
              <div className="kpi-val">{membros.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Consultores</div>
              <div className="kpi-val">{porCargo.consultor ?? 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Gerência</div>
              <div className="kpi-val">{(porCargo.gerente ?? 0) + (porCargo.admin ?? 0)}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Equipe
            </div>
            <Link href="/admin/new" className="btn btn-red btn-sm">
              + Novo membro
            </Link>
          </div>
          <div className="card sec-pad mt-3">
            <form className="flex flex-col gap-3" method="get">
              <div className="chip-row">
                <ToggleGroup
                  name="unidade_id"
                  defaultValue={unidade_id ?? ''}
                  options={[{ value: '', label: 'Todas as unidades' }, ...unidades.map((u) => ({ value: u.id, label: u.nome }))]}
                />
              </div>
              <div className="chip-row">
                <ToggleGroup
                  name="cargo"
                  defaultValue={cargo ?? ''}
                  options={[
                    { value: '', label: 'Todos os cargos' },
                    ...Object.entries(cargoLabel).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
              <button type="submit" className="btn btn-outline btn-sm self-start">
                Filtrar
              </button>
            </form>
          </div>
          <div className="sec-body mt-4" style={{ padding: 0 }}>
            {membros.length === 0 ? (
              <div className="empty-state">Nenhum membro encontrado.</div>
            ) : (
              <div className="flex flex-col">
                {membros.map((membro) => (
                  <Link
                    key={membro.id}
                    href={`/admin/${membro.id}`}
                    className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-white/[.03]"
                  >
                    <div>
                      <p className="font-semibold text-white">{membro.nome}</p>
                      <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
                        {emailById.get(membro.id) ?? '—'}
                        {membro.unidades?.nome ? ` · ${membro.unidades.nome}` : ' · sem unidade'}
                      </p>
                    </div>
                    <span className={`badge ${cargoBadgeClass[membro.cargo]}`}>
                      {cargoLabel[membro.cargo]}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
