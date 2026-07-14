import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { formatBRL } from '@/lib/ordens'
import { semestreAtual, semestreRange, metaColor } from '@/lib/metas'

type Venda = { consultor_id: string; unidade_id: string; valor: number }
type Meta = { escopo: string; unidade_id: string | null; consultor_id: string | null; valor_meta: number; valor_super_meta: number | null }
type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }
type Consultor = { id: string; nome: string; cargo: string }

export default async function PremiacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const { periodo: periodoParam } = await searchParams
  const periodo = periodoParam || semestreAtual()
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

  const { inicio, fim } = semestreRange(periodo)

  const { data: vendasData } = await supabase
    .from('vendas')
    .select('consultor_id, unidade_id, valor')
    .gte('data', inicio)
    .lt('data', fim)
    .overrideTypes<Venda[]>()
  const vendas = vendasData ?? []

  const { data: metasData } = await supabase
    .from('metas')
    .select('escopo, unidade_id, consultor_id, valor_meta, valor_super_meta')
    .eq('tipo', 'premiacao_vendas')
    .eq('periodo', periodo)
    .overrideTypes<Meta[]>()
  const metas = metasData ?? []

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  const { data: consultoresData } = await supabase
    .from('profiles')
    .select('id, nome, cargo')
    .eq('cargo', 'consultor')
    .order('nome')
  const consultores = (consultoresData ?? []) as Consultor[]

  const realizadoPorUnidade = new Map<string, number>()
  const realizadoPorConsultor = new Map<string, number>()
  for (const v of vendas) {
    realizadoPorUnidade.set(v.unidade_id, (realizadoPorUnidade.get(v.unidade_id) ?? 0) + v.valor)
    realizadoPorConsultor.set(v.consultor_id, (realizadoPorConsultor.get(v.consultor_id) ?? 0) + v.valor)
  }

  const metaUnidade = new Map(metas.filter((m) => m.escopo === 'unidade').map((m) => [m.unidade_id, m]))
  const metaConsultor = new Map(metas.filter((m) => m.escopo === 'consultor').map((m) => [m.consultor_id, m]))

  const rankingUnidades = unidades
    .map((u) => {
      const realizado = realizadoPorUnidade.get(u.id) ?? 0
      const meta = metaUnidade.get(u.id)
      const pct = meta && meta.valor_meta > 0 ? (realizado / meta.valor_meta) * 100 : 0
      return { unidade: u, realizado, meta, pct }
    })
    .sort((a, b) => b.pct - a.pct)

  const rankingConsultores = consultores
    .map((c) => {
      const realizado = realizadoPorConsultor.get(c.id) ?? 0
      const meta = metaConsultor.get(c.id)
      const pct = meta && meta.valor_meta > 0 ? (realizado / meta.valor_meta) * 100 : 0
      return { consultor: c, realizado, meta, pct }
    })
    .filter((r) => r.meta)
    .sort((a, b) => b.pct - a.pct)

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="premiacao"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Premiação Semestral
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form method="get" className="flex items-center gap-2">
                <select name="periodo" defaultValue={periodo}>
                  {[0, 1, 2].flatMap((offset) => {
                    const ano = new Date().getFullYear() - offset
                    return ['S2', 'S1'].map((s) => (
                      <option key={`${ano}-${s}`} value={`${ano}-${s}`}>
                        {ano} · {s}
                      </option>
                    ))
                  })}
                </select>
                <button type="submit" className="btn btn-outline btn-sm">
                  Ver
                </button>
              </form>
              {isAdmin && (
                <Link href="/premiacao/definir" className="btn btn-outline btn-sm">
                  Definir metas
                </Link>
              )}
            </div>
          </div>

          <p className="mt-2 text-[.72rem] normal-case text-[var(--text-muted)]">
            % geral considera hoje só a métrica de Vendas (Faturamento, Lucro e Avaliações Google
            ainda não têm lançamento no sistema).
          </p>

          <div className="mt-4">
            <div className="sec-header">
              <div className="sec-title">Ranking por unidade</div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {rankingUnidades.every((r) => !r.meta) ? (
                <div className="empty-state">Nenhuma meta de premiação definida para {periodo}.</div>
              ) : (
                <div className="flex flex-col">
                  {rankingUnidades.map((r, i) => {
                    const cor = metaColor(r.pct)
                    const bateuSuper = r.meta?.valor_super_meta && r.realizado >= r.meta.valor_super_meta
                    return (
                      <div
                        key={r.unidade.id}
                        className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[.9rem] font-bold text-[var(--text-muted)]">{i + 1}º</span>
                          <div>
                            <p className="normal-case text-white">{r.unidade.nome}</p>
                            <p className="text-[.7rem] normal-case text-[var(--text-muted)]">
                              {formatBRL(r.realizado)} / {r.meta ? formatBRL(r.meta.valor_meta) : 'sem meta'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {bateuSuper && <span className="badge badge-aprovado">Super Meta</span>}
                          <span className={`badge ${cor.badgeClass}`}>{r.pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="sec-header">
              <div className="sec-title">Ranking por vendedor</div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {rankingConsultores.length === 0 ? (
                <div className="empty-state">Nenhuma meta pessoal definida para {periodo}.</div>
              ) : (
                <div className="flex flex-col">
                  {rankingConsultores.map((r, i) => {
                    const cor = metaColor(r.pct)
                    const bateuSuper = r.meta?.valor_super_meta && r.realizado >= r.meta.valor_super_meta
                    return (
                      <div
                        key={r.consultor.id}
                        className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[.9rem] font-bold text-[var(--text-muted)]">{i + 1}º</span>
                          <div>
                            <p className="normal-case text-white">{r.consultor.nome}</p>
                            <p className="text-[.7rem] normal-case text-[var(--text-muted)]">
                              {formatBRL(r.realizado)} / {r.meta ? formatBRL(r.meta.valor_meta) : 'sem meta'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {bateuSuper && <span className="badge badge-aprovado">Super Meta</span>}
                          <span className={`badge ${cor.badgeClass}`}>{r.pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
