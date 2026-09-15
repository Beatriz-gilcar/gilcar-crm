import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { MoedaInput } from '@/components/MoedaInput'
import { podeVerTudo } from '@/lib/membros'
import { mesAtualISO } from '@/lib/metas'
import { createDespesa } from '../actions'

type ProfileSummary = { nome: string; cargo: string; ve_despesas: boolean }
type Unidade = { id: string; nome: string }

const categorias: { value: string; label: string }[] = [
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'folha', label: 'Folha' },
  { value: 'agua_luz', label: 'Água/Luz' },
  { value: 'internet_telefone', label: 'Internet/Telefone' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'outros', label: 'Outros' },
]

export default async function NovaDespesaPage({
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
    .select('nome, cargo, ve_despesas')
    .eq('id', user.id)
    .single<ProfileSummary>()

  if (!profile?.ve_despesas) {
    redirect('/')
  }

  const verTudo = podeVerTudo(profile.cargo)
  const isAdmin = profile.cargo === 'admin'

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  return (
    <>
      <Topbar
        nome={profile.nome ?? user.email ?? ''}
        cargo={profile.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        veDespesas={profile.ve_despesas}
        active="despesas"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <form action={createDespesa} className="mt-2">
            <div className="sec-header">
              <div className="sec-title">Lançar despesa</div>
            </div>
            <div className="sec-body sec-pad flex flex-col gap-3">
              {error && (
                <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                  {error}
                </p>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Unidade</label>
                <select name="unidade_id" defaultValue="">
                  <option value="">Geral (empresa toda)</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Categoria</label>
                <select name="categoria" required defaultValue="">
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {categorias.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Descrição</label>
                <input name="descricao" type="text" placeholder="Opcional" />
              </div>

              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Valor</label>
                  <MoedaInput name="valor" defaultValue="0,00" required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Competência</label>
                  <input name="competencia" type="month" required defaultValue={mesAtualISO()} />
                </div>
              </div>

              <div className="mt-1 flex items-center gap-3">
                <button type="submit" className="btn btn-red self-start">
                  Salvar
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
