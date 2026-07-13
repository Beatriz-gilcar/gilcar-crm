import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from './actions'

type ProfileSummary = {
  nome: string
  cargo: string
  unidades: { nome: string } | null
}

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo, unidades(nome)')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-8 text-center dark:border-white/10 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Logado como</p>
        <p className="text-lg font-semibold text-black dark:text-zinc-50">
          {profile?.nome ?? user.email}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {profile?.cargo ?? 'sem cargo definido'}
          {profile?.unidades ? ` · ${profile.unidades.nome}` : ' · sem unidade definida'}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-black hover:bg-black/[.04] dark:border-white/20 dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Dashboard
          </Link>
          <Link
            href="/leads"
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Ver leads
          </Link>
          <Link
            href="/lembretes"
            className="rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-black hover:bg-black/[.04] dark:border-white/20 dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Lembretes
          </Link>
          {isGerencia && (
            <Link
              href="/categorias"
              className="rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-black hover:bg-black/[.04] dark:border-white/20 dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
            >
              Categorias
            </Link>
          )}
        </div>

        <form action={logout} className="mt-3">
          <button
            type="submit"
            className="rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-black hover:bg-black/[.04] dark:border-white/20 dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  )
}
