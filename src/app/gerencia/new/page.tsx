import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { ChecklistFormClient } from '@/components/ChecklistFormClient'
import { tipoLabel, perguntasPorTipo } from '@/lib/checklists'
import { createChecklist } from '../actions'
import { podeVerTudo } from '@/lib/membros'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Gerente = { id: string; nome: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function NewChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; error?: string }>
}) {
  const { tipo, error } = await searchParams
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
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  if (!verTudo) {
    redirect('/')
  }

  let gerentes: Gerente[] = []
  if (isAdmin) {
    const { data } = await supabase.from('profiles').select('id, nome').eq('cargo', 'gerente').order('nome')
    gerentes = data ?? []
  }

  const perguntas = tipo ? perguntasPorTipo[tipo] : null

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="status-do-dia"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <Link href="/gerencia" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Gerência
          </Link>

          {!perguntas ? (
            <div className="mt-3">
              <div className="sec-header">
                <div className="sec-title">Novo checklist</div>
              </div>
              <div className="card sec-pad flex flex-col gap-3">
                <p className="text-[.8rem] normal-case text-[var(--text-muted)]">
                  Escolha o tipo de checklist a preencher.
                </p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(tipoLabel).map(([value, label]) => (
                    <Link key={value} href={`/gerencia/new?tipo=${value}`} className="btn btn-red btn-sm">
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="sec-header">
                <div className="sec-title">Checklist {tipoLabel[tipo!]}</div>
              </div>

              {error && (
                <p className="mb-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
                  {error}
                </p>
              )}

              <ChecklistFormClient action={createChecklist} itensCount={perguntas.length} className="flex flex-col gap-4">
                <input type="hidden" name="tipo" value={tipo} />

                <div className="card sec-pad flex flex-col gap-3">
                  <div className="grid2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Data de referência</label>
                      <input name="data" type="date" defaultValue={hojeISO()} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Gerente avaliado</label>
                      {isAdmin ? (
                        <select name="avaliado_id" required defaultValue="">
                          <option value="" disabled>
                            Selecione...
                          </option>
                          {gerentes.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input type="text" value={profile?.nome ?? ''} disabled className="opacity-60" />
                          <input type="hidden" name="avaliado_id" value={user.id} />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {perguntas.map((pergunta, i) => (
                  <div key={i} className="card sec-pad flex flex-col gap-2">
                    <p className="normal-case text-[.85rem] text-white">
                      {i + 1}. {pergunta}
                    </p>
                    <ToggleGroup
                      name={`resposta_${i}`}
                      defaultValue="sim"
                      options={[
                        { value: 'sim', label: 'Sim' },
                        { value: 'nao', label: 'Não' },
                      ]}
                    />
                    <textarea name={`observacao_${i}`} placeholder="Observação (opcional)" rows={2} />
                  </div>
                ))}

                <button type="submit" className="btn btn-red self-start">
                  Salvar checklist
                </button>
              </ChecklistFormClient>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
