import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createLead } from '../actions'

export default async function NewLeadPage({
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

  let unidades: { id: string; nome: string }[] = []
  if (isGerencia) {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome')
    unidades = data ?? []
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <form
        action={createLead}
        className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950"
      >
        <div>
          <Link href="/leads" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
            ← Leads
          </Link>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Novo lead</h1>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nome
          <input
            name="nome"
            type="text"
            required
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
          />
        </label>

        {isGerencia && (
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Unidade
            <select
              name="unidade_id"
              required
              defaultValue=""
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
            >
              <option value="" disabled>
                Selecione...
              </option>
              {unidades.map((unidade) => (
                <option key={unidade.id} value={unidade.id}>
                  {unidade.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Celular
            <input
              name="celular"
              type="tel"
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            WhatsApp
            <input
              name="whatsapp"
              type="tel"
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          E-mail
          <input
            name="email"
            type="email"
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-black dark:border-white/20 dark:text-zinc-50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Observações
          <textarea
            name="observacoes"
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
