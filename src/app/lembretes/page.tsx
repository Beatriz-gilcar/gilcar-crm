import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
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

type ProfileSummary = { nome: string; cargo: string }

export default async function LembretesPage() {
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

  const { data: lembretes } = await supabase
    .from('lembretes')
    .select(
      'id, titulo, data_vencimento, concluido, cliente_id, categorias(nome, cor), clientes(nome)'
    )
    .order('concluido', { ascending: true })
    .order('data_vencimento', { ascending: true, nullsFirst: false })
    .overrideTypes<LembreteRow[]>()

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="lembretes"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="sec-header">
            <div className="sec-title">Lembretes</div>
            <Link href="/lembretes/new" className="btn btn-red btn-sm">
              + Novo lembrete
            </Link>
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {!lembretes || lembretes.length === 0 ? (
              <div className="empty-state">Nenhum lembrete cadastrado.</div>
            ) : (
              <ul className="flex flex-col">
                {lembretes.map((lembrete) => (
                  <li
                    key={lembrete.id}
                    className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                  >
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
                            : 'border-[var(--border)] text-transparent hover:border-white'
                        }`}
                      >
                        ✓
                      </button>
                    </form>

                    <div className="flex-1">
                      <p
                        className={`normal-case font-medium text-white ${
                          lembrete.concluido ? 'line-through opacity-50' : ''
                        }`}
                      >
                        {lembrete.titulo}
                      </p>
                      <p className="text-[.75rem] text-[var(--text-muted)]">
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
      </div>
    </>
  )
}
