import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { EditarModuloTreinamento } from '@/components/EditarModuloTreinamento'
import { podeVerTudo } from '@/lib/membros'
import { salvarModulo, excluirModulo } from '../actions'

type ProfileSummary = { nome: string; cargo: string }
type ModuloDetail = { id: string; titulo: string; conteudo: string; posicao: number; ativo: boolean }
type Pergunta = { id: string; texto: string; posicao: number }
type Opcao = { id: string; pergunta_id: string; texto: string; correta: boolean; posicao: number }

export default async function EditarModuloPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduloId: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { moduloId } = await params
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

  if (!isAdmin) {
    redirect('/treinamento')
  }

  const { data: modulo } = await supabase
    .from('treinamento_modulos')
    .select('id, titulo, conteudo, posicao, ativo')
    .eq('id', moduloId)
    .single<ModuloDetail>()

  if (!modulo) {
    notFound()
  }

  const { data: perguntasData } = await supabase
    .from('treinamento_perguntas')
    .select('id, texto, posicao')
    .eq('modulo_id', moduloId)
    .order('posicao')
    .overrideTypes<Pergunta[]>()
  const perguntas = perguntasData ?? []

  const idsPerguntas = perguntas.map((p) => p.id)
  let opcoesPorPergunta = new Map<string, Opcao[]>()
  if (idsPerguntas.length > 0) {
    const { data: opcoesData } = await supabase
      .from('treinamento_opcoes')
      .select('id, pergunta_id, texto, correta, posicao')
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

  const perguntasIniciais = perguntas.map((p) => ({
    id: p.id,
    texto: p.texto,
    opcoes: (opcoesPorPergunta.get(p.id) ?? []).map((o) => ({ id: o.id, texto: o.texto, correta: o.correta })),
  }))

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/treinamento/admin" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
              ← Módulos
            </Link>
            <form action={excluirModulo}>
              <input type="hidden" name="modulo_id" value={modulo.id} />
              <ConfirmButton
                className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                confirmMessage={`Excluir o módulo "${modulo.titulo}"? Isso apaga as perguntas e o progresso dos consultores nele.`}
              >
                Excluir módulo
              </ConfirmButton>
            </form>
          </div>

          <div className="mt-2 sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Editar módulo
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}
          {success === '1' && (
            <p className="mt-3 rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
              Módulo salvo.
            </p>
          )}

          <div className="mt-4">
            <EditarModuloTreinamento
              moduloId={modulo.id}
              titulo={modulo.titulo}
              conteudo={modulo.conteudo}
              posicao={modulo.posicao}
              ativo={modulo.ativo}
              perguntasIniciais={perguntasIniciais}
              action={salvarModulo}
            />
          </div>
        </div>
      </div>
    </>
  )
}
