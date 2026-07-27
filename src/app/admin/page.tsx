import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { ConfirmButton } from '@/components/ConfirmButton'
import { cargoLabel, cargoBadgeClass } from '@/lib/membros'
import { formatarTelefone } from '@/lib/whatsapp'
import { alternarAtivoMembro } from './actions'

type Membro = {
  id: string
  nome: string
  cargo: string
  unidade_id: string | null
  gerente_responsavel: string | null
  telefone: string | null
  ativo: boolean
  unidades: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade_id?: string; cargo?: string; situacao?: string; error?: string }>
}) {
  const { unidade_id, cargo, situacao, error } = await searchParams
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

  const verInativos = situacao === 'inativos'

  let query = supabase
    .from('profiles')
    .select('id, nome, cargo, unidade_id, gerente_responsavel, telefone, ativo, unidades(nome)')
    .eq('ativo', !verInativos)
    .order('nome')

  if (unidade_id) query = query.eq('unidade_id', unidade_id)
  if (cargo) query = query.eq('cargo', cargo)

  const { data: membrosData } = await query.overrideTypes<Membro[]>()
  const membros = membrosData ?? []

  const adminClient = createAdminClient()
  const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 200 })
  const emailById = new Map(usersData?.users.map((u) => [u.id, u.email ?? '—']) ?? [])

  const porCargo: Record<string, number> = {}
  for (const m of membros) porCargo[m.cargo] = (porCargo[m.cargo] ?? 0) + 1

  // Um card por cargo, em vez de um "Gerência" somando gerente + supervisor +
  // admin: aquele número lia como "N gerentes" e não era. Só entram os cargos
  // que existem de fato na listagem filtrada.
  const cargosNaEquipe = Object.keys(cargoLabel).filter((c) => (porCargo[c] ?? 0) > 0)

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo
        isAdmin
        active="admin"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">{verInativos ? 'Inativos' : 'Total da equipe'}</div>
              <div className="kpi-val">{membros.length}</div>
            </div>
            {cargosNaEquipe.map((c) => (
              <div key={c} className="kpi-card">
                <div className="kpi-label">{cargoLabel[c]}</div>
                <div className="kpi-val">{porCargo[c]}</div>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
              {error}
            </p>
          )}

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
              <div className="chip-row">
                <ToggleGroup
                  name="situacao"
                  defaultValue={situacao ?? ''}
                  options={[
                    { value: '', label: 'Ativos' },
                    { value: 'inativos', label: 'Inativos' },
                  ]}
                />
              </div>
              <button type="submit" className="btn btn-outline btn-sm self-start">
                Filtrar
              </button>
            </form>
          </div>
          <div className="mt-4">
            {membros.length === 0 ? (
              <div className="sec-body">
                <div className="empty-state">
                  {verInativos ? 'Nenhum membro inativo.' : 'Nenhum membro encontrado.'}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {membros.map((membro) => (
                  <div key={membro.id} className="card sec-pad flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-white">{membro.nome}</p>
                      <span className={`badge ${cargoBadgeClass[membro.cargo]}`}>
                        {cargoLabel[membro.cargo]}
                      </span>
                    </div>

                    <div className="flex flex-col gap-[2px] text-[.72rem] normal-case text-[var(--text-muted)]">
                      <span>{membro.unidades?.nome ?? 'Todas'}</span>
                      <span className="break-all">{emailById.get(membro.id) ?? '—'}</span>
                      <span>Gerente: {membro.gerente_responsavel || '—'}</span>
                      {/* Sem número a pessoa não recebe aviso nenhum, e isso
                          seria invisível sem apontar aqui. */}
                      {membro.telefone ? (
                        <span>WhatsApp: {formatarTelefone(membro.telefone)}</span>
                      ) : (
                        <span className="text-[var(--warning)]">Sem WhatsApp — não recebe avisos</span>
                      )}
                    </div>

                    <div className="mt-1 flex gap-2">
                      <Link href={`/admin/${membro.id}`} className="btn btn-outline btn-sm">
                        Editar
                      </Link>
                      <form action={alternarAtivoMembro}>
                        <input type="hidden" name="id" value={membro.id} />
                        <input type="hidden" name="ativo" value={String(membro.ativo)} />
                        {membro.ativo ? (
                          <ConfirmButton
                            className="btn btn-outline btn-sm"
                            confirmMessage={`Desativar ${membro.nome}? Ele perde o login, mas o histórico dele (fichas, atendimentos, ordens, metas) continua no sistema. Dá pra reativar depois no filtro "Inativos".`}
                          >
                            Desativar
                          </ConfirmButton>
                        ) : (
                          <button type="submit" className="btn btn-outline btn-sm">
                            Reativar
                          </button>
                        )}
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
