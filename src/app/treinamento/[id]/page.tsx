import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { MetaWidget } from '@/components/MetaWidget'
import { calcularProgresso, statusDoModulo } from '@/lib/treinamento'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura } from '@/lib/membros'
import { aprovarModulo, pedirRefazerModulo } from '../actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type ConsultorDetail = { id: string; nome: string; cargo: string; unidade_id: string | null; unidades: { nome: string } | null }
type Modulo = { id: string; titulo: string; posicao: number }
type ProgressoRow = { modulo_id: string; enviado_em: string | null; aprovado_em: string | null }
type RespostaComCerta = { modulo_id: string; opcao: { correta: boolean } | null }

export default async function TreinamentoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
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

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'
  const isGerencia = isGerenciaCargo(profile?.cargo)
  const soLeitura = isSomenteLeitura(profile?.cargo)

  // A visão de um consultor é a própria /treinamento — essa rota é só pra
  // quem gerencia/lê a equipe toda.
  if (!verTudo) {
    redirect('/treinamento')
  }

  const { data: consultor } = await supabase
    .from('profiles')
    .select('id, nome, cargo, unidade_id, unidades(nome)')
    .eq('id', id)
    .single<ConsultorDetail>()

  if (!consultor || consultor.cargo !== 'consultor') {
    notFound()
  }

  // Gerente/supervisor só mexe na própria unidade; admin/visualizador veem
  // qualquer uma.
  const veTudoUnidades = isAdmin || soLeitura
  if (!veTudoUnidades && isGerencia && consultor.unidade_id !== profile?.unidade_id) {
    notFound()
  }

  const { data: modulosData } = await supabase
    .from('treinamento_modulos')
    .select('id, titulo, posicao')
    .eq('ativo', true)
    .order('posicao')
    .overrideTypes<Modulo[]>()
  const modulos = modulosData ?? []

  const { data: progressoData } = await supabase
    .from('treinamento_progresso')
    .select('modulo_id, enviado_em, aprovado_em')
    .eq('consultor_id', consultor.id)
    .overrideTypes<ProgressoRow[]>()
  const progressoPorModulo = new Map((progressoData ?? []).map((p) => [p.modulo_id, p]))

  // Nota de cada módulo: junta as respostas do consultor com a tabela BASE de
  // opções (tem a coluna `correta`) — a gerência já tem select ali, sem
  // precisar da view que o consultor usa pra tirar o quiz.
  const { data: respostasData } = await supabase
    .from('treinamento_respostas')
    .select('modulo_id, opcao:treinamento_opcoes(correta)')
    .eq('consultor_id', consultor.id)
    .overrideTypes<RespostaComCerta[]>()
  const notaPorModulo = new Map<string, { total: number; certas: number }>()
  for (const r of respostasData ?? []) {
    const atual = notaPorModulo.get(r.modulo_id) ?? { total: 0, certas: 0 }
    atual.total += 1
    if (r.opcao?.correta) atual.certas += 1
    notaPorModulo.set(r.modulo_id, atual)
  }

  const { total, feitas, percentual } = calcularProgresso(
    modulos.length,
    modulos.filter((m) => progressoPorModulo.get(m.id)?.aprovado_em).length
  )

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="treinamento"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <Link href="/treinamento" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Treinamento
          </Link>

          <div className="mt-2">
            <MetaWidget
              titulo={consultor.nome}
              subtitulo={consultor.unidades?.nome ?? undefined}
              realizadoLabel={`${feitas} de ${total} módulos`}
              metaLabel={`${total} módulos`}
              pct={percentual}
              faltam={total - feitas}
              substantivo="módulos"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {modulos.map((m) => {
              const status = statusDoModulo(progressoPorModulo.get(m.id))
              const nota = notaPorModulo.get(m.id)
              return (
                <div key={m.id} className="card sec-pad">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">{m.titulo}</p>
                    <div className="flex items-center gap-2">
                      {nota && (
                        <span className="text-[.72rem] normal-case text-[var(--text-muted)]">
                          {nota.certas}/{nota.total} corretas
                        </span>
                      )}
                      {status === 'aprovado' && <span className="badge badge-aprovado">Aprovado</span>}
                      {status === 'aguardando_aprovacao' && (
                        <span className="badge badge-enviado">Aguardando aprovação</span>
                      )}
                      {status === 'pendente' && <span className="badge badge-pendente">Pendente</span>}
                    </div>
                  </div>

                  {!soLeitura && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {status === 'aguardando_aprovacao' && (
                        <form action={aprovarModulo}>
                          <input type="hidden" name="consultor_id" value={consultor.id} />
                          <input type="hidden" name="modulo_id" value={m.id} />
                          <button type="submit" className="btn btn-red btn-sm">
                            Aprovar módulo
                          </button>
                        </form>
                      )}
                      {status !== 'pendente' && (
                        <form action={pedirRefazerModulo}>
                          <input type="hidden" name="consultor_id" value={consultor.id} />
                          <input type="hidden" name="modulo_id" value={m.id} />
                          <button type="submit" className="btn btn-outline btn-sm">
                            Pedir para refazer
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
