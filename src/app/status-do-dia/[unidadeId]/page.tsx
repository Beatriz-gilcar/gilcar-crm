import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { aprovarConsultorDia, aprovarDiaUnidade } from '../actions'

type ConsultorStatus = {
  consultor_id: string
  consultor_nome: string
  enviados: number
  aprovado: boolean
}

type ProfileSummary = { nome: string; cargo: string }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function StatusDoDiaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ unidadeId: string }>
  searchParams: Promise<{ data?: string }>
}) {
  const { unidadeId } = await params
  const { data: dataParam } = await searchParams
  const data = dataParam || hojeISO()

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

  if (!isGerencia) {
    redirect('/')
  }

  const { data: unidade } = await supabase
    .from('unidades')
    .select('id, nome')
    .eq('id', unidadeId)
    .single<{ id: string; nome: string }>()

  if (!unidade) {
    notFound()
  }

  const { data: aprovacaoDia } = await supabase
    .from('aprovacoes_dia')
    .select('status')
    .eq('unidade_id', unidadeId)
    .eq('data', data)
    .maybeSingle<{ status: string }>()

  const diaAprovado = aprovacaoDia?.status === 'aprovado'

  const { data: consultores } = await supabase.rpc('status_dia_detalhe', {
    p_data: data,
    p_unidade_id: unidadeId,
  })
  const rows = (consultores ?? []) as ConsultorStatus[]

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        active="status-do-dia"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={`/status-do-dia?data=${data}`}
            className="text-[.72rem] text-[var(--text-muted)] hover:text-white"
          >
            ← Status do Dia
          </Link>

          <div className="mt-2">
            <div className="sec-header">
              <div className="sec-title">
                {unidade.nome} — {new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR')}
              </div>
              <span className={`badge ${diaAprovado ? 'badge-aprovado' : 'badge-pendente'}`}>
                {diaAprovado ? 'Aprovado' : 'Aberto'}
              </span>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {rows.length === 0 ? (
                <div className="empty-state">Nenhum consultor nesta unidade.</div>
              ) : (
                <ul className="flex flex-col">
                  {rows.map((row) => (
                    <li
                      key={row.consultor_id}
                      className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                    >
                      <div>
                        <p className="font-semibold text-white">{row.consultor_nome}</p>
                        <p className="text-[.75rem] text-[var(--text-muted)]">
                          {row.enviados} atendimento{row.enviados === 1 ? '' : 's'} enviado
                          {row.enviados === 1 ? '' : 's'}
                        </p>
                      </div>
                      {row.aprovado ? (
                        <span className="badge badge-aprovado">Aprovado</span>
                      ) : (
                        <form action={aprovarConsultorDia}>
                          <input type="hidden" name="consultor_id" value={row.consultor_id} />
                          <input type="hidden" name="data" value={data} />
                          <input type="hidden" name="unidade_id" value={unidadeId} />
                          <button type="submit" className="btn btn-outline btn-sm">
                            Aprovar
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!diaAprovado && (
              <form action={aprovarDiaUnidade} className="mt-4">
                <input type="hidden" name="unidade_id" value={unidadeId} />
                <input type="hidden" name="data" value={data} />
                <ConfirmButton
                  className="btn btn-red"
                  confirmMessage={`Aprovar o dia inteiro para ${unidade.nome}? Depois disso ninguém mais poderá enviar atendimentos para essa data.`}
                >
                  Aprovar o dia inteiro
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
