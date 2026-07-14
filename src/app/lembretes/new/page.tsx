import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { createLembrete } from '../actions'

type ProfileSummary = { nome: string; cargo: string }

export default async function NewLembretePage({
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

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nome')
    .order('nome')

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        active="lembretes"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createLembrete} className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Novo lembrete</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-1">
            {error && (
              <p className="mb-2 rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                {error}
              </p>
            )}

            <div className="form-group">
              <label>Título</label>
              <input name="titulo" type="text" required />
            </div>

            <div className="grid2">
              <div className="form-group">
                <label>Categoria</label>
                <select name="categoria_id" defaultValue="">
                  <option value="">Sem categoria</option>
                  {categorias?.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Vencimento</label>
                <input name="data_vencimento" type="date" />
              </div>
            </div>

            <div className="form-group">
              <label>Descrição</label>
              <textarea name="descricao" rows={3} />
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
