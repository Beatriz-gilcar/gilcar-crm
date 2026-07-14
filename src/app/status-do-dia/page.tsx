import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'

type StatusUnidade = {
  unidade_id: string
  unidade_nome: string
  total_consultores: number
  enviados: number
  status: string
}

type ProfileSummary = { nome: string; cargo: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function StatusDoDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
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

  const { data: unidades } = await supabase.rpc('status_dia_unidades', { p_data: data })
  const rows = (unidades ?? []) as StatusUnidade[]

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
          <form action="/status-do-dia" method="get" className="mb-4 flex items-end gap-3">
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 200 }}>
              <label>Data</label>
              <input type="date" name="data" defaultValue={data} />
            </div>
            <button type="submit" className="btn btn-outline btn-sm">
              Ver
            </button>
          </form>

          <div className="sec-header">
            <div className="sec-title">Status do Dia</div>
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {rows.length === 0 ? (
              <div className="empty-state">Sem dados para esta data.</div>
            ) : (
              <ul className="flex flex-col">
                {rows.map((row) => (
                  <li
                    key={row.unidade_id}
                    className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                  >
                    <div>
                      <p className="font-semibold text-white">{row.unidade_nome}</p>
                      <p className="text-[.75rem] text-[var(--text-muted)]">
                        {row.enviados}/{row.total_consultores} consultores enviaram
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`badge ${
                          row.status === 'aprovado' ? 'badge-aprovado' : 'badge-pendente'
                        }`}
                      >
                        {row.status === 'aprovado' ? 'Aprovado' : 'Aberto'}
                      </span>
                      <Link
                        href={`/status-do-dia/${row.unidade_id}?data=${data}`}
                        className="btn btn-outline btn-sm"
                      >
                        Ver
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
