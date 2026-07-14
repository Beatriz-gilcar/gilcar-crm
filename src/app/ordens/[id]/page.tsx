import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { ConfirmButton } from '@/components/ConfirmButton'
import { statusLabel, statusBadgeClass, tipoLabel, formaPagamentoLabel, formatBRL } from '@/lib/ordens'
import { updateOrdem, aprovarOrdem, reprovarOrdem } from '../actions'

type OrdemDetail = {
  id: string
  tipo: string
  unidade_id: string
  cliente_nome: string
  cliente_cpf_cnpj: string | null
  cliente_rg: string | null
  cliente_endereco: string | null
  cliente_celular: string | null
  cliente_email: string | null
  veiculo_id: string | null
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: string | null
  veiculo_placa: string | null
  veiculo_cor: string | null
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
  unidades: { nome: string } | null
  vendedor: { nome: string } | null
  aprovador: { nome: string } | null
}

type Pagamento = { forma: string; valor: number }
type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }
type VeiculoOpcao = { id: string; marca: string; modelo: string; placa: string; unidades: { nome: string } | null }

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
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
    .select('nome, cargo, unidade_id')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'

  const { data: ordem } = await supabase
    .from('ordens_servico')
    .select(
      `id, tipo, unidade_id, cliente_nome, cliente_cpf_cnpj, cliente_rg, cliente_endereco, cliente_celular, cliente_email,
       veiculo_id, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, veiculo_cor,
       valor_total, desconto, tem_troca, troca_marca, troca_modelo, troca_ano, troca_placa,
       troca_valor_avaliado, troca_divida, troca_valor_liquido, valor_financiado, financeira,
       falta_receber, data_venda, data_entrega, status, motivo_reprovacao, aprovado_em, consultor_id,
       unidades(nome), vendedor:profiles!ordens_servico_consultor_id_fkey(nome), aprovador:profiles!ordens_servico_aprovado_por_fkey(nome)`
    )
    .eq('id', id)
    .single<OrdemDetail>()

  if (!ordem) {
    notFound()
  }

  const { data: pagamentosData } = await supabase
    .from('ordens_servico_pagamentos')
    .select('forma, valor')
    .eq('ordem_id', id)
    .overrideTypes<Pagamento[]>()

  const pagamentos = pagamentosData ?? []
  const pagamentosMap = new Map(pagamentos.map((p) => [p.forma, p.valor]))

  const canEdit = ordem.status === 'pendente' && (isGerencia || ordem.consultor_id === user.id)
  const canApprove = isGerencia && ordem.status === 'pendente'

  let unidades: Unidade[] = []
  let veiculos: VeiculoOpcao[] = []
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
    veiculos = data ?? []
    if (ordem.veiculo_id && !veiculos.some((v) => v.id === ordem.veiculo_id)) {
      veiculos = [
        { id: ordem.veiculo_id, marca: ordem.veiculo_marca, modelo: ordem.veiculo_modelo, placa: ordem.veiculo_placa ?? '', unidades: null },
        ...veiculos,
      ]
    }
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
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
          </div>

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
              {ordem.aprovado_em ? new Date(ordem.aprovado_em).toLocaleString('pt-BR') : '—'}
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
                  <div className="sec-title">
                    {ordem.tipo === 'venda' ? 'Comprador' : 'Vendedor'}
                  </div>
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

              {ordem.tem_troca && (
                <div>
                  <div className="sec-header">
                    <div className="sec-title">Troca</div>
                  </div>
                  <div className="sec-body sec-pad flex flex-col gap-1 text-[.82rem] normal-case text-white">
                    <p>
                      {ordem.troca_marca} {ordem.troca_modelo}
                      {ordem.troca_ano ? ` · ${ordem.troca_ano}` : ''}
                      {ordem.troca_placa ? ` · ${ordem.troca_placa}` : ''}
                    </p>
                    <p>Valor avaliado: {formatBRL(ordem.troca_valor_avaliado ?? 0)}</p>
                    <p>Dívida: {formatBRL(ordem.troca_divida ?? 0)}</p>
                    <p>Valor líquido: {formatBRL(ordem.troca_valor_liquido ?? 0)}</p>
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
            <form action={updateOrdem} className="os-form flex flex-col gap-4">
              <input type="hidden" name="id" value={ordem.id} />

              <div>
                <div className="sec-header">
                  <div className="sec-title">Dados da ordem</div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-3">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Tipo</label>
                    <ToggleGroup
                      name="tipo"
                      defaultValue={ordem.tipo}
                      options={[
                        { value: 'venda', label: 'Venda' },
                        { value: 'compra', label: 'Compra' },
                      ]}
                    />
                  </div>

                  <div className="grid2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Data da venda</label>
                      <input name="data_venda" type="date" defaultValue={ordem.data_venda} required />
                    </div>
                    {isGerencia ? (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Unidade</label>
                        <select name="unidade_id" required defaultValue={ordem.unidade_id}>
                          {unidades.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input type="hidden" name="unidade_id" value={ordem.unidade_id} />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="sec-header">
                  <div className="sec-title">
                    <span className="only-venda-label">Comprador</span>
                    <span className="only-compra-label">Vendedor</span>
                  </div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-3">
                  <div className="grid2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Nome</label>
                      <input name="cliente_nome" type="text" required defaultValue={ordem.cliente_nome} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>CPF/CNPJ</label>
                      <input name="cliente_cpf_cnpj" type="text" defaultValue={ordem.cliente_cpf_cnpj ?? ''} />
                    </div>
                  </div>
                  <div className="grid2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>RG</label>
                      <input name="cliente_rg" type="text" defaultValue={ordem.cliente_rg ?? ''} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Celular</label>
                      <input name="cliente_celular" type="tel" defaultValue={ordem.cliente_celular ?? ''} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Endereço</label>
                    <input name="cliente_endereco" type="text" defaultValue={ordem.cliente_endereco ?? ''} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>E-mail</label>
                    <input name="cliente_email" type="email" defaultValue={ordem.cliente_email ?? ''} />
                  </div>
                </div>
              </div>

              <div>
                <div className="sec-header">
                  <div className="sec-title">Veículo</div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-3">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Origem</label>
                    <ToggleGroup
                      name="veiculo_fonte"
                      defaultValue={ordem.veiculo_id ? 'estoque' : 'avulso'}
                      options={[
                        { value: 'estoque', label: 'Do estoque' },
                        { value: 'avulso', label: 'Avulso (fora do estoque)' },
                      ]}
                    />
                  </div>

                  <div className="veiculo-estoque-block form-group" style={{ marginBottom: 0 }}>
                    <label>Veículo em estoque</label>
                    <select name="veiculo_id" defaultValue={ordem.veiculo_id ?? ''}>
                      <option value="" disabled>
                        Selecione...
                      </option>
                      {veiculos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.marca} {v.modelo} · {v.placa}
                          {v.unidades?.nome ? ` · ${v.unidades.nome}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="veiculo-avulso-block flex flex-col gap-3">
                    <div className="grid2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Marca</label>
                        <input name="veiculo_marca_manual" type="text" defaultValue={ordem.veiculo_id ? '' : ordem.veiculo_marca} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Modelo</label>
                        <input name="veiculo_modelo_manual" type="text" defaultValue={ordem.veiculo_id ? '' : ordem.veiculo_modelo} />
                      </div>
                    </div>
                    <div className="grid2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Ano</label>
                        <input
                          name="veiculo_ano_manual"
                          type="text"
                          placeholder="2023/2024"
                          defaultValue={ordem.veiculo_id ? '' : ordem.veiculo_ano ?? ''}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Placa</label>
                        <input
                          name="veiculo_placa_manual"
                          type="text"
                          className="uppercase"
                          defaultValue={ordem.veiculo_id ? '' : ordem.veiculo_placa ?? ''}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Cor</label>
                      <input
                        name="veiculo_cor_manual"
                        type="text"
                        defaultValue={ordem.veiculo_id ? '' : ordem.veiculo_cor ?? ''}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="sec-header">
                  <div className="sec-title">Valores</div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-3">
                  <div className="grid2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Valor total</label>
                      <input name="valor_total" type="number" step="0.01" min="0" required defaultValue={ordem.valor_total} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Desconto</label>
                      <input name="desconto" type="number" step="0.01" min="0" defaultValue={ordem.desconto} />
                    </div>
                  </div>
                  <div className="grid2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Valor financiado</label>
                      <input name="valor_financiado" type="number" step="0.01" min="0" defaultValue={ordem.valor_financiado} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Financeira</label>
                      <input name="financeira" type="text" defaultValue={ordem.financeira ?? ''} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="sec-header">
                  <div className="sec-title">Formas de pagamento</div>
                </div>
                <div className="sec-body sec-pad">
                  <div className="grid2">
                    {Object.entries(formaPagamentoLabel).map(([value, label]) => (
                      <div key={value} className="form-group" style={{ marginBottom: 0 }}>
                        <label>{label}</label>
                        <input
                          name={`pagamento_${value}`}
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={pagamentosMap.get(value) ?? 0}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="only-venda">
                <div className="sec-header">
                  <div className="sec-title">Troca</div>
                </div>
                <div className="sec-body sec-pad flex flex-col gap-3">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Há veículo na troca?</label>
                    <ToggleGroup
                      name="tem_troca"
                      defaultValue={ordem.tem_troca ? 'sim' : 'nao'}
                      options={[
                        { value: 'sim', label: 'Sim' },
                        { value: 'nao', label: 'Não' },
                      ]}
                    />
                  </div>

                  <div className="troca-detalhe flex flex-col gap-3">
                    <div className="grid2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Marca</label>
                        <input name="troca_marca" type="text" defaultValue={ordem.troca_marca ?? ''} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Modelo</label>
                        <input name="troca_modelo" type="text" defaultValue={ordem.troca_modelo ?? ''} />
                      </div>
                    </div>
                    <div className="grid2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Ano</label>
                        <input name="troca_ano" type="text" placeholder="2023/2024" defaultValue={ordem.troca_ano ?? ''} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Placa</label>
                        <input name="troca_placa" type="text" className="uppercase" defaultValue={ordem.troca_placa ?? ''} />
                      </div>
                    </div>
                    <div className="grid2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Valor avaliado</label>
                        <input
                          name="troca_valor_avaliado"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={ordem.troca_valor_avaliado ?? 0}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Dívida do veículo</label>
                        <input
                          name="troca_divida"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={ordem.troca_divida ?? 0}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-red self-start">
                Salvar
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
