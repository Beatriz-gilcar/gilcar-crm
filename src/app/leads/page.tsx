import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type Lead = {
  id: string
  nome: string
  created_at: string
  unidades: { nome: string } | null
  profiles: { nome: string } | null
}

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('clientes')
    .select('id, nome, created_at, unidades(nome), profiles(nome)')
    .order('created_at', { ascending: false })
    .overrideTypes<Lead[]>()

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-4 py-10 dark:bg-black sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
            ← Início
          </Link>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Leads</h1>
        </div>
        <Link
          href="/leads/new"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Novo lead
        </Link>
      </div>

      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        {!leads || leads.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum lead cadastrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-black/[.02] dark:hover:bg-white/[.03]"
                >
                  <div>
                    <p className="font-medium text-black dark:text-zinc-50">{lead.nome}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {lead.unidades?.nome ?? 'sem unidade'}
                      {lead.profiles?.nome ? ` · ${lead.profiles.nome}` : ''}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-400 dark:text-zinc-500">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
