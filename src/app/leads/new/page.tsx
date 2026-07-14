import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { createLead } from '../actions'

type ProfileSummary = { nome: string; cargo: string }

export default async function NewLeadPage({
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

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const isAdmin = profile?.cargo === 'admin'

  let unidades: { id: string; nome: string }[] = []
  if (isGerencia) {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome')
    unidades = data ?? []
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="leads"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createLead} className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Novo lead</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-1">
            {error && (
              <p className="mb-2 rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                {error}
              </p>
            )}

            <div className="form-group">
              <label>Nome</label>
              <input name="nome" type="text" required />
            </div>

            {isGerencia && (
              <div className="form-group">
                <label>Unidade</label>
                <select name="unidade_id" required defaultValue="">
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {unidades.map((unidade) => (
                    <option key={unidade.id} value={unidade.id}>
                      {unidade.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid2">
              <div className="form-group">
                <label>Celular</label>
                <input name="celular" type="tel" />
              </div>
              <div className="form-group">
                <label>WhatsApp</label>
                <input name="whatsapp" type="tel" />
              </div>
            </div>

            <div className="form-group">
              <label>E-mail</label>
              <input name="email" type="email" />
            </div>

            <div className="form-group">
              <label>Observações</label>
              <textarea name="observacoes" rows={3} />
            </div>

            <button type="submit" className="btn btn-red mt-1 self-start">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
