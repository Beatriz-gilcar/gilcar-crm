import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ConfirmButton } from '@/components/ConfirmButton'
import { GerarPdfAssinar } from '@/components/GerarPdfAssinar'
import { OrdemForm, type OrdemFormDefaults, type TrocaInit } from '@/components/OrdemForm'
import { OrdemPreviaInline } from '@/components/OrdemPreviaInline'
import { statusLabel, statusBadgeClass, tipoLabel, formaPagamentoLabel, formatBRL, bancos } from '@/lib/ordens'
import { maskCpfCnpj, maskRgRj, maskTelefone, formatBRLNumber } from '@/lib/mask'
import { dataHoraBR } from '@/lib/datas'
import { updateOrdem, aprovarOrdem, reprovarOrdem, assinarOrdem, deleteOrdem } from '../actions'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura, cargoLabel } from '@/lib/membros'

type OrdemDetail = {
  id: string
  tipo: string
  unidade_id: string
  origem_cliente: string | null
  numero_venda: string | null
  retorno: string | null
  revenda: boolean
  over: number
  cliente_nome: string
  cliente_cpf_cnpj: string | null
  cliente_rg: string | null
  cliente_cep: string | null
  cliente_numero: string | null
  cliente_endereco: string | null
  cliente_celular: string | null
  cliente_email: string | null
  veiculo_id: string | null
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: string | null
  veiculo_placa: string | null
  veiculo_cor: string | null
  veiculo_km: string | null
  manutencao: string | null
  observacao: string | null
  valor_total: number
  desconto: number
  tem_troca: boolean
  troca_marca: string | null
  troca_modelo: string | null
  troca_ano: string | null
  troca_placa: string | null
  troca_valor_avaliado: number | null
  troca_divida: number | null
  troca_valor_liquido: number | null
  valor_financiado: number
  financeira: string | null
  falta_receber: number
  data_venda: string
  data_entrega: string | null
  status: string
  motivo_reprovacao: string | null
  aprovado_em: string | null
  consultor_id: string
  assinatura_gerencia_data_url: string | null
  assinatura_gerencia_nome: string | null
  assinado_em: string | null
  unidades: { nome: string } | null
  vendedor: { nome: string } | null
  aprovador: { nome: string } | null
}

type Pagamento = { forma: string; valor: number }
type TrocaRow = {
  marca: string | null
  modelo: string | null
  ano: string | null
  placa: string | null
  cambio: string | null
  valor_avaliado: number
  divida: number
  valor_liquido: number
}
type ProfileSummary = {
  nome: string
  cargo: string
  unidade_id: string | null
  assina_ordem_servico: boolean | null
}
type Unidade = { id: string; nome: string }
type VeiculoOpcao = { id: string; marca: string; modelo: string; placa: string | null; unidades: { nome: string } | null }

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

// Só formata em R$ quando há valor; 0 vira campo vazio (placeholder "0,00").
function moneyDefault(n: number | null | undefined): string {
  return n && n > 0 ? formatBRLNumber(n) : ''
}

