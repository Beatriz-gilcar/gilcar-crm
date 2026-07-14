import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { formatBRL } from '@/lib/ordens'
import { mesAtualISO } from '@/lib/metas'
import { definirMeta } from '../actions'

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }
type Membro = { id: string; nome: string }
type MetaRow = {
  id: string
  escopo: string
  unidade_id: string | null
  consultor_id: string | null
  periodo: string
  valor_meta: number
  valor_super_meta: number | null
  unidades: { nome: string } | null
  profiles: { nome: string } | null
}

export default async function DefinirMetasPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; error?: string; success?: string }>
}) {
  const { tipo: tipoParam, error, success } = await searchParams
  const tipo = tipoParam === 'protecao' ? 'protecao' : 'vendas'
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

  const { data: membrosData } = await supabase
    .from('profiles')
    .select('id, nome')
    .in('cargo', ['consultor', 'gerente'])
    .order('nome')
  const membros = (membrosData ?? []) as Membro[]

  const { data: metasData } = await supabase
    .from('metas')
    .select('id, escopo, unidade_id, consultor_id, periodo, valor_meta, valor_super_meta, unidades(nome), profiles(nome)')
    .eq('tipo', tipo)
    .order('periodo', { ascending: false })
    .overrideTypes<MetaRow[]>()

  const metas = metasData ?? []

  return (
    <>
      <Topbar nome={profile?.nome ?? user.email ?? ''} cargo={profile?.cargo ?? ''} isGerencia isAdmin active="metas" />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <div className="sec-header">
            <div className="sec-title">Definir metas</div>
          </div>

          <div className="chip-row">
            <a href="/metas/definir?tipo=vendas" className={`toggle-btn ${tipo === 'vendas' ? 'ativo' : ''}`}>
              Vendas
            </a>
            <a href="/metas/definir?tipo=protecao" className={`toggle-btn ${tipo === 'protecao' ? 'ativo' : ''}`}>
              Proteção
            </a>
          </div>

          {error && (
            <p className="rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}
          {success === '1' && (
            <p className="rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
              Meta salva.
            </p>
          )}

          <form action={definirMeta} className="card sec-pad flex flex-col gap-3">
            <input type="hidden" name="tipo" value={tipo} />

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Escopo</label>
              <ToggleGroup
                name="escopo"
                defaultValue="unidade"
                options={[
                  { value: 'empresa', label: 'Empresa' },
                  { value: 'unidade', label: 'Unidade' },
                  { value: 'consultor', label: 'Consultor' },
                ]}
              />
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Período (mês)</label>
                <input name="periodo" type="month" defaultValue={mesAtualISO()} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Valor da meta</label>
                <input name="valor_meta" type="number" step="0.01" min="0" required />
              </div>
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Unidade (se escopo = unidade)</label>
                <select name="unidade_id" defaultValue="">
                  <option value="">—</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Consultor (se escopo = consultor)</label>
                <select name="consultor_id" defaultValue="">
                  <option value="">—</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-red self-start">
              Salvar meta
            </button>
          </form>

          <div>
            <div className="sec-header">
              <div className="sec-title">Metas definidas ({tipo === 'vendas' ? 'Vendas' : 'Proteção'})</div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {metas.length === 0 ? (
                <div className="empty-state">Nenhuma meta definida ainda.</div>
              ) : (
                <div className="flex flex-col">
                  {metas.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                    >
                      <div>
                        <p className="normal-case text-white">
                          {m.escopo === 'empresa' && 'Empresa'}
                          {m.escopo === 'unidade' && (m.unidades?.nome ?? '—')}
                          {m.escopo === 'consultor' && (m.profiles?.nome ?? '—')}
                        </p>
                        <p className="text-[.7rem] normal-case text-[var(--text-muted)]">{m.periodo}</p>
                      </div>
                      <p className="font-bold text-white">{formatBRL(m.valor_meta)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
