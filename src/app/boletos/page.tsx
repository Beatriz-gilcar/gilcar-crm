import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { ConfirmButton } from '@/components/ConfirmButton'
import { formatBRL } from '@/lib/ordens'
import { podeVerTudo, isFinanceiro } from '@/lib/membros'
import { atualizarVencimentoBoleto, marcarBoletoPago, desmarcarBoletoPago } from './actions'

type Pagamento = {
  id: string
  valor: number
  vencimento: string | null
  pago: boolean
  pago_em: string | null
  ordem_id: string
}

type OrdemResumo = {
  id: string
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  unidades: { nome: string } | null
}

type Boleto = Pagamento & { ordem: OrdemResumo | null }

type ProfileSummary = { nome: string; cargo: string }

type Situacao = 'pendente' | 'atrasado' | 'pago'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatarData(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

const situacaoLabel: Record<Situacao, string> = {
  pendente: 'Pendente',
  atrasado: 'Atrasado',
  pago: 'Pago',
}

const situacaoBadge: Record<Situacao, string> = {
  pendente: 'badge-pendente',
  atrasado: 'badge-rejeitado',
  pago: 'badge-aprovado',
}

export default async function BoletosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>
}) {
  const { status, error } = await searchParams
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
  // Mesma regra da RLS (migration 20260904020000): só quem cuida dos boletos
  // e admin leem/mexem.
  const podeAcessar = isFinanceiro(profile?.cargo) || isAdmin

  if (!podeAcessar) {
    return null
  }

  // Duas consultas separadas em vez de um embed de 3 níveis
  // (pagamentos → ordens_servico → unidades): mesma técnica já usada no
  // filtro de forma de pagamento em /ordens, evita depender de como o
  // PostgREST resolve join aninhado sob RLS.
  const { data: pagamentosData, error: pagamentosError } = await supabase
    .from('ordens_servico_pagamentos')
    .select('id, valor, vencimento, pago, pago_em, ordem_id')
    .eq('forma', 'boleto')
    .overrideTypes<Pagamento[]>()
  const pagamentos = pagamentosData ?? []

  const ordemIds = [...new Set(pagamentos.map((p) => p.ordem_id))]
  let ordensPorId = new Map<string, OrdemResumo>()
  let ordensError = null
  if (ordemIds.length > 0) {
    const { data: ordensData, error } = await supabase
      .from('ordens_servico')
      .select('id, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, unidades(nome)')
      .in('id', ordemIds)
      .overrideTypes<OrdemResumo[]>()
    ordensError = error
    ordensPorId = new Map((ordensData ?? []).map((o) => [o.id, o]))
  }

  const boletos: Boleto[] = pagamentos.map((p) => ({ ...p, ordem: ordensPorId.get(p.ordem_id) ?? null }))
  const erroConsulta = pagamentosError?.message || ordensError?.message || null

  const hoje = hojeISO()
  const comSituacao = boletos.map((b) => ({
    ...b,
    situacao: (b.pago ? 'pago' : b.vencimento && b.vencimento < hoje ? 'atrasado' : 'pendente') as Situacao,
  }))

  const pendentes = comSituacao.filter((b) => b.situacao === 'pendente')
  const atrasados = comSituacao.filter((b) => b.situacao === 'atrasado')
  const pagos = comSituacao.filter((b) => b.situacao === 'pago')

  const situacaoAtiva = status === 'pendente' || status === 'atrasado' || status === 'pago' ? status : ''
  const listaFiltrada =
    situacaoAtiva === 'pendente'
      ? pendentes
      : situacaoAtiva === 'atrasado'
      ? atrasados
      : situacaoAtiva === 'pago'
      ? pagos
      : comSituacao

  // Vencimento mais próximo primeiro; sem vencimento definido fica por último.
  const ordenados = [...listaFiltrada].sort((a, b) => (a.vencimento ?? '9999-99-99').localeCompare(b.vencimento ?? '9999-99-99'))

  const totalAReceber = [...pendentes, ...atrasados].reduce((soma, b) => soma + Number(b.valor), 0)
  const totalAtrasado = atrasados.reduce((soma, b) => soma + Number(b.valor), 0)
  const totalRecebido = pagos.reduce((soma, b) => soma + Number(b.valor), 0)

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="boletos"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">A receber</div>
              <div className="kpi-val">{formatBRL(totalAReceber)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Atrasados</div>
              <div className="kpi-val">{formatBRL(totalAtrasado)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Recebido</div>
              <div className="kpi-val">{formatBRL(totalRecebido)}</div>
            </div>
          </div>

          <div className="mt-6 sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Boletos
          </div>

          {(error || erroConsulta) && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error || erroConsulta}
            </p>
          )}

          <div className="card sec-pad mt-3">
            <form method="get" className="chip-row">
              <ToggleGroup
                name="status"
                defaultValue={situacaoAtiva}
                options={[
                  { value: '', label: `Todos (${comSituacao.length})` },
                  { value: 'pendente', label: `Pendentes (${pendentes.length})` },
                  { value: 'atrasado', label: `Atrasados (${atrasados.length})` },
                  { value: 'pago', label: `Pagos (${pagos.length})` },
                ]}
              />
            </form>
          </div>

          <div className="mt-4">
            {ordenados.length === 0 ? (
              <div className="card empty-state">Nenhum boleto encontrado.</div>
            ) : (
              <div className="sec-body" style={{ padding: 0 }}>
                {ordenados.map((b) => (
                  <details key={b.id} className="border-t border-[var(--border)] px-4 py-3 first:border-t-0">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="normal-case text-white">
                          {b.ordem?.cliente_nome ?? '—'}
                          <span className="ml-2 text-[.68rem] font-normal text-[var(--text-muted)]">
                            {b.ordem?.veiculo_marca} {b.ordem?.veiculo_modelo}
                            {b.ordem?.veiculo_placa ? ` · ${b.ordem.veiculo_placa}` : ''}
                          </span>
                        </p>
                        <p className="text-[.72rem] text-[var(--text-muted)]">
                          {b.ordem?.unidades?.nome ?? '—'}
                          {' · '}
                          Vencimento: {b.vencimento ? formatarData(b.vencimento) : 'não definido'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge ${situacaoBadge[b.situacao]}`}>{situacaoLabel[b.situacao]}</span>
                        <p className="font-bold text-white">{formatBRL(Number(b.valor))}</p>
                      </div>
                    </summary>

                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <form action={atualizarVencimentoBoleto} className="flex items-end gap-2">
                        <input type="hidden" name="id" value={b.id} />
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Vencimento</label>
                          <input type="date" name="vencimento" defaultValue={b.vencimento ?? ''} />
                        </div>
                        <button type="submit" className="btn btn-outline btn-sm">
                          Salvar
                        </button>
                      </form>

                      {b.pago ? (
                        <form action={desmarcarBoletoPago}>
                          <input type="hidden" name="id" value={b.id} />
                          <ConfirmButton
                            className="btn btn-outline btn-sm"
                            confirmMessage={`Marcar o boleto de ${b.ordem?.cliente_nome ?? 'cliente'} como pendente de novo?`}
                          >
                            Marcar como pendente
                          </ConfirmButton>
                        </form>
                      ) : (
                        <form action={marcarBoletoPago}>
                          <input type="hidden" name="id" value={b.id} />
                          <button type="submit" className="btn btn-red btn-sm">
                            Marcar como pago
                          </button>
                        </form>
                      )}

                      {b.pago_em && (
                        <p className="text-[.68rem] text-[var(--text-muted)]">Pago em {formatarData(b.pago_em)}</p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