export default async function OrdemDetailPage({
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
    .select('nome, cargo, unidade_id, assina_ordem_servico')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = isGerenciaCargo(profile?.cargo)
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  const { data: ordem } = await supabase
    .from('ordens_servico')
    .select(
      `id, tipo, unidade_id, origem_cliente, numero_venda, retorno, revenda, over,
       cliente_nome, cliente_cpf_cnpj, cliente_rg, cliente_cep, cliente_numero, cliente_endereco, cliente_celular, cliente_email,
       veiculo_id, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, veiculo_cor, veiculo_km, manutencao, observacao,
       valor_total, desconto, tem_troca, troca_marca, troca_modelo, troca_ano, troca_placa,
       troca_valor_avaliado, troca_divida, troca_valor_liquido, valor_financiado, financeira,
       falta_receber, data_venda, data_entrega, status, motivo_reprovacao, aprovado_em, consultor_id,
       assinatura_gerencia_data_url, assinatura_gerencia_nome, assinado_em,
       unidades(nome), vendedor:profiles!ordens_servico_consultor_id_fkey(nome), aprovador:profiles!ordens_servico_aprovado_por_fkey(nome)`
    )
    .eq('id', id)
    .single<OrdemDetail>()

  if (!ordem) {
    notFound()
  }

  // Coerente com a lista: gerente/supervisor só abre ordem da própria unidade;
  // admin/CEO/visualizador abrem qualquer uma. 404 pra não vazar que existe.
  const veTudoUnidades = isAdmin || isSomenteLeitura(profile?.cargo)
  if (!veTudoUnidades && isGerencia && ordem.unidade_id !== profile?.unidade_id) {
    notFound()
  }

  const { data: pagamentosData } = await supabase
    .from('ordens_servico_pagamentos')
    .select('forma, valor')
    .eq('ordem_id', id)
    .overrideTypes<Pagamento[]>()

  const pagamentos = pagamentosData ?? []
  const pagamentosMap = new Map(pagamentos.map((p) => [p.forma, p.valor]))

  const { data: trocasData } = await supabase
    .from('ordens_servico_trocas')
    .select('marca, modelo, ano, placa, cambio, valor_avaliado, divida, valor_liquido')
    .eq('ordem_id', id)
    .order('created_at')
    .overrideTypes<TrocaRow[]>()

  // Trocas para exibir/editar: da tabela nova; se vazia mas a ordem antiga tinha
  // troca única nas colunas legadas, reconstrói um item para não sumir.
  let trocasView: TrocaRow[] = trocasData ?? []
  if (trocasView.length === 0 && ordem.tem_troca && (ordem.troca_valor_avaliado ?? 0) > 0) {
    trocasView = [
      {
        marca: ordem.troca_marca,
        modelo: ordem.troca_modelo,
        ano: ordem.troca_ano,
        placa: ordem.troca_placa,
        cambio: null,
        valor_avaliado: ordem.troca_valor_avaliado ?? 0,
        divida: ordem.troca_divida ?? 0,
        valor_liquido: ordem.troca_valor_liquido ?? 0,
      },
    ]
  }

  const { data: manutencaoItensData } = await supabase
    .from('ordens_servico_manutencao_itens')
    .select('descricao')
    .eq('ordem_id', id)
    .order('posicao')
    .overrideTypes<{ descricao: string }[]>()

  // Itens pra editar: da tabela nova; se vazia mas a ordem antiga tinha o
  // texto corrido na coluna legada, reconstrói um item pra não sumir.
  const manutencaoItens: string[] =
    manutencaoItensData && manutencaoItensData.length > 0
      ? manutencaoItensData.map((m) => m.descricao)
      : ordem.manutencao
        ? [ordem.manutencao]
        : []

  const canEdit = ordem.status === 'pendente' && (isGerencia || ordem.consultor_id === user.id)
  const canApprove = isGerencia && ordem.status === 'pendente'
  // Além do gerente responsável e do admin, quem tem a flag assina_ordem_servico
  // (ex.: José) também assina — só ordens da própria unidade, sem ganhar o
  // resto do acesso de gerência.
  const canSign =
    ordem.status === 'aprovada' &&
    !ordem.assinado_em &&
    (isAdmin ||
      (profile?.cargo === 'gerente' && ordem.unidade_id === profile?.unidade_id) ||
      (profile?.assina_ordem_servico === true && ordem.unidade_id === profile?.unidade_id))
  // Excluir: reprovada (gerente só da própria unidade, admin de qualquer) ou
  // aprovada (só admin — aprovar espalha registros em Pós-venda/Estoque/
  // Comissões, então a exclusão de uma aprovada precisa limpar isso também).
  const canExcluir =
    (ordem.status === 'reprovada' && (isAdmin || (isGerencia && ordem.unidade_id === profile?.unidade_id))) ||
    (ordem.status === 'aprovada' && isAdmin)

  let unidades: Unidade[] = []
  let veiculos: { id: string; label: string }[] = []
  if (canEdit) {
    if (isGerencia) {
      const { data } = await supabase.from('unidades').select('id, nome').order('nome')
      unidades = data ?? []
    }

    let veiculosQuery = supabase
      .from('veiculos')
      .select('id, marca, modelo, placa, unidades(nome)')
      .in('status', ['disponivel'])
      .order('marca')

    if (!isGerencia && profile?.unidade_id) {
      veiculosQuery = veiculosQuery.eq('unidade_id', profile.unidade_id)
    }

    const { data } = await veiculosQuery.overrideTypes<VeiculoOpcao[]>()
    let lista = data ?? []
    if (ordem.veiculo_id && !lista.some((v) => v.id === ordem.veiculo_id)) {
      lista = [
        { id: ordem.veiculo_id, marca: ordem.veiculo_marca, modelo: ordem.veiculo_modelo, placa: ordem.veiculo_placa ?? '', unidades: null },
        ...lista,
      ]
    }
    veiculos = lista.map((v) => ({
      id: v.id,
      label: `${v.marca} ${v.modelo} · ${v.placa ?? 'sem placa'}${v.unidades?.nome ? ` · ${v.unidades.nome}` : ''}`,
    }))
  }

  const defaults: OrdemFormDefaults = {
    tipo: ordem.tipo,
    data_venda: ordem.data_venda,
    unidade_id: ordem.unidade_id,
    origem_cliente: ordem.origem_cliente ?? '',
    numero_venda: ordem.numero_venda ?? '',
    retorno: ordem.retorno ?? '',
    revenda: ordem.revenda,
    over: moneyDefault(ordem.over),
    cliente_nome: ordem.cliente_nome,
    cliente_cpf_cnpj: ordem.cliente_cpf_cnpj ? maskCpfCnpj(ordem.cliente_cpf_cnpj) : '',
    cliente_rg: ordem.cliente_rg ? maskRgRj(ordem.cliente_rg) : '',
    cliente_celular: ordem.cliente_celular ? maskTelefone(ordem.cliente_celular) : '',
    cliente_cep: ordem.cliente_cep ?? '',
    cliente_numero: ordem.cliente_numero ?? '',
    cliente_endereco: ordem.cliente_endereco ?? '',
    cliente_email: ordem.cliente_email ?? '',
    veiculo_km: ordem.veiculo_km ?? '',
    observacao: ordem.observacao ?? '',
    manutencao_itens: manutencaoItens,
    veiculo_fonte: ordem.veiculo_id ? 'estoque' : 'avulso',
    veiculo_id: ordem.veiculo_id ?? '',
    veiculo_marca_manual: ordem.veiculo_id ? '' : ordem.veiculo_marca,
    veiculo_modelo_manual: ordem.veiculo_id ? '' : ordem.veiculo_modelo,
    veiculo_ano_manual: ordem.veiculo_id ? '' : ordem.veiculo_ano ?? '',
    veiculo_placa_manual: ordem.veiculo_id ? '' : ordem.veiculo_placa ?? '',
    veiculo_cor_manual: ordem.veiculo_id ? '' : ordem.veiculo_cor ?? '',
    valor_total: moneyDefault(ordem.valor_total),
    desconto: moneyDefault(ordem.desconto),
    valor_financiado: moneyDefault(ordem.valor_financiado),
    financeira: ordem.financeira ?? '',
    pagamentos: Object.fromEntries(
      Object.keys(formaPagamentoLabel).map((f) => [f, moneyDefault(pagamentosMap.get(f))])
    ),
    trocas: trocasView.map(
      (t): TrocaInit => ({
        marca: t.marca ?? '',
        modelo: t.modelo ?? '',
        ano: t.ano ?? '',
        placa: t.placa ?? '',
        cambio: t.cambio ?? 'manual',
        valor_avaliado: moneyDefault(t.valor_avaliado),
        divida: moneyDefault(t.divida),
      })
    ),
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="ordens"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <Link href="/ordens" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Ordens
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-enviado">{tipoLabel[ordem.tipo]}</span>
            <span className={`badge ${statusBadgeClass[ordem.status]}`}>{statusLabel[ordem.status]}</span>
            <span className="text-[.75rem] text-[var(--text-muted)]">
              {ordem.unidades?.nome} · vendedor {ordem.vendedor?.nome ?? '—'}
            </span>
            {canExcluir && (
              <form action={deleteOrdem} className="ml-auto">
                <input type="hidden" name="id" value={ordem.id} />
                <ConfirmButton
                  className="btn btn-outline btn-sm text-[var(--danger)]"
                  confirmMessage={
                    ordem.status === 'aprovada'
                      ? `Excluir definitivamente a ordem APROVADA de ${ordem.cliente_nome}? Isso também apaga a comissão e o pós-venda gerados por ela.`
                      : `Excluir definitivamente a ordem reprovada de ${ordem.cliente_nome}?`
                  }
                >
                  Excluir ordem
                </ConfirmButton>
              </form>
            )}
          </div>

          {/* Prévia inline no layout do documento (aparece embaixo ao clicar). */}
          <OrdemPreviaInline
            dados={{
              tipo: ordem.tipo,
              origem_cliente: ordem.origem_cliente,
              numero_venda: ordem.numero_venda,
              retorno: ordem.retorno,
              data_venda: ordem.data_venda,
              data_entrega: ordem.data_entrega,
              vendedor_nome: ordem.vendedor?.nome ?? null,
              cliente_nome: ordem.cliente_nome,
              cliente_endereco: ordem.cliente_endereco,
              cliente_numero: ordem.cliente_numero,
              cliente_cep: ordem.cliente_cep,
              cliente_celular: ordem.cliente_celular,
              cliente_cpf_cnpj: ordem.cliente_cpf_cnpj,
              cliente_email: ordem.cliente_email,
              financeira: ordem.financeira,
              valor_financiado: ordem.valor_financiado,
              veiculo_marca: ordem.veiculo_marca,
              veiculo_modelo: ordem.veiculo_modelo,
              veiculo_ano: ordem.veiculo_ano,
              veiculo_cor: ordem.veiculo_cor,
              veiculo_placa: ordem.veiculo_placa,
              veiculo_km: ordem.veiculo_km,
              valor_total: ordem.valor_total,
              observacao: ordem.observacao,
              manutencao: ordem.manutencao,
            }}
            pagamentos={pagamentos}
            trocas={trocasView}
          />

          {error && (
            <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
              {error}
            </p>
          )}

          {ordem.status === 'reprovada' && ordem.motivo_reprovacao && (
            <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
              Reprovada por {ordem.aprovador?.nome ?? '—'}: {ordem.motivo_reprovacao}
            </p>
          )}

          {ordem.status === 'aprovada' && (
            <p className="text-[.75rem] normal-case text-[var(--text-muted)]">
              Aprovada por {ordem.aprovador?.nome ?? '—'} em{' '}
              {ordem.aprovado_em ? dataHoraBR(ordem.aprovado_em) : '—'}
            </p>
          )}

          {ordem.status === 'aprovada' && ordem.assinado_em && (
            <div>
              <div className="sec-header">
                <div className="sec-title">Assinatura da gerência</div>
              </div>
              <div className="sec-body sec-pad flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {ordem.assinatura_gerencia_data_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ordem.assinatura_gerencia_data_url}
                      alt="Assinatura"
                      className="h-14 w-36 rounded-lg bg-white object-contain"
                    />
                  ) : null}
                  <div>
                    <p className="text-[1.05rem] normal-case italic text-white" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                      {ordem.assinatura_gerencia_nome}
                    </p>
                    <p className="text-[.68rem] normal-case text-[var(--text-muted)]">
                      Assinado em {dataHoraBR(ordem.assinado_em)}
                    </p>
                  </div>
                </div>
                <a href={`/ordens/${ordem.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-red btn-sm">
                  Baixar PDF
                </a>
              </div>
            </div>
          )}

          {canSign && (
            <div>
              <div className="sec-header">
                <div className="sec-title">Gerar PDF</div>
              </div>
              <div className="sec-body sec-pad flex flex-col gap-2">
                <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
                  Ao gerar, sua assinatura é registrada automaticamente no documento.
                </p>
                <GerarPdfAssinar
                  ordemId={ordem.id}
                  nome={profile?.nome ?? user.email ?? ''}
                  cargoLabel={cargoLabel[profile?.cargo ?? ''] ?? 'Gerência'}
                  action={assinarOrdem}
                />
              </div>
            </div>
          )}

          {ordem.status === 'aprovada' && !ordem.assinado_em && !canSign && (
            <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
              Aguardando o gerente responsável gerar o PDF (assinatura).
            </p>
          )}

          {canApprove && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
              <form action={aprovarOrdem}>
                <input type="hidden" name="id" value={ordem.id} />
                <ConfirmButton className="btn btn-red btn-sm" confirmMessage="Aprovar esta ordem de serviço?">
                  Aprovar
                </ConfirmButton>
              </form>
              <form action={reprovarOrdem} className="flex flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={ordem.id} />
                <input
                  name="motivo_reprovacao"
                  type="text"
                  placeholder="Motivo da reprovação"
                  required
                  className="min-w-[180px] flex-1"
                />
                <button type="submit" className="btn btn-outline btn-sm">
                  Reprovar
                </button>
              </form>
            </div>
          )}

          {!canEdit ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="sec-header">
                  <div className="sec-title">{ordem.tipo === 'venda' ? 'Comprador' : 'Vendedor'}</div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-1 text-[.82rem] normal-case text-white">
                  <p>{ordem.cliente_nome}</p>
                  {ordem.cliente_cpf_cnpj && <p>CPF/CNPJ: {ordem.cliente_cpf_cnpj}</p>}
                  {ordem.cliente_rg && <p>RG: {ordem.cliente_rg}</p>}
                  {ordem.cliente_celular && <p>Celular: {ordem.cliente_celular}</p>}
                  {ordem.cliente_email && <p>E-mail: {ordem.cliente_email}</p>}
                  {ordem.cliente_endereco && <p>Endereço: {ordem.cliente_endereco}</p>}
                </div>
              </div>

              <div>
                <div className="sec-header">
                  <div className="sec-title">Veículo</div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-1 text-[.82rem] normal-case text-white">
                  <p>
                    {ordem.veiculo_marca} {ordem.veiculo_modelo}
                    {ordem.veiculo_ano ? ` · ${ordem.veiculo_ano}` : ''}
                  </p>
                  {ordem.veiculo_placa && <p>Placa: {ordem.veiculo_placa}</p>}
                  {ordem.veiculo_cor && <p>Cor: {ordem.veiculo_cor}</p>}
                </div>
              </div>

              {trocasView.length > 0 && (
                <div>
                  <div className="sec-header">
                    <div className="sec-title">Troca</div>
                  </div>
                  <div className="sec-body sec-pad flex flex-col gap-3 text-[.82rem] normal-case text-white">
                    {trocasView.map((t, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <p className="font-semibold">
                          {t.marca} {t.modelo}
                          {t.ano ? ` · ${t.ano}` : ''}
                          {t.placa ? ` · ${t.placa}` : ''}
                        </p>
                        <p className="text-[var(--text-muted)]">
                          Avaliado: {formatBRL(t.valor_avaliado)} · Dívida: {formatBRL(t.divida)} · Líquido:{' '}
                          {formatBRL(t.valor_liquido)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="sec-header">
                  <div className="sec-title">Valores</div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-1 text-[.82rem] normal-case text-white">
                  <p>Valor total: {formatBRL(ordem.valor_total)}</p>
                  <p>Desconto: {formatBRL(ordem.desconto)}</p>
                  {ordem.valor_financiado > 0 && (
                    <p>
                      Valor financiado: {formatBRL(ordem.valor_financiado)}
                      {ordem.financeira ? ` (${ordem.financeira})` : ''}
                    </p>
                  )}
                  {pagamentos.length > 0 && (
                    <div className="mt-1">
                      <p className="text-[.7rem] font-bold tracking-wide text-[var(--red)]">Pagamentos</p>
                      {pagamentos.map((p) => (
                        <p key={p.forma}>
                          {formaPagamentoLabel[p.forma]}: {formatBRL(p.valor)}
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[.95rem] font-bold text-white">
                    Falta receber: {formatBRL(ordem.falta_receber)}
                  </p>
                  <p className="mt-1 text-[.72rem] text-[var(--text-muted)]">
                    Venda em {fmtData(ordem.data_venda)} · entrega prevista {fmtData(ordem.data_entrega)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <OrdemForm
              action={updateOrdem}
              mode="edit"
              ordemId={ordem.id}
              isGerencia={isGerencia}
              unidades={unidades}
              unidadeFixa={ordem.unidade_id}
              veiculos={veiculos}
              bancos={bancos}
              formasPagamento={Object.entries(formaPagamentoLabel).map(([value, label]) => ({ value, label }))}
              defaults={defaults}
            />
          )}
        </div>
      </div>
    </>
  )
}
