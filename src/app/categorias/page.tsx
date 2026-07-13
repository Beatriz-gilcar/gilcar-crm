import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createCategoria, deleteCategoria } from './actions'

type Categoria = { id: string; nome: string; cor: string | null }

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
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nome, cor')
    .order('nome')
    .overrideTypes<Categoria[]>()

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-4 py-10 dark:bg-black sm:px-10">
      <div className="mx-auto w-full max-w-lg">
        <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Início
        </Link>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Categorias</h1>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          {!categorias || categorias.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {categorias.map((categoria) => (
                <li
                  key={categoria.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <span className="flex items-center gap-2 text-sm text-black dark:text-zinc-50">
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
                        className="text-sm text-red-600 hover:underline dark:text-red-400"
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
          <form
            action={createCategoria}
            className="mt-6 flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
          >
            <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Nova categoria</h2>

            <div className="flex items-end gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                Nome
                <input
                  name="nome"
                  type="text"
                  required
                  className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                Cor
                <input
                  name="cor"
                  type="color"
                  defaultValue="#71717a"
                  className="h-10 w-14 rounded-md border border-black/10 bg-transparent dark:border-white/20"
                />
              </label>
            </div>

            <button
              type="submit"
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Adicionar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
