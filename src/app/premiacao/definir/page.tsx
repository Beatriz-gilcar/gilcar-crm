import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { formatBRL } from '@/lib/ordens'
import { semestreAtual } from '@/lib/metas'
import { definirMetaPremiacao } from '../actions'

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }
type Consultor = { id: string; nome: string }
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

export default async function DefinirPremiacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
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

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  const { data: consultoresData } = await supabase
    .from('profiles')
    .select('id, nome')
    .eq('cargo', 'consultor')
    .order('nome')
  const consultores = (consultoresData ?? []) as Consultor[]

  const { data: metasData } = await supabase
    .from('metas')
    .select('id, escopo, unidade_id, consultor_id, periodo, valor_meta, valor_super_meta, unidades(nome), profiles(nome)')
    .eq('tipo', 'premiacao_vendas')
    .order('periodo', { ascending: false })
    .overrideTypes<MetaRow[]>()
  const metas = metasData ?? []

  const opcoesPeriodo = [0, 1].flatMap((offset) => {
    const ano = new Date().getFullYear() + offset
    return ['S1', 'S2'].map((s) => `${ano}-${s}`)
  })

  return (
    <>
      <Topbar nome={profile?.nome ?? user.email ?? ''} cargo={profile?.cargo ?? ''} isGerencia isAdmin active="premiacao" />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <Link href="/premiacao" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Premiação
          </Link>

          <div className="sec-header">
            <div className="sec-title">Definir metas de premiação (Vendas)</div>
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

          <form action={definirMetaPremiacao} className="card sec-pad flex flex-col gap-3">
            <input type="hidden" name="tipo" value="premiacao_vendas" />

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Escopo</label>
              <ToggleGroup
                name="escopo"
                defaultValue="unidade"
                options={[
                  { value: 'unidade', label: 'Unidade' },
                  { value: 'consultor', label: 'Consultor' },
                ]}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Semestre</label>
              <select name="periodo" defaultValue={semestreAtual()}>
                {opcoesPeriodo.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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
                  {consultores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Meta (R$)</label>
                <input name="valor_meta" type="number" step="0.01" min="0" required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Super Meta (R$, opcional)</label>
                <input name="valor_super_meta" type="number" step="0.01" min="0" />
              </div>
            </div>

            <button type="submit" className="btn btn-red self-start">
              Salvar meta
            </button>
          </form>

          <div>
            <div className="sec-header">
              <div className="sec-title">Metas de premiação definidas</div>
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
                          {m.escopo === 'unidade' ? m.unidades?.nome ?? '—' : m.profiles?.nome ?? '—'}
                        </p>
                        <p className="text-[.7rem] normal-case text-[var(--text-muted)]">{m.periodo}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{formatBRL(m.valor_meta)}</p>
                        {m.valor_super_meta && (
                          <p className="text-[.68rem] normal-case text-[var(--text-muted)]">
                            Super: {formatBRL(m.valor_super_meta)}
                          </p>
                        )}
                      </div>
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
