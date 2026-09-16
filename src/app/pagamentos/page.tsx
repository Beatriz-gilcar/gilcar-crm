import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { podeVerTudo } from '@/lib/membros'
import { mesAtualISO, mesRange, mesLabel } from '@/lib/metas'
import { formatBRL, formaPagamentoLabel } from '@/lib/ordens'

type ProfileSummary = { nome: string; cargo: string }
type Unidade = { id: string; nome: string }
type OrdemAprovada = {
  id: string
  unidade_id: string
  financeira: string | null
  valor_financiado: number
}
type Pagamento = { ordem_id: string; forma: string; valor: number }

type Grupo = { nome: string; total: number; qtd: number }

function ListaRanking({ titulo, itens, vazio }: { titulo: string; itens: Grupo[]; vazio: string }) {
  return (
    <div className="mt-4">
      <div className="sec-header">
        <div className="sec-title">{titulo}</div>
      </div>
      <div className="sec-body" style={{ padding: 0 }}>
        {itens.length === 0 ? (
          <div className="empty-state">{vazio}</div>
        ) : (
          itens.map((g, i) => (
            <div
              key={g.nome}
              className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 first:border-t-0"
            >
              <p className="normal-case text-white">
                <span className="mr-2 text-[.7rem] font-bold text-[var(--text-muted)]">#{i + 1}</span>
                {g.nome}{' '}
                <span className="text-[.7rem] text-[var(--text-muted)]">
                  ({g.qtd} {g.qtd === 1 ? 'pagamento' : 'pagamentos'})
                </span>
              </p>
              <p className="font-bold text-white">{formatBRL(g.total)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade_id?: string }>
}) {
  const { mes: mesParam, unidade_id } = await searchParams
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
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isAdmin = profile?.cargo === 'admin'
  if (!isAdmin) {
    redirect('/')
  }

  const verTudo = podeVerTudo(profile.cargo)
  const { inicio, fim } = mesRange(mes)

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  // Duas consultas separadas em vez de embed de 2 níveis (ordens_servico →
  // pagamentos) — mesma técnica de /boletos, evita depender de como o
  // PostgREST resolve join aninhado sob RLS.
  let ordensQuery = supabase
    .from('ordens_servico')
    .select('id, unidade_id, financeira, valor_financiado')
    .eq('status', 'aprovada')
    .gte('data_venda', inicio)
    .lt('data_venda', fim)
  if (unidade_id) ordensQuery = ordensQuery.eq('unidade_id', unidade_id)

  const { data: ordensData } = await ordensQuery.overrideTypes<OrdemAprovada[]>()
  const ordens = ordensData ?? []
  const ordemIds = ordens.map((o) => o.id)

  let pagamentos: Pagamento[] = []
  if (ordemIds.length > 0) {
    const { data: pagamentosData } = await supabase
      .from('ordens_servico_pagamentos')
      .select('ordem_id, forma, valor')
      .in('ordem_id', ordemIds)
      .overrideTypes<Pagamento[]>()
    pagamentos = pagamentosData ?? []
  }

  const porForma = new Map<string, Grupo>()
  for (const p of pagamentos) {
    const atual = porForma.get(p.forma) ?? { nome: formaPagamentoLabel[p.forma] ?? p.forma, total: 0, qtd: 0 }
    atual.total += Number(p.valor)
    atual.qtd += 1
    porForma.set(p.forma, atual)
  }
  const formasRanking = [...porForma.values()].sort((a, b) => b.total - a.total)

  const porBanco = new Map<string, Grupo>()
  for (const o of ordens) {
    if (!o.financeira || Number(o.valor_financiado) <= 0) continue
    const chave = o.financeira.trim().toLowerCase()
    const atual = porBanco.get(chave) ?? { nome: o.financeira.trim(), total: 0, qtd: 0 }
    atual.total += Number(o.valor_financiado)
    atual.qtd += 1
    porBanco.set(chave, atual)
  }
  const bancosRanking = [...porBanco.values()].sort((a, b) => b.total - a.total)

  const totalRecebido = pagamentos.reduce((a, p) => a + Number(p.valor), 0)
  const totalFinanciado = bancosRanking.reduce((a, b) => a + b.total, 0)

  return (
    <>
      <Topbar
        nome={profile.nome ?? user.email ?? ''}
        cargo={profile.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="pagamentos"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Pagamentos
          </div>
          <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">{mesLabel(mes)}</p>

          <div className="card sec-pad mt-3">
            <form method="get" className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input name="mes" type="month" defaultValue={mes} />
                <button type="submit" className="btn btn-outline btn-sm">
                  Ver
                </button>
              </div>
              <div className="chip-row">
                <ToggleGroup
                  name="unidade_id"
                  defaultValue={unidade_id ?? ''}
                  options={[{ value: '', label: 'Todas as unidades' }, ...unidades.map((u) => ({ value: u.id, label: u.nome }))]}
                />
              </div>
            </form>
          </div>

          <div className="kpi-grid mt-4">
            <div className="kpi-card">
              <div className="kpi-label">Total recebido</div>
              <div className="kpi-val">{formatBRL(totalRecebido)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total financiado</div>
              <div className="kpi-val">{formatBRL(totalFinanciado)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Pagamentos</div>
              <div className="kpi-val">{pagamentos.length}</div>
            </div>
          </div>

          <ListaRanking
            titulo="Por forma de pagamento"
            itens={formasRanking}
            vazio={`Nenhum pagamento em ${mesLabel(mes)}.`}
          />

          <ListaRanking
            titulo="Bancos/financeiras (ranking)"
            itens={bancosRanking}
            vazio="Nenhuma venda financiada nesse período."
          />

          <p className="mt-3 text-[.7rem] normal-case text-[var(--text-muted)]">
            Considera só ordens de serviço aprovadas, pela data da venda. "Bancos" é a Financeira lançada na venda
            (só existe quando tem parte financiada) — não é o banco de cada PIX/cartão/boleto individual.
          </p>
        </div>
      </div>
    </>
  )
}
