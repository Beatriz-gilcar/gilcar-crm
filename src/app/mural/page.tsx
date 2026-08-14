import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { podeVerTudo, cargoLabel } from '@/lib/membros'
import { dataHoraBR } from '@/lib/datas'
import { criarPost, criarResposta, excluirPost, excluirResposta } from './actions'

type Autor = { nome: string; cargo: string } | null

type Resposta = {
  id: string
  post_id: string
  conteudo: string
  created_at: string
  autor_id: string
  profiles: Autor
}

type Post = {
  id: string
  tipo: string
  titulo: string
  conteudo: string
  created_at: string
  autor_id: string
  profiles: Autor
}

type ProfileSummary = { nome: string; cargo: string }

const tipoLabel: Record<string, string> = { duvida: 'Dúvida', sugestao: 'Sugestão' }
const tipoBadgeClass: Record<string, string> = { duvida: 'badge-pendente', sugestao: 'badge-enviado' }

export default async function MuralPage({
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

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  const [{ data: postsData }, { data: respostasData }] = await Promise.all([
    supabase
      .from('mural_posts')
      .select('id, tipo, titulo, conteudo, created_at, autor_id, profiles(nome, cargo)')
      .order('created_at', { ascending: false })
      .overrideTypes<Post[]>(),
    supabase
      .from('mural_respostas')
      .select('id, post_id, conteudo, created_at, autor_id, profiles(nome, cargo)')
      .order('created_at', { ascending: true })
      .overrideTypes<Resposta[]>(),
  ])

  const posts = postsData ?? []
  const respostasPorPost = new Map<string, Resposta[]>()
  for (const r of respostasData ?? []) {
    const lista = respostasPorPost.get(r.post_id) ?? []
    lista.push(r)
    respostasPorPost.set(r.post_id, lista)
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="mural"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="sec-header">
            <div className="sec-title">Mural — dúvidas e sugestões</div>
          </div>

          {error && (
            <p className="mb-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}
          {success === '1' && (
            <p className="mb-3 rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
              Publicado.
            </p>
          )}

          <form action={criarPost} className="card sec-pad flex flex-col gap-3">
            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo</label>
                <select name="tipo" defaultValue="duvida">
                  <option value="duvida">Dúvida</option>
                  <option value="sugestao">Sugestão</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Título</label>
                <input name="titulo" type="text" required placeholder="Resumo em poucas palavras" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Descrição</label>
              <textarea name="conteudo" rows={3} required placeholder="Explique com detalhes" />
            </div>
            <button type="submit" className="btn btn-red self-start">
              Publicar
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-4">
            {posts.length === 0 ? (
              <div className="empty-state">Nada publicado ainda.</div>
            ) : (
              posts.map((post) => {
                const respostas = respostasPorPost.get(post.id) ?? []
                const podeExcluirPost = isAdmin || post.autor_id === user.id
                return (
                  <div key={post.id} className="card sec-pad flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`badge ${tipoBadgeClass[post.tipo] ?? 'badge-neutro'}`}>
                            {tipoLabel[post.tipo] ?? post.tipo}
                          </span>
                          <p className="font-semibold text-white">{post.titulo}</p>
                        </div>
                        <p className="mt-1 text-[.72rem] text-[var(--text-muted)]">
                          {post.profiles?.nome ?? '—'}
                          {post.profiles?.cargo ? ` · ${cargoLabel[post.profiles.cargo] ?? post.profiles.cargo}` : ''}
                          {' · '}
                          {dataHoraBR(post.created_at)}
                        </p>
                      </div>
                      {podeExcluirPost && (
                        <form action={excluirPost}>
                          <input type="hidden" name="id" value={post.id} />
                          <ConfirmButton
                            className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                            confirmMessage={`Excluir "${post.titulo}"? As respostas também somem.`}
                          >
                            Excluir
                          </ConfirmButton>
                        </form>
                      )}
                    </div>

                    <p className="normal-case text-white">{post.conteudo}</p>

                    {respostas.length > 0 && (
                      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                        {respostas.map((r) => (
                          <div key={r.id} className="flex items-start justify-between gap-2 pl-3">
                            <div>
                              <p className="text-[.72rem] font-semibold text-white">
                                {r.profiles?.nome ?? '—'}
                                {r.profiles?.cargo ? (
                                  <span className="font-normal text-[var(--text-muted)]">
                                    {' '}
                                    · {cargoLabel[r.profiles.cargo] ?? r.profiles.cargo} · {dataHoraBR(r.created_at)}
                                  </span>
                                ) : null}
                              </p>
                              <p className="normal-case text-white">{r.conteudo}</p>
                            </div>
                            {(isAdmin || r.autor_id === user.id) && (
                              <form action={excluirResposta}>
                                <input type="hidden" name="id" value={r.id} />
                                <ConfirmButton
                                  className="text-[.68rem] font-bold text-[var(--danger)] hover:underline"
                                  confirmMessage="Excluir essa resposta?"
                                >
                                  Excluir
                                </ConfirmButton>
                              </form>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isAdmin && (
                      <form action={criarResposta} className="flex items-end gap-2 border-t border-[var(--border)] pt-3">
                        <input type="hidden" name="post_id" value={post.id} />
                        <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                          <label>Responder</label>
                          <input name="conteudo" type="text" placeholder="Escreva uma resposta" required />
                        </div>
                        <button type="submit" className="btn btn-outline btn-sm">
                          Enviar
                        </button>
                      </form>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}
