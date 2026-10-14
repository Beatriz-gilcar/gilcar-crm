import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { MetaWidget } from '@/components/MetaWidget'
import { metaColor } from '@/lib/metas'
import { ETAPAS_TREINAMENTO, calcularProgresso } from '@/lib/treinamento'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura } from '@/lib/membros'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Consultor = { id: string; nome: string; unidades: { nome: string } | null }
type ProgressoRow = { consultor_id: string; etapa: string }

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

  // Consultor: só a própria barra, sem formulário nenhum.
  if (profile?.cargo === 'consultor') {
    const { data: progressoData } = await supabase
      .from('treinamento_progresso')
      .select('etapa')
      .eq('consultor_id', user.id)
      .overrideTypes<{ etapa: string }[]>()

    const feitas = new Set((progressoData ?? []).map((p) => p.etapa))
    const { total, feitas: qtdFeitas, percentual } = calcularProgresso(feitas)

    return (
      <>
        {topbar}
        <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-2xl">
            <MetaWidget
              titulo="Seu treinamento"
              realizadoLabel={`${qtdFeitas} de ${total} etapas`}
              metaLabel={`${total} etapas`}
              pct={percentual}
              faltam={total - qtdFeitas}
              substantivo="etapas"
            />
            <div className="mt-4 sec-body" style={{ padding: 0 }}>
              {ETAPAS_TREINAMENTO.map((e) => (
                <div
                  key={e.chave}
                  className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                >
                  <p className="normal-case text-white">{e.titulo}</p>
                  <span className={`badge ${feitas.has(e.chave) ? 'badge-aprovado' : 'badge-pendente'}`}>
                    {feitas.has(e.chave) ? 'Feito' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  // Gerência/admin/visualizador: lista dos consultores (gerente/supervisor só
  // vê a própria unidade; admin/visualizador veem todos).
  const veTudoUnidades = isAdmin || isSomenteLeitura(profile?.cargo)
  const unidadeGerente = !veTudoUnidades && isGerencia ? profile?.unidade_id ?? null : null

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
  let progressoPorConsultor = new Map<string, Set<string>>()
  if (ids.length > 0) {
    const { data: progressoData } = await supabase
      .from('treinamento_progresso')
      .select('consultor_id, etapa')
      .in('consultor_id', ids)
      .overrideTypes<ProgressoRow[]>()
    progressoPorConsultor = new Map()
    for (const p of progressoData ?? []) {
      const set = progressoPorConsultor.get(p.consultor_id) ?? new Set<string>()
      set.add(p.etapa)
      progressoPorConsultor.set(p.consultor_id, set)
    }
  }

  return (
    <>
      {topbar}
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Treinamento dos consultores
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
                const feitas = progressoPorConsultor.get(c.id) ?? new Set<string>()
                const { total, feitas: qtdFeitas, percentual } = calcularProgresso(feitas)
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
                        {qtdFeitas}/{total} etapas
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
