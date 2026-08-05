import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo, isSomenteLeitura } from '@/lib/membros'
import { horaBR } from '@/lib/datas'
import { marcarItem, desmarcarItem } from './actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }

type Item = {
  id: string
  ordem: number
  hora: string
  tarefa: string
  destaque: boolean
  rotina_marcacoes: { data: string; marcado_em: string; profiles: { nome: string } | null }[]
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function RotinaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; unidade?: string; error?: string }>
}) {
  const { data: dataParam, unidade: unidadeParam, error } = await searchParams
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
    .select('nome, cargo, unidade_id')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'
  const soLeitura = isSomenteLeitura(profile?.cargo)

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  // Quem é de uma loja vê a dela e pronto. Quem é "Todas" (Junior, Gilmar, o
  // CEO) escolhe qual quer ver.
  const unidadeId = profile?.unidade_id ?? unidadeParam ?? unidades[0]?.id ?? ''
  const unidade = unidades.find((u) => u.id === unidadeId)
  const podeTrocarUnidade = !profile?.unidade_id

  const { data: itensData } = await supabase
    .from('rotina_itens')
    .select('id, ordem, hora, tarefa, destaque, rotina_marcacoes(data, marcado_em, profiles(nome))')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('hora')
    .order('ordem')
    .overrideTypes<Item[]>()

  const itens = itensData ?? []

  // O join traz as marcações de todos os dias; aqui só interessa a do dia
  // escolhido.
  const feitoDoDia = (item: Item) => item.rotina_marcacoes.find((m) => m.data === data)

  const feitos = itens.filter((i) => feitoDoDia(i)).length
  const pct = itens.length > 0 ? Math.round((feitos / itens.length) * 100) : 0

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="rotina"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
              <label>Data</label>
              <input type="date" name="data" defaultValue={data} />
            </div>
            {podeTrocarUnidade && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
                <label>Unidade</label>
                <select name="unidade" defaultValue={unidadeId}>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" className="btn btn-outline btn-sm">
              Ver
            </button>
            {isAdmin && (
              <Link href={`/rotina/editar?unidade=${unidadeId}`} className="btn btn-outline btn-sm">
                Editar rotina
              </Link>
            )}
          </form>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="sec-header mt-4">
            <div className="sec-title">Rotina do dia — {unidade?.nome ?? '—'}</div>
            <span className={`badge ${pct === 100 ? 'badge-aprovado' : 'badge-pendente'}`}>
              {feitos}/{itens.length}
            </span>
          </div>

          <div className="sec-body" style={{ padding: 0 }}>
            {itens.length === 0 ? (
              <div className="empty-state">
                {unidade?.nome ?? 'Esta unidade'} ainda não tem rotina montada.
                {isAdmin && ' Use "Editar rotina" pra criar.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[.8rem]">
                  <thead>
                    <tr className="text-left text-[.68rem] text-[var(--text-muted)]">
                      <th className="px-4 py-2 font-bold">Tarefa</th>
                      <th className="px-4 py-2 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item) => {
                      const feito = feitoDoDia(item)
                      return (
                        <tr key={item.id} className="border-t border-[var(--border)]">
                          <td
                            className="px-4 py-3 normal-case font-bold"
                            style={{ color: item.destaque ? 'var(--coral)' : 'white' }}
                          >
                            {item.tarefa}
                          </td>
                          <td className="px-4 py-3">
                            {feito ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="whitespace-nowrap font-bold text-[var(--success)]">
                                  ✓ {feito.profiles?.nome ?? '—'} às {horaBR(feito.marcado_em)}
                                </span>
                                {!soLeitura && (
                                  <form action={desmarcarItem}>
                                    <input type="hidden" name="item_id" value={item.id} />
                                    <input type="hidden" name="data" value={data} />
                                    <input type="hidden" name="unidade_id" value={unidadeId} />
                                    <button
                                      type="submit"
                                      className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white"
                                    >
                                      Desmarcar
                                    </button>
                                  </form>
                                )}
                              </div>
                            ) : (
                              !soLeitura && (
                                <form action={marcarItem}>
                                  <input type="hidden" name="item_id" value={item.id} />
                                  <input type="hidden" name="data" value={data} />
                                  <input type="hidden" name="unidade_id" value={unidadeId} />
                                  <button type="submit" className="btn btn-red btn-sm whitespace-nowrap">
                                    ✓ Marcar feito
                                  </button>
                                </form>
                              )
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
