import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { MetaWidget } from '@/components/MetaWidget'
import { ConfirmButton } from '@/components/ConfirmButton'
import { formatBRL } from '@/lib/ordens'
import { statusLabel, statusBadgeClass, mesAtualISO, mesRange } from '@/lib/metas'
import { toggleVendaStatus, deleteVenda } from './actions'

type Venda = {
  id: string
  numero_sequencial: number
  consultor_id: string
  unidade_id: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  valor: number
  data: string
  status: string
  profiles: { nome: string } | null
  unidades: { nome: string } | null
}

type Meta = { escopo: string; unidade_id: string | null; consultor_id: string | null; valor_meta: number }
type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string }>
}) {
  const { mes: mesParam, error } = await searchParams
  const mes = mesParam || mesAtualISO()
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

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const isAdmin = profile?.cargo === 'admin'

  const { inicio, fim } = mesRange(mes)

  const { data: vendasData } = await supabase
    .from('vendas')
    .select(
      'id, numero_sequencial, consultor_id, unidade_id, veiculo_marca, veiculo_modelo, veiculo_placa, valor, data, status, profiles(nome), unidades(nome)'
    )
    .gte('data', inicio)
    .lt('data', fim)
    .order('numero_sequencial', { ascending: false })
    .overrideTypes<Venda[]>()

  const vendas = vendasData ?? []

  const { data: metasData } = await supabase
    .from('metas')
    .select('escopo, unidade_id, consultor_id, valor_meta')
    .eq('tipo', 'vendas')
    .eq('periodo', mes)
    .overrideTypes<Meta[]>()

  const metas = metasData ?? []
  const metaEmpresa = metas.find((m) => m.escopo === 'empresa')?.valor_meta ?? 0
  const metaPorUnidade = new Map(
    metas.filter((m) => m.escopo === 'unidade').map((m) => [m.unidade_id, m.valor_meta])
  )
  const metaConsultor = metas.find((m) => m.escopo === 'consultor' && m.consultor_id === user.id)?.valor_meta ?? 0

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  const realizadoTotal = vendas.length
  const realizadoPorUnidade = new Map<string, number>()
  for (const v of vendas) {
    realizadoPorUnidade.set(v.unidade_id, (realizadoPorUnidade.get(v.unidade_id) ?? 0) + 1)
  }
  const realizadoConsultor = vendas.filter((v) => v.consultor_id === user.id).length

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="metas"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Corrida da Meta
            </div>
            <div className="flex flex-wrap gap-2">
              <form method="get" className="flex items-center gap-2">
                <input name="mes" type="month" defaultValue={mes} />
                <button type="submit" className="btn btn-outline btn-sm">
                  Ver
                </button>
              </form>
              <Link href="/metas/protecao" className="btn btn-outline btn-sm">
                Proteção
              </Link>
              {isAdmin && (
                <Link href="/metas/definir" className="btn btn-outline btn-sm">
                  Definir metas
                </Link>
              )}
              <Link href="/metas/new" className="btn btn-red btn-sm">
                + Lançar venda
              </Link>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-4">
            {isGerencia ? (
              <>
                <MetaWidget
                  titulo="Empresa"
                  subtitulo={mes}
                  realizadoLabel={`${realizadoTotal} vendas`}
                  metaLabel={`${metaEmpresa} vendas`}
                  pct={metaEmpresa > 0 ? (realizadoTotal / metaEmpresa) * 100 : 0}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {unidades.map((u) => {
                    const realizado = realizadoPorUnidade.get(u.id) ?? 0
                    const meta = metaPorUnidade.get(u.id) ?? 0
                    return (
                      <MetaWidget
                        key={u.id}
                        titulo={u.nome}
                        realizadoLabel={`${realizado} vendas`}
                        metaLabel={`${meta} vendas`}
                        pct={meta > 0 ? (realizado / meta) * 100 : 0}
                      />
                    )
                  })}
                </div>
              </>
            ) : (
              <MetaWidget
                titulo="Minha Meta"
                subtitulo={mes}
                realizadoLabel={`${realizadoConsultor} vendas`}
                metaLabel={`${metaConsultor} vendas`}
                pct={metaConsultor > 0 ? (realizadoConsultor / metaConsultor) * 100 : 0}
              />
            )}
          </div>

          <div className="sec-body mt-6" style={{ padding: 0 }}>
            {vendas.length === 0 ? (
              <div className="empty-state">Nenhuma venda lançada em {mes}.</div>
            ) : (
              <div className="flex flex-col">
                {vendas.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                  >
                    <div>
                      <p className="normal-case text-white">
                        <span className="mr-2 text-[.68rem] text-[var(--text-muted)]">
                          #{v.numero_sequencial}
                        </span>
                        {v.veiculo_marca} {v.veiculo_modelo}
                        {v.veiculo_placa ? ` · ${v.veiculo_placa}` : ''}
                      </p>
                      <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
                        {v.profiles?.nome ?? '—'} · {v.unidades?.nome ?? '—'} ·{' '}
                        {new Date(`${v.data}T12:00:00`).toLocaleDateString('pt-BR')} · {formatBRL(v.valor)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge ${statusBadgeClass[v.status]}`}>{statusLabel[v.status]}</span>
                      <form action={toggleVendaStatus}>
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="status_atual" value={v.status} />
                        <button type="submit" className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white">
                          {v.status === 'ativa' ? 'Marcar caída' : 'Reativar'}
                        </button>
                      </form>
                      {isGerencia && (
                        <form action={deleteVenda}>
                          <input type="hidden" name="id" value={v.id} />
                          <ConfirmButton
                            className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                            confirmMessage={`Excluir a venda #${v.numero_sequencial} definitivamente? Use só pra corrigir erro de digitação.`}
                          >
                            Excluir
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
