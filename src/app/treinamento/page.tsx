import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { MetaWidget } from '@/components/MetaWidget'
import { metaColor } from '@/lib/metas'
import { calcularProgresso, statusDoModulo } from '@/lib/treinamento'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura } from '@/lib/membros'
import { responderQuiz } from './actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Consultor = { id: string; nome: string; unidades: { nome: string } | null }
type Modulo = { id: string; titulo: string; conteudo: string; posicao: number }
type ProgressoRow = { consultor_id: string; modulo_id: string; enviado_em: string | null; aprovado_em: string | null }
type Pergunta = { id: string; modulo_id: string; texto: string; posicao: number }
type Opcao = { id: string; pergunta_id: string; texto: string; posicao: number }

export default async function TreinamentoPage({
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

  if (profile?.cargo !== 'consultor' && !verTudo) {
    redirect('/')
  }

  const topbar = (
    <Topbar
      nome={profile?.nome ?? user.email ?? ''}
      cargo={profile?.cargo ?? ''}
      verTudo={verTudo}
      isAdmin={isAdmin}
      active="treinamento"
    />
  )

  // Consultor: estuda o conteúdo e tira o quiz sozinho — a aprovação final é
  // da gerência (ver /treinamento/[id]).
  if (profile?.cargo === 'consultor') {
    const { data: modulosData } = await supabase
      .from('treinamento_modulos')
      .select('id, titulo, conteudo, posicao')
      .eq('ativo', true)
      .order('posicao')
      .overrideTypes<Modulo[]>()
    const modulos = modulosData ?? []

    const { data: progressoData } = await supabase
      .from('treinamento_progresso')
      .select('consultor_id, modulo_id, enviado_em, aprovado_em')
      .eq('consultor_id', user.id)
      .overrideTypes<ProgressoRow[]>()
    const progressoPorModulo = new Map((progressoData ?? []).map((p) => [p.modulo_id, p]))

    const { total, feitas, percentual } = calcularProgresso(
      modulos.length,
      modulos.filter((m) => progressoPorModulo.get(m.id)?.aprovado_em).length
    )

    // Só busca pergunta/opção dos módulos ainda não aprovados — não tem
    // porque mostrar quiz de módulo já fechado.
    const idsPendentes = modulos
      .filter((m) => statusDoModulo(progressoPorModulo.get(m.id)) !== 'aprovado')
      .map((m) => m.id)

    let perguntasPorModulo = new Map<string, Pergunta[]>()
    let opcoesPorPergunta = new Map<string, Opcao[]>()
    if (idsPendentes.length > 0) {
      const { data: perguntasData } = await supabase
        .from('treinamento_perguntas')
        .select('id, modulo_id, texto, posicao')
        .in('modulo_id', idsPendentes)
        .order('posicao')
        .overrideTypes<Pergunta[]>()
      const perguntas = perguntasData ?? []
      perguntasPorModulo = new Map()
      for (const p of perguntas) {
        const lista = perguntasPorModulo.get(p.modulo_id) ?? []
        lista.push(p)
        perguntasPorModulo.set(p.modulo_id, lista)
      }

      const idsPerguntas = perguntas.map((p) => p.id)
      if (idsPerguntas.length > 0) {
        // View sem a coluna `correta` — o consultor não pode ver a resposta
        // certa (ver migration 20261014050000).
        const { data: opcoesData } = await supabase
          .from('treinamento_opcoes_quiz')
          .select('id, pergunta_id, texto, posicao')
          .in('pergunta_id', idsPerguntas)
          .order('posicao')
          .overrideTypes<Opcao[]>()
        opcoesPorPergunta = new Map()
        for (const o of opcoesData ?? []) {
          const lista = opcoesPorPergunta.get(o.pergunta_id) ?? []
          lista.push(o)
          opcoesPorPergunta.set(o.pergunta_id, lista)
        }
      }
    }

    return (
      <>
        {topbar}
        <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-2xl">
            <MetaWidget
              titulo="Seu treinamento"
              realizadoLabel={`${feitas} de ${total} módulos`}
              metaLabel={`${total} módulos`}
              pct={percentual}
              faltam={total - feitas}
              substantivo="módulos"
            />

            {error && (
              <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
                {error}
              </p>
            )}

            {modulos.length === 0 ? (
              <div className="mt-4 empty-state">Nenhum módulo de treinamento cadastrado ainda.</div>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {modulos.map((m) => {
                  const status = statusDoModulo(progressoPorModulo.get(m.id))
                  const perguntas = perguntasPorModulo.get(m.id) ?? []
                  return (
                    <div key={m.id} className="card sec-pad">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-white">{m.titulo}</p>
                        {status === 'aprovado' && <span className="badge badge-aprovado">Aprovado</span>}
                        {status === 'aguardando_aprovacao' && (
                          <span className="badge badge-enviado">Aguardando aprovação</span>
                        )}
                      </div>

                      <details className="mt-2">
                        <summary className="cursor-pointer text-[.72rem] font-bold text-[var(--coral)]">
                          Ver conteúdo
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap normal-case text-[.82rem] text-white">{m.conteudo}</p>
                      </details>

                      {status === 'pendente' && perguntas.length > 0 && (
                        <form action={responderQuiz} className="mt-4 flex flex-col gap-4">
                          <input type="hidden" name="modulo_id" value={m.id} />
                          {perguntas.map((p) => (
                            <div key={p.id}>
                              <p className="normal-case text-white">{p.texto}</p>
                              <div className="mt-1 flex flex-col gap-1">
                                {(opcoesPorPergunta.get(p.id) ?? []).map((o) => (
                                  <label
                                    key={o.id}
                                    className="flex items-center gap-2 normal-case text-[.85rem] text-[var(--text-muted)]"
                                  >
                                    <input type="radio" name={`pergunta_${p.id}`} value={o.id} required />
                                    {o.texto}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                          <button type="submit" className="btn btn-red btn-sm self-start">
                            Enviar respostas
                          </button>
                        </form>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  // Gerência/admin/visualizador: lista dos consultores (gerente/supervisor só
  // vê a própria unidade; admin/visualizador veem todos).
  const veTudoUnidades = isAdmin || isSomenteLeitura(profile?.cargo)
  const unidadeGerente = !veTudoUnidades && isGerencia ? profile?.unidade_id ?? null : null

  const { count: totalModulosAtivos } = await supabase
    .from('treinamento_modulos')
    .select('*', { count: 'exact', head: true })
    .eq('ativo', true)

  let consultoresQuery = supabase
    .from('profiles')
    .select('id, nome, unidades(nome)')
    .eq('cargo', 'consultor')
    .eq('ativo', true)
    .order('nome')
  if (unidadeGerente) consultoresQuery = consultoresQuery.eq('unidade_id', unidadeGerente)
  const { data: consultoresData } = await consultoresQuery.overrideTypes<Consultor[]>()
  const consultores = consultoresData ?? []

  const ids = consultores.map((c) => c.id)
  let aprovadosPorConsultor = new Map<string, number>()
  if (ids.length > 0) {
    const { data: progressoData } = await supabase
      .from('treinamento_progresso')
      .select('consultor_id, aprovado_em')
      .in('consultor_id', ids)
      .overrideTypes<{ consultor_id: string; aprovado_em: string | null }[]>()
    aprovadosPorConsultor = new Map()
    for (const p of progressoData ?? []) {
      if (!p.aprovado_em) continue
      aprovadosPorConsultor.set(p.consultor_id, (aprovadosPorConsultor.get(p.consultor_id) ?? 0) + 1)
    }
  }

  return (
    <>
      {topbar}
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Treinamento dos consultores
            </div>
            {isAdmin && (
              <Link href="/treinamento/admin" className="btn btn-outline btn-sm">
                Gerenciar módulos
              </Link>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="mt-4 sec-body" style={{ padding: 0 }}>
            {consultores.length === 0 ? (
              <div className="empty-state">Nenhum consultor ativo.</div>
            ) : (
              consultores.map((c) => {
                const { total, feitas, percentual } = calcularProgresso(
                  totalModulosAtivos ?? 0,
                  aprovadosPorConsultor.get(c.id) ?? 0
                )
                const cor = metaColor(percentual)
                return (
                  <Link
                    key={c.id}
                    href={`/treinamento/${c.id}`}
                    className="block border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-white/[.02]"
                  >
                    <div className="flex items-center justify-between gap-2 text-[.82rem]">
                      <span className="font-semibold text-white">
                        {c.nome}
                        {veTudoUnidades && c.unidades?.nome && (
                          <span className="ml-1 font-normal text-[var(--text-muted)]">· {c.unidades.nome}</span>
                        )}
                      </span>
                      <span style={{ color: cor.fillColor }}>
                        {feitas}/{total} módulos
                      </span>
                    </div>
                    <div className="meta-track" style={{ margin: '6px 0 0' }}>
                      <div className="meta-fill" style={{ width: `${percentual}%`, background: cor.fillColor }} />
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}
