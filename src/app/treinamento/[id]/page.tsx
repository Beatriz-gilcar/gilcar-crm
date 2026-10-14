import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { MetaWidget } from '@/components/MetaWidget'
import { AutoSubmitCheckbox } from '@/components/AutoSubmitCheckbox'
import { ETAPAS_TREINAMENTO, calcularProgresso } from '@/lib/treinamento'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura } from '@/lib/membros'
import { marcarEtapaTreinamento } from '../actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type ConsultorDetail = { id: string; nome: string; cargo: string; unidade_id: string | null; unidades: { nome: string } | null }

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

  const { data: progressoData } = await supabase
    .from('treinamento_progresso')
    .select('etapa')
    .eq('consultor_id', consultor.id)
    .overrideTypes<{ etapa: string }[]>()

  const feitas = new Set((progressoData ?? []).map((p) => p.etapa))
  const { total, feitas: qtdFeitas, percentual } = calcularProgresso(feitas)

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
              realizadoLabel={`${qtdFeitas} de ${total} etapas`}
              metaLabel={`${total} etapas`}
              pct={percentual}
              faltam={total - qtdFeitas}
              substantivo="etapas"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="mt-4 sec-body" style={{ padding: 0 }}>
            {ETAPAS_TREINAMENTO.map((e) => {
              const concluida = feitas.has(e.chave)
              return (
                <div
                  key={e.chave}
                  className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                >
                  {soLeitura ? (
                    <>
                      <p className="normal-case text-white">{e.titulo}</p>
                      <span className={`badge ${concluida ? 'badge-aprovado' : 'badge-pendente'}`}>
                        {concluida ? 'Feito' : 'Pendente'}
                      </span>
                    </>
                  ) : (
                    <form action={marcarEtapaTreinamento} className="flex w-full items-center justify-between gap-3">
                      <input type="hidden" name="consultor_id" value={consultor.id} />
                      <input type="hidden" name="etapa" value={e.chave} />
                      <label className="flex flex-1 items-center gap-2 normal-case text-white">
                        <AutoSubmitCheckbox name="concluido" defaultChecked={concluida} />
                        {e.titulo}
                      </label>
                    </form>
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
