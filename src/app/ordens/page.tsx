import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { tipoLabel, statusLabel, statusBadgeClass, formaPagamentoLabel, formatBRL } from '@/lib/ordens'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura } from '@/lib/membros'

type Ordem = {
  id: string
  tipo: string
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  data_venda: string
  status: string
  falta_receber: number
  unidades: { nome: string } | null
  vendedor: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Vendedor = { id: string; nome: string }

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<{
    busca?: string
    data_de?: string
    data_ate?: string
    vendedor_id?: string
    status?: string
    forma_pagamento?: string
  }>
}) {
  const { busca, data_de, data_ate, vendedor_id, status, forma_pagamento } = await searchParams
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
  // Gerente/supervisor vê só as ordens da própria unidade; admin/CEO/visualizador
  // veem todas. O RLS deixa a gerência ver tudo, então o corte é aqui.
  const veTudoUnidades = isAdmin || isSomenteLeitura(profile?.cargo)
  const unidadeGerente = !veTudoUnidades && isGerencia ? profile?.unidade_id ?? null : null

  let vendedores: Vendedor[] = []
  if (isGerencia) {
    let vendQuery = supabase.from('profiles').select('id, nome').order('nome')
    if (unidadeGerente) vendQuery = vendQuery.eq('unidade_id', unidadeGerente)
    const { data } = await vendQuery
    vendedores = data ?? []
  }

  // Filtro por forma de pagamento: só admin, e o dado mora numa tabela filha
  // (uma venda pode ter mais de uma forma, ex.: parte PIX + parte boleto), então
  // busca os ids das ordens com essa forma antes e filtra a lista por `id in (...)`.
  // Um uuid inexistente no lugar de array vazio evita `.in('id', [])`, que o
  // PostgREST não aceita.
  const filtrarPorForma = isAdmin && !!forma_pagamento
  let idsComForma: string[] = ['00000000-0000-0000-0000-000000000000']
  if (filtrarPorForma) {
    const { data: pagamentosData } = await supabase
      .from('ordens_servico_pagamentos')
      .select('ordem_id')
      .eq('forma', forma_pagamento)
    const ids = Array.from(new Set((pagamentosData ?? []).map((p) => p.ordem_id)))
    if (ids.length > 0) idsComForma = ids
  }

  let query = supabase
    .from('ordens_servico')
    .select(
      'id, tipo, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, data_venda, status, falta_receber, unidades(nome), vendedor:profiles!ordens_servico_consultor_id_fkey(nome)'
    )
    .order('data_venda', { ascending: false })

  if (unidadeGerente) query = query.eq('unidade_id', unidadeGerente)
  if (status) query = query.eq('status', status)
  if (data_de) query = query.gte('data_venda', data_de)
  if (data_ate) query = query.lte('data_venda', data_ate)
  if (isGerencia && vendedor_id) query = query.eq('consultor_id', vendedor_id)
  if (filtrarPorForma) query = query.in('id', idsComForma)
  if (busca) {
    const termo = `%${busca}%`
    query = query.or(`cliente_nome.ilike.${termo},veiculo_marca.ilike.${termo},veiculo_modelo.ilike.${termo},veiculo_placa.ilike.${termo}`)
  }

  const { data: ordensData } = await query.overrideTypes<Ordem[]>()
  const ordens = ordensData ?? []

  // KPIs no mesmo escopo da lista: gerente conta só a própria unidade, e os
  // mesmos filtros de busca/data/vendedor da lista valem aqui também — senão
  // o total parece incluir meses que já foram filtrados fora da lista.
  let totalQuery = supabase.from('ordens_servico').select('*', { count: 'exact', head: true })
  const pendentesQuery = supabase
    .from('ordens_servico')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente')
  const valoresQuery = supabase.from('ordens_servico').select('falta_receber').eq('status', 'pendente')
  for (const q of [totalQuery, pendentesQuery, valoresQuery]) {
    if (unidadeGerente) q.eq('unidade_id', unidadeGerente)
    if (data_de) q.gte('data_venda', data_de)
    if (data_ate) q.lte('data_venda', data_ate)
    if (isGerencia && vendedor_id) q.eq('consultor_id', vendedor_id)
    if (filtrarPorForma) q.in('id', idsComForma)
    if (busca) {
      const termo = `%${busca}%`
      q.or(`cliente_nome.ilike.${termo},veiculo_marca.ilike.${termo},veiculo_modelo.ilike.${termo},veiculo_placa.ilike.${termo}`)
    }
  }
  if (status) totalQuery = totalQuery.eq('status', status)
  const [{ count: total }, { count: pendentes }, { data: pendentesValores }] = await Promise.all([
    totalQuery,
    pendentesQuery,
    valoresQuery,
  ])
  const faltaReceberPendente = (pendentesValores ?? []).reduce(
    (acc, o) => acc + (o.falta_receber ?? 0),
    0
  )

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="ordens"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Total de ordens</div>
              <div className="kpi-val">{total ?? 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Pendentes de aprovação</div>
              <div className="kpi-val">{pendentes ?? 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Falta receber (pendentes)</div>
              <div className="kpi-val">{formatBRL(faltaReceberPendente)}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Ordens Salvas
            </div>
            <Link href="/ordens/new" className="btn btn-red btn-sm">
              + Nova Ordem
            </Link>
          </div>
          <div className="card sec-pad mt-3">
            <form className="flex flex-col gap-3" method="get">
              <div className="filtros">
                <div className="search-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input name="busca" type="text" placeholder="Comprador, veículo ou placa" defaultValue={busca ?? ''} />
                </div>
                <input name="data_de" type="date" defaultValue={data_de ?? ''} title="De" />
                <input name="data_ate" type="date" defaultValue={data_ate ?? ''} title="Até" />
                {isGerencia && (
                  <select name="vendedor_id" defaultValue={vendedor_id ?? ''}>
                    <option value="">Todos vendedores</option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nome}
                      </option>
                    ))}
                  </select>
                )}
                <button type="submit" className="btn btn-outline btn-sm">
                  Filtrar
                </button>
              </div>
              <div className="chip-row">
                <ToggleGroup
                  name="status"
                  defaultValue={status ?? ''}
                  options={[
                    { value: '', label: 'Todos status' },
                    ...Object.entries(statusLabel).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
              {isAdmin && (
                <div className="chip-row">
                  <ToggleGroup
                    name="forma_pagamento"
                    defaultValue={forma_pagamento ?? ''}
                    options={[
                      { value: '', label: 'Todas formas de pagamento' },
                      ...Object.entries(formaPagamentoLabel).map(([value, label]) => ({ value, label })),
                    ]}
                  />
                </div>
              )}
            </form>
          </div>
          <div className="sec-body mt-4" style={{ padding: 0 }}>
            {ordens.length === 0 ? (
              <div className="empty-state">Nenhuma ordem de serviço encontrada.</div>
            ) : (
              <div className="flex flex-col">
                {ordens.map((ordem) => (
                  <Link
                    key={ordem.id}
                    href={`/ordens/${ordem.id}`}
                    className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-white/[.03]"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {ordem.cliente_nome}
                        <span className="ml-2 text-[.68rem] font-normal text-[var(--text-muted)]">
                          {tipoLabel[ordem.tipo]}
                        </span>
                      </p>
                      <p className="text-[.72rem] text-[var(--text-muted)]">
                        {ordem.veiculo_marca} {ordem.veiculo_modelo}
                        {ordem.veiculo_placa ? ` · ${ordem.veiculo_placa}` : ''}
                        {' · '}
                        {ordem.unidades?.nome ?? '—'}
                        {ordem.vendedor?.nome ? ` · ${ordem.vendedor.nome}` : ''}
                        {' · '}
                        {new Date(`${ordem.data_venda}T12:00:00`).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`badge ${statusBadgeClass[ordem.status]}`}>
                        {statusLabel[ordem.status]}
                      </span>
                      <span className="text-[.72rem] text-[var(--text-muted)]">
                        Falta: {formatBRL(ordem.falta_receber)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
