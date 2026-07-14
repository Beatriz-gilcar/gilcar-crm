import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { cargoLabel } from '@/lib/membros'
import { createMembro } from '../actions'

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }

export default async function NewMembroPage({
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

  if (profile?.cargo !== 'admin') {
    redirect('/')
  }

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  return (
    <>
      <Topbar nome={profile?.nome ?? user.email ?? ''} cargo={profile?.cargo ?? ''} isGerencia isAdmin active="admin" />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createMembro} className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Novo membro</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-3">
            {error && (
              <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                {error}
              </p>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nome</label>
              <input name="nome" type="text" required />
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>E-mail</label>
                <input name="email" type="email" required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Senha inicial</label>
                <input name="senha" type="text" required minLength={8} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Cargo</label>
              <ToggleGroup
                name="cargo"
                defaultValue="consultor"
                options={Object.entries(cargoLabel).map(([value, label]) => ({ value, label }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Unidade</label>
              <select name="unidade_id" defaultValue="">
                <option value="">Nenhuma (admin geral)</option>
                {unidades.map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[.7rem] normal-case text-[var(--text-muted)]">
              Não há envio de e-mail de convite — anote a senha e repasse pro membro por um canal
              seguro. Ele pode trocar depois pedindo pra você redefinir.
            </p>

            <button type="submit" className="btn btn-red mt-1 self-start">
              Criar login
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
