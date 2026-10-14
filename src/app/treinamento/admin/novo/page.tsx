import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { EditarModuloTreinamento } from '@/components/EditarModuloTreinamento'
import { podeVerTudo } from '@/lib/membros'
import { salvarModulo } from '../actions'

type ProfileSummary = { nome: string; cargo: string }

export default async function NovoModuloPage({
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

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  if (!isAdmin) {
    redirect('/treinamento')
  }

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
          <Link href="/treinamento/admin" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Módulos
          </Link>
          <div className="mt-2 sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Novo módulo
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="mt-4">
            <EditarModuloTreinamento
              moduloId={null}
              titulo=""
              conteudo=""
              posicao={0}
              ativo={true}
              perguntasIniciais={[]}
              action={salvarModulo}
            />
          </div>
        </div>
      </div>
    </>
  )
}
