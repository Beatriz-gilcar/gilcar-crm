import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { addItem, desativarItem, reativarItem, copiarDe } from './actions'

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }
type Item = { id: string; ordem: number; hora: string; tarefa: string; destaque: boolean; ativo: boolean }

export default async function EditarRotinaPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; error?: string }>
}) {
  const { unidade: unidadeParam, error } = await searchParams
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
    redirect('/rotina')
  }

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]
  const unidadeId = unidadeParam || unidades[0]?.id || ''
  const unidade = unidades.find((u) => u.id === unidadeId)

  const { data: itensData } = await supabase
    .from('rotina_itens')
    .select('id, ordem, hora, tarefa, destaque, ativo')
    .eq('unidade_id', unidadeId)
    .order('ordem')
    .overrideTypes<Item[]>()

  const itens = itensData ?? []
  const ativos = itens.filter((i) => i.ativo)
  const inativos = itens.filter((i) => !i.ativo)

  return (
    <>
      <Topbar nome={profile?.nome ?? user.email ?? ''} cargo={profile?.cargo ?? ''} verTudo isAdmin active="rotina" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <Link href={`/rotina?unidade=${unidadeId}`} className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Rotina do dia
          </Link>

          <form method="get" className="mt-2 flex flex-wrap items-end gap-3">
            <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
              <label>Rotina da unidade</label>
              <select name="unidade" defaultValue={unidadeId}>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-outline btn-sm">
              Ver
            </button>
          </form>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          {ativos.length === 0 && (
            <form action={copiarDe} className="card sec-pad mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="unidade_id" value={unidadeId} />
              <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: 180 }}>
                <label>Copiar a rotina de outra unidade</label>
                <select name="origem_id" defaultValue="">
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {unidades
                    .filter((u) => u.id !== unidadeId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                </select>
              </div>
              <button type="submit" className="btn btn-outline btn-sm">
                Copiar
              </button>
            </form>
          )}

          <div className="sec-header mt-4">
            <div className="sec-title">Tarefas — {unidade?.nome ?? '—'}</div>
            <span className="badge badge-enviado">{ativos.length}</span>
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {ativos.length === 0 ? (
              <div className="empty-state">Nenhuma tarefa. Adicione abaixo ou copie de outra unidade.</div>
            ) : (
              ativos.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2 first:border-t-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="w-16 shrink-0 text-[.75rem] font-bold"
                      style={{ color: i.destaque ? 'var(--coral)' : 'var(--text-muted)' }}
                    >
                      {i.hora}
                    </span>
                    <span className="truncate normal-case text-[.82rem] text-white">{i.tarefa}</span>
                  </div>
                  <form action={desativarItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="unidade_id" value={unidadeId} />
                    <ConfirmButton
                      className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                      confirmMessage={`Remover "${i.tarefa}" da rotina? O histórico de quem já marcou continua guardado.`}
                    >
                      Remover
                    </ConfirmButton>
                  </form>
                </div>
              ))
            )}
          </div>

          <form action={addItem} className="card sec-pad mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="unidade_id" value={unidadeId} />
            <div className="form-group" style={{ marginBottom: 0, width: 110 }}>
              <label>Hora</label>
              {/* text e não time: o antigo tem "8 às 18" numa das tarefas. */}
              <input name="hora" type="text" placeholder="08:00" required />
            </div>
            <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: 200 }}>
              <label>Tarefa</label>
              <input name="tarefa" type="text" required />
            </div>
            <label className="flex items-center gap-2 pb-2 text-[.75rem] normal-case text-[var(--text-muted)]">
              <input name="destaque" type="checkbox" className="h-4 w-4" />
              Destacar
            </label>
            <button type="submit" className="btn btn-red btn-sm">
              Adicionar
            </button>
          </form>

          {inativos.length > 0 && (
            <>
              <div className="sec-header mt-6">
                <div className="sec-title">Removidas</div>
              </div>
              <div className="sec-body" style={{ padding: 0 }}>
                {inativos.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2 first:border-t-0 opacity-60"
                  >
                    <span className="truncate normal-case text-[.8rem]">
                      {i.hora} · {i.tarefa}
                    </span>
                    <form action={reativarItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="unidade_id" value={unidadeId} />
                      <button type="submit" className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white">
                        Reativar
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
