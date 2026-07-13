import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { toggleLembrete } from './actions'

type LembreteRow = {
  id: string
  titulo: string
  data_vencimento: string | null
  concluido: boolean
  cliente_id: string | null
  categorias: { nome: string; cor: string | null } | null
  clientes: { nome: string } | null
}

export default async function LembretesPage() {
  const supabase = await createClient()

  const { data: lembretes } = await supabase
    .from('lembretes')
    .select(
      'id, titulo, data_vencimento, concluido, cliente_id, categorias(nome, cor), clientes(nome)'
    )
    .order('concluido', { ascending: true })
    .order('data_vencimento', { ascending: true, nullsFirst: false })
    .overrideTypes<LembreteRow[]>()

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-4 py-10 dark:bg-black sm:px-10">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
            ← Início
          </Link>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Lembretes</h1>
        </div>
        <Link
          href="/lembretes/new"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Novo lembrete
        </Link>
      </div>

      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        {!lembretes || lembretes.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum lembrete cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {lembretes.map((lembrete) => (
              <li key={lembrete.id} className="flex items-center gap-4 px-6 py-4">
                <form action={toggleLembrete}>
                  <input type="hidden" name="id" value={lembrete.id} />
                  <input type="hidden" name="concluido" value={String(lembrete.concluido)} />
                  {lembrete.cliente_id && (
                    <input type="hidden" name="cliente_id" value={lembrete.cliente_id} />
                  )}
                  <button
                    type="submit"
                    aria-label={lembrete.concluido ? 'Reabrir lembrete' : 'Concluir lembrete'}
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                      lembrete.concluido
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-black/20 text-transparent hover:border-black/40 dark:border-white/30'
                    }`}
                  >
                    ✓
                  </button>
                </form>

                <div className="flex-1">
                  <p
                    className={`font-medium text-black dark:text-zinc-50 ${
                      lembrete.concluido ? 'line-through opacity-50' : ''
                    }`}
                  >
                    {lembrete.titulo}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {lembrete.categorias && (
                      <span className="mr-2 inline-flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: lembrete.categorias.cor ?? '#71717a' }}
                        />
                        {lembrete.categorias.nome}
                      </span>
                    )}
                    {lembrete.clientes?.nome && (
                      <Link href={`/leads/${lembrete.cliente_id}`} className="hover:underline">
                        {lembrete.clientes.nome}
                      </Link>
                    )}
                    {lembrete.data_vencimento &&
                      ` · vence ${new Date(lembrete.data_vencimento).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
