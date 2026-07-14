import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { createVendaProtecao } from '../../actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }
type Membro = { id: string; nome: string; unidade_id: string | null }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function NewVendaProtecaoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
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

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const isAdmin = profile?.cargo === 'admin'

  let unidades: Unidade[] = []
  let membros: Membro[] = []
  if (isGerencia) {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome')
    unidades = data ?? []
    const { data: membrosData } = await supabase
      .from('profiles')
      .select('id, nome, unidade_id')
      .in('cargo', ['consultor', 'gerente'])
      .order('nome')
    membros = membrosData ?? []
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="metas"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createVendaProtecao} className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Lançar proteção</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-3">
            {error && (
              <p className="rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
                {error}
              </p>
            )}

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Data</label>
                <input name="data" type="date" defaultValue={hojeISO()} required />
              </div>
              {isGerencia ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Unidade</label>
                  <select name="unidade_id" required defaultValue="">
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input type="hidden" name="unidade_id" value={profile?.unidade_id ?? ''} />
              )}
            </div>

            {isGerencia && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Vendedor</label>
                <select name="consultor_id" defaultValue="">
                  <option value="">Eu mesmo</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Descrição</label>
              <input name="descricao" type="text" placeholder="Ex: Seguro veicular, Proteção premium" required />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Valor</label>
              <input name="valor" type="number" step="0.01" min="0" required />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Observação</label>
              <textarea name="observacao" rows={2} />
            </div>

            <button type="submit" className="btn btn-red mt-1 self-start">
              Lançar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
