import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { cargoLabel } from '@/lib/membros'
import { updateMembro, resetSenha } from '../actions'

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }
type MembroDetail = { id: string; nome: string; cargo: string; unidade_id: string | null }

export default async function EditMembroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { id } = await params
  const { error, success } = await searchParams
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

  const { data: membro } = await supabase
    .from('profiles')
    .select('id, nome, cargo, unidade_id')
    .eq('id', id)
    .single<MembroDetail>()

  if (!membro) {
    notFound()
  }

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.auth.admin.getUserById(id)
  const email = userData?.user?.email ?? '—'

  return (
    <>
      <Topbar nome={profile?.nome ?? user.email ?? ''} cargo={profile?.cargo ?? ''} isGerencia isAdmin active="admin" />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-lg flex flex-col gap-4">
          <Link href="/admin" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Equipe
          </Link>

          {error && (
            <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
              {error}
            </p>
          )}
          {success === '1' && (
            <p className="rounded-md bg-[#001600] px-3 py-2 text-[.78rem] normal-case text-[#2db82d]">
              Membro atualizado.
            </p>
          )}
          {success === 'senha' && (
            <p className="rounded-md bg-[#001600] px-3 py-2 text-[.78rem] normal-case text-[#2db82d]">
              Senha redefinida.
            </p>
          )}

          <form action={updateMembro}>
            <div className="sec-header">
              <div className="sec-title">Editar membro</div>
            </div>
            <div className="sec-body sec-pad flex flex-col gap-3">
              <input type="hidden" name="id" value={membro.id} />

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>E-mail (login)</label>
                <input type="text" value={email} disabled className="normal-case opacity-60" />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nome</label>
                <input name="nome" type="text" required defaultValue={membro.nome} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cargo</label>
                <ToggleGroup
                  name="cargo"
                  defaultValue={membro.cargo}
                  options={Object.entries(cargoLabel).map(([value, label]) => ({ value, label }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Unidade</label>
                <select name="unidade_id" defaultValue={membro.unidade_id ?? ''}>
                  <option value="">Nenhuma (admin geral)</option>
                  {unidades.map((unidade) => (
                    <option key={unidade.id} value={unidade.id}>
                      {unidade.nome}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-red mt-1 self-start">
                Salvar
              </button>
            </div>
          </form>

          <form action={resetSenha} className="mt-1">
            <div className="sec-header">
              <div className="sec-title">Redefinir senha</div>
            </div>
            <div className="sec-body sec-pad flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={membro.id} />
              <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: 180 }}>
                <label>Nova senha</label>
                <input name="nova_senha" type="text" required minLength={8} />
              </div>
              <button type="submit" className="btn btn-outline btn-sm">
                Redefinir
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
