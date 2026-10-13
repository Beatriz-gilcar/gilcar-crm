import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo } from '@/lib/membros'
import { iniciarContagem } from './actions'

type ProfileSummary = { nome: string; cargo: string; acesso_financeiro: boolean }
type Unidade = { id: string; nome: string }
type Contagem = {
  id: string
  unidade_id: string
  created_at: string
  concluida: boolean
  unidades: { nome: string } | null
}

function dataHoraBR(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function ContagemEstoquePage({
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
    .select('nome, cargo, acesso_financeiro')
    .eq('id', user.id)
    .single<ProfileSummary>()

  if (profile?.cargo !== 'admin' && !profile?.acesso_financeiro) {
    redirect('/')
  }

  const verTudo = podeVerTudo(profile.cargo)
  const isAdmin = profile.cargo === 'admin'

  const [{ data: unidadesData }, { data: contagensData }] = await Promise.all([
    supabase.from('unidades').select('id, nome').order('nome'),
    supabase
      .from('estoque_contagens')
      .select('id, unidade_id, created_at, concluida, unidades(nome)')
      .order('created_at', { ascending: false })
      .limit(50)
      .overrideTypes<Contagem[]>(),
  ])

  const unidades = (unidadesData ?? []) as Unidade[]
  const contagens = contagensData ?? []
  const abertaPorUnidade = new Map(contagens.filter((c) => !c.concluida).map((c) => [c.unidade_id, c]))
  const fechadas = contagens.filter((c) => c.concluida)

  return (
    <>
      <Topbar
        nome={profile.nome ?? user.email ?? ''}
        cargo={profile.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        veContagemEstoque={profile.acesso_financeiro}
        active="estoque-contagem"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <Link href="/estoque" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Estoque
          </Link>
          <div className="sec-title mt-2" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Conferência de estoque
          </div>
          <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">
            Contagem física do pátio por unidade — cruza com o que está anunciado no Autocerto.
          </p>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="mt-4 sec-body" style={{ padding: 0 }}>
            {unidades.map((u) => {
              const emAndamento = abertaPorUnidade.get(u.id)
              return (
                <div key={u.id} className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0">
                  <div>
                    <p className="normal-case text-white">{u.nome}</p>
                    {emAndamento && (
                      <p className="text-[.72rem] text-[var(--text-muted)]">
                        Contagem aberta em {dataHoraBR(emAndamento.created_at)}
                      </p>
                    )}
                  </div>
                  {emAndamento ? (
                    <Link href={`/estoque/contagem/${emAndamento.id}`} className="btn btn-outline btn-sm">
                      Continuar
                    </Link>
                  ) : (
                    <form action={iniciarContagem}>
                      <input type="hidden" name="unidade_id" value={u.id} />
                      <button type="submit" className="btn btn-red btn-sm">
                        Iniciar contagem
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-6">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Histórico
            </div>
            <div className="sec-body mt-2" style={{ padding: 0 }}>
              {fechadas.length === 0 ? (
                <div className="empty-state">Nenhuma contagem finalizada ainda.</div>
              ) : (
                fechadas.map((c) => (
                  <Link
                    key={c.id}
                    href={`/estoque/contagem/${c.id}`}
                    className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 first:border-t-0 hover:bg-white/[.02]"
                  >
                    <p className="normal-case text-white">{c.unidades?.nome ?? '—'}</p>
                    <p className="text-[.72rem] text-[var(--text-muted)]">Aberta em {dataHoraBR(c.created_at)}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
