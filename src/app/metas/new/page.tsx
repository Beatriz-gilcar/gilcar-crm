import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { SeletorVendedorLoja } from '@/components/SeletorVendedorLoja'
import { createVenda } from '../actions'
import { isGerenciaCargo, podeVerTudo } from '@/lib/membros'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Membro = { id: string; nome: string; unidade_id: string | null; unidades: { nome: string } | null }
type Unidade = { id: string; nome: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function NewVendaPage({
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
    .select('nome, cargo, unidade_id')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = isGerenciaCargo(profile?.cargo)
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  // Só o admin lança venda; gerência e consultor apenas visualizam.
  if (!isAdmin) {
    redirect('/metas')
  }

  // Vendedores para o Junior escolher. A venda vai direto pra loja do
  // vendedor (a action deriva a unidade dele) — exceto vendedor "volante"
  // (sem unidade fixa no perfil, ex.: Gilmar/Junior), que pode vender por
  // qualquer loja: aí sim o formulário pede a loja (ver SeletorVendedorLoja).
  let membros: Membro[] = []
  let unidades: Unidade[] = []
  if (isGerencia) {
    const [{ data: membrosData }, { data: unidadesData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, nome, unidade_id, unidades(nome)')
        .eq('ativo', true)
        .neq('cargo', 'visualizador')
        .order('nome')
        .overrideTypes<Membro[]>(),
      supabase.from('unidades').select('id, nome').order('nome'),
    ])
    membros = membrosData ?? []
    unidades = unidadesData ?? []
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="metas"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createVenda} className="w-full max-w-lg">
          <Link
            href="/metas"
            className="mb-3 inline-block text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white"
          >
            ← Voltar para Metas
          </Link>
          <div className="sec-header">
            <div className="sec-title">Lançar venda</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-3">
            {error && (
              <p className="rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
                {error}
              </p>
            )}

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Data</label>
                <input name="data" type="date" defaultValue={hojeISO()} required />
              </div>
              {isGerencia ? (
                <SeletorVendedorLoja
                  membros={membros.map((m) => ({ id: m.id, nome: m.nome, unidade_id: m.unidade_id, unidadeNome: m.unidades?.nome ?? null }))}
                  unidades={unidades}
                  minhaUnidadeId={profile?.unidade_id ?? null}
                />
              ) : (
                // Consultor lança pra si; a action já usa a unidade dele.
                <input type="hidden" name="consultor_id" value={user.id} />
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Veículo vendido</label>
              <input name="veiculo" type="text" placeholder="Ex.: Onix Vinho 2019" required />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Observação</label>
              <textarea name="observacao" rows={2} />
            </div>

            <button type="submit" className="btn btn-red mt-1 self-start">
              Lançar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
