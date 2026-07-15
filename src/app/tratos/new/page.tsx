import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { createTrato } from '../actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function NewTratoPage({
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
  if (isGerencia) {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome')
    unidades = data ?? []
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="tratos"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createTrato} className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Novo trato</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-3">
            {error && (
              <p className="rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
                {error}
              </p>
            )}

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cliente</label>
                <input name="cliente_nome" type="text" required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Celular</label>
                <input name="celular" type="tel" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Veículo</label>
              <input name="veiculo" type="text" />
            </div>

            {isGerencia && (
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
            )}
            {!isGerencia && <input type="hidden" name="unidade_id" value={profile?.unidade_id ?? ''} />}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>O que foi combinado</label>
              <textarea name="combinado" rows={3} required />
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Data</label>
                <input name="data" type="date" defaultValue={hojeISO()} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Prazo</label>
                <input name="prazo" type="date" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Observação</label>
              <textarea name="observacao" rows={2} />
            </div>

            <button type="submit" className="btn btn-red mt-1 self-start">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
