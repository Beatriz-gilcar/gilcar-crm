import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createLembrete } from '../actions'

export default async function NewLembretePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nome')
    .order('nome')

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <form
        action={createLembrete}
        className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950"
      >
        <div>
          <Link
            href="/lembretes"
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            ← Lembretes
          </Link>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Novo lembrete</h1>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Título
          <input
            name="titulo"
            type="text"
            required
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Categoria
            <select
              name="categoria_id"
              defaultValue=""
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
            >
              <option value="">Sem categoria</option>
              {categorias?.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Vencimento
            <input
              name="data_vencimento"
              type="date"
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Descrição
          <textarea
            name="descricao"
            rows={3}
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-full bg-foreground px-5 py-2 font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Salvar
        </button>
      </form>
    </div>
  )
}
