import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { toggleLembrete, deleteLembrete } from './actions'
import { ConfirmButton } from '@/components/ConfirmButton'
import { dataHoraBR } from '@/lib/datas'
import { podeVerTudo } from '@/lib/membros'

type LembreteRow = {
  id: string
  titulo: string
  data_vencimento: string | null
  concluido: boolean
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
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  const { data: lembretes } = await supabase
    .from('lembretes')
    .select('id, titulo, data_vencimento, concluido, clientes(nome)')
    .order('concluido', { ascending: true })
    .order('data_vencimento', { ascending: true, nullsFirst: false })
    .overrideTypes<LembreteRow[]>()

  const pendentes = lembretes?.filter((l) => !l.concluido).length ?? 0
  const vencidos =
    lembretes?.filter(
      (l) => !l.concluido && l.data_vencimento && new Date(l.data_vencimento) < new Date()
    ).length ?? 0

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="lembretes"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Pendentes</div>
              <div className="kpi-val">{pendentes}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Vencidos</div>
              <div className="kpi-val">{vencidos}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Lembretes
            </div>
            <Link href="/lembretes/new" className="btn btn-red btn-sm">
              + Novo lembrete
            </Link>
          </div>
          <div className="sec-body mt-3" style={{ padding: 0 }}>
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
                        {lembrete.clientes?.nome}
                        {lembrete.data_vencimento && ` · 🔔 ${dataHoraBR(lembrete.data_vencimento)}`}
                      </p>
                    </div>

                    <form action={deleteLembrete}>
                      <input type="hidden" name="id" value={lembrete.id} />
                      <ConfirmButton
                        className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                        confirmMessage={`Excluir o lembrete "${lembrete.titulo}"?`}
                      >
                        Excluir
                      </ConfirmButton>
                    </form>
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
