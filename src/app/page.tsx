import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo } from '@/lib/membros'

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

  // Equipe de SDR só usa a aba SDR — manda direto pra lá (a home não tem nada
  // pra elas).
  if (profile?.cargo === 'sdr') redirect('/sdr')

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active=""
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
        <p className="text-[.75rem] text-[var(--text-muted)]">Logado como</p>
        <p className="text-2xl font-semibold text-white">{profile?.nome ?? user.email}</p>
        <p className="text-[.8rem] text-[var(--text-muted)]">
          {profile?.cargo ?? 'sem cargo definido'}
          {profile?.unidades ? ` · ${profile.unidades.nome}` : ' · sem unidade definida'}
        </p>
      </div>
    </>
  )
}
