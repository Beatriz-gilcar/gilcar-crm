import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { statusLabel, statusBadgeClass } from '@/lib/tratos'
import { marcarStatusTrato, deleteTrato } from './actions'

type Trato = {
  id: string
  cliente_nome: string
  celular: string | null
  veiculo: string | null
  combinado: string
  data: string
  prazo: string | null
  status: string
  observacao: string | null
  profiles: { nome: string } | null
  unidades: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function TratosPage() {
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

  const { data: tratosData } = await supabase
    .from('tratos')
    .select(
      'id, cliente_nome, celular, veiculo, combinado, data, prazo, status, observacao, profiles(nome), unidades(nome)'
    )
    .order('prazo', { ascending: true, nullsFirst: false })
    .order('data', { ascending: false })
    .overrideTypes<Trato[]>()

  const tratos = tratosData ?? []
  const hoje = hojeISO()

  const pendentes = tratos.filter((t) => t.status === 'pendente').length
  const atrasados = tratos.filter((t) => t.status === 'pendente' && t.prazo && t.prazo < hoje).length
  const cumpridos = tratos.filter((t) => t.status === 'cumprido').length

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="tratos"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Pendentes</div>
              <div className="kpi-val">{pendentes}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Atrasados</div>
              <div className="kpi-val">{atrasados}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Cumpridos</div>
              <div className="kpi-val">{cumpridos}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Tratos
            </div>
            <Link href="/tratos/new" className="btn btn-red btn-sm">
              + Novo trato
            </Link>
          </div>

          <div className="sec-body mt-3" style={{ padding: 0 }}>
            {tratos.length === 0 ? (
              <div className="empty-state">Nenhum trato cadastrado ainda.</div>
            ) : (
              <div className="flex flex-col">
                {tratos.map((trato) => {
                  const atrasado = trato.status === 'pendente' && trato.prazo && trato.prazo < hoje
                  return (
                    <div
                      key={trato.id}
                      className="flex flex-wrap items-start justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                    >
                      <div>
                        <p className="normal-case text-white">
                          {trato.cliente_nome}
                          {trato.veiculo ? ` · ${trato.veiculo}` : ''}
                        </p>
                        <p className="mt-1 normal-case text-[.8rem] text-white">{trato.combinado}</p>
                        <p className="mt-1 text-[.7rem] normal-case text-[var(--text-muted)]">
                          {trato.profiles?.nome ?? '—'} · {trato.unidades?.nome ?? '—'}
                          {trato.celular ? ` · ${trato.celular}` : ''} ·{' '}
                          {new Date(`${trato.data}T12:00:00`).toLocaleDateString('pt-BR')}
                          {trato.prazo && (
                            <span className={atrasado ? 'font-bold text-[var(--danger)]' : ''}>
                              {' '}
                              · prazo {new Date(`${trato.prazo}T12:00:00`).toLocaleDateString('pt-BR')}
                              {atrasado ? ' (atrasado)' : ''}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`badge ${statusBadgeClass[trato.status]}`}>
                          {statusLabel[trato.status]}
                        </span>
                        {trato.status === 'pendente' && (
                          <div className="flex items-center gap-2">
                            <form action={marcarStatusTrato}>
                              <input type="hidden" name="id" value={trato.id} />
                              <input type="hidden" name="status" value="cumprido" />
                              <button
                                type="submit"
                                className="text-[.68rem] font-bold text-[var(--success)] hover:underline"
                              >
                                Cumprido
                              </button>
                            </form>
                            <form action={marcarStatusTrato}>
                              <input type="hidden" name="id" value={trato.id} />
                              <input type="hidden" name="status" value="nao_cumprido" />
                              <button
                                type="submit"
                                className="text-[.68rem] font-bold text-[var(--danger)] hover:underline"
                              >
                                Não cumprido
                              </button>
                            </form>
                          </div>
                        )}
                        {isGerencia && (
                          <form action={deleteTrato}>
                            <input type="hidden" name="id" value={trato.id} />
                            <ConfirmButton
                              className="text-[.68rem] font-bold text-[var(--text-muted)] hover:text-white"
                              confirmMessage={`Excluir o trato com ${trato.cliente_nome}?`}
                            >
                              Excluir
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
