import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { createCategoria, deleteCategoria } from './actions'

type Categoria = { id: string; nome: string; cor: string | null }
type ProfileSummary = { nome: string; cargo: string }

export default async function CategoriasPage({
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
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const isAdmin = profile?.cargo === 'admin'

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nome, cor')
    .order('nome')
    .overrideTypes<Categoria[]>()

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="categorias"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Categorias</div>
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {error && (
              <p className="m-3 rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                {error}
              </p>
            )}
            {!categorias || categorias.length === 0 ? (
              <div className="empty-state">Nenhuma categoria cadastrada.</div>
            ) : (
              <ul className="flex flex-col">
                {categorias.map((categoria) => (
                  <li
                    key={categoria.id}
                    className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                  >
                    <span className="flex items-center gap-2 text-[.82rem] text-white">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: categoria.cor ?? '#71717a' }}
                      />
                      {categoria.nome}
                    </span>
                    {isGerencia && (
                      <form action={deleteCategoria}>
                        <input type="hidden" name="id" value={categoria.id} />
                        <button
                          type="submit"
                          className="text-[.72rem] font-bold text-[var(--red)] hover:underline"
                        >
                          Remover
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isGerencia && (
            <form action={createCategoria} className="mt-4">
              <div className="sec-header">
                <div className="sec-title">Nova categoria</div>
              </div>
              <div className="sec-body sec-pad flex items-end gap-3">
                <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                  <label>Nome</label>
                  <input name="nome" type="text" required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Cor</label>
                  <input
                    name="cor"
                    type="color"
                    defaultValue="#71717a"
                    className="h-[38px] w-14 p-1"
                  />
                </div>
                <button type="submit" className="btn btn-red">
                  Adicionar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
