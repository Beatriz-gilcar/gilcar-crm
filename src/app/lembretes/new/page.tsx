import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { createLembrete } from '../actions'
import { podeVerTudo } from '@/lib/membros'

type ProfileSummary = { nome: string; cargo: string }
type Pessoa = { id: string; nome: string; cargo: string }

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
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  // Só o admin manda lembrete pra outra pessoa/grupo — os demais só cadastram
  // pra si mesmo (comportamento de sempre).
  let gerentes: Pessoa[] = []
  let consultores: Pessoa[] = []
  if (isAdmin) {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, cargo')
      .in('cargo', ['gerente', 'supervisor', 'consultor'])
      .eq('ativo', true)
      .order('nome')
      .overrideTypes<Pessoa[]>()
    const pessoas = data ?? []
    gerentes = pessoas.filter((p) => p.cargo === 'gerente' || p.cargo === 'supervisor')
    consultores = pessoas.filter((p) => p.cargo === 'consultor')
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
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

            {isAdmin && (
              <div className="form-group">
                <label>Para quem</label>
                <select name="destino" defaultValue="">
                  <option value="">Só eu</option>
                  <option value="grupo:gerente">Todos os gerentes/supervisores</option>
                  <option value="grupo:consultor">Todos os consultores</option>
                  {gerentes.length > 0 && (
                    <optgroup label="Gerentes/supervisores">
                      {gerentes.map((p) => (
                        <option key={p.id} value={`pessoa:${p.id}`}>
                          {p.nome}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {consultores.length > 0 && (
                    <optgroup label="Consultores">
                      {consultores.map((p) => (
                        <option key={p.id} value={`pessoa:${p.id}`}>
                          {p.nome}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
                  Escolhendo um grupo, o mesmo lembrete aparece pra cada pessoa dele.
                </p>
              </div>
            )}

            <div className="form-group">
              <label>Título</label>
              <input name="titulo" type="text" required />
            </div>

            <div className="form-group">
              <label>Quando (data e hora)</label>
              <input name="data_vencimento" type="datetime-local" />
              <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
                Na hora marcada, o lembrete pisca na tela e o navegador te avisa (com o sistema aberto).
              </p>
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
