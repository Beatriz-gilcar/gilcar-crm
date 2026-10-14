import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo } from '@/lib/membros'

type ProfileSummary = { nome: string; cargo: string }
type Modulo = { id: string; titulo: string; posicao: number; ativo: boolean }

export default async function TreinamentoAdminPage() {
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

  if (!isAdmin) {
    redirect('/treinamento')
  }

  const { data: modulosData } = await supabase
    .from('treinamento_modulos')
    .select('id, titulo, posicao, ativo')
    .order('posicao')
    .overrideTypes<Modulo[]>()
  const modulos = modulosData ?? []

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="treinamento"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/treinamento" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
              ← Treinamento
            </Link>
            <Link href="/treinamento/admin/novo" className="btn btn-red btn-sm">
              + Novo módulo
            </Link>
          </div>

          <div className="mt-3 sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Módulos de treinamento
          </div>

          <div className="mt-4 sec-body" style={{ padding: 0 }}>
            {modulos.length === 0 ? (
              <div className="empty-state">Nenhum módulo cadastrado ainda.</div>
            ) : (
              modulos.map((m) => (
                <Link
                  key={m.id}
                  href={`/treinamento/admin/${m.id}`}
                  className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-white/[.02]"
                >
                  <span className="normal-case text-white">{m.titulo}</span>
                  {!m.ativo && <span className="badge badge-rejeitado">Inativo</span>}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
