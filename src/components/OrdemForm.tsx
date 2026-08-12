'use client'

import { useMemo, useState } from 'react'
import {
  maskCpfCnpj,
  maskRgRj,
  maskTelefone,
  maskCep,
  maskMoeda,
  parseBRL,
  formatBRLNumber,
} from '@/lib/mask'
import { formatBRL } from '@/lib/ordens'

type UnidadeOpt = { id: string; nome: string }
type VeiculoOpt = { id: string; label: string }
type FormaOpt = { value: string; label: string }

export type TrocaInit = {
  marca: string
  modelo: string
  ano: string
  placa: string
  cambio: string
  valor_avaliado: string
  divida: string
}

export type OrdemFormDefaults = {
  tipo: string
  data_venda: string
  unidade_id: string
  origem_cliente: string
  numero_venda: string
  revenda: boolean
  over: string
  retorno: string
  cliente_nome: string
  cliente_cpf_cnpj: string
  cliente_rg: string
  cliente_celular: string
  cliente_cep: string
  cliente_numero: string
  cliente_endereco: string
  cliente_email: string
  veiculo_km: string
  observacao: string
  manutencao_itens: string[]
  veiculo_fonte: string
  veiculo_id: string
  veiculo_marca_manual: string
  veiculo_modelo_manual: string
  veiculo_ano_manual: string
  veiculo_placa_manual: string
  veiculo_cor_manual: string
  valor_total: string
  desconto: string
  valor_financiado: string
  financeira: string
  pagamentos: PagamentoInit[]
  trocas: TrocaInit[]
}

export type PagamentoInit = { forma: string; valor: string }

const trocaVazia: TrocaInit = {
  marca: '',
  modelo: '',
  ano: '',
  placa: '',
  cambio: 'manual',
  valor_avaliado: '',
  divida: '',
}

// Pill de duas/três opções, controlada. Substitui o ToggleGroup nos campos que
// controlam o que aparece na tela (tipo, origem do veículo, desconto).
function Pills({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: FormaOpt[]
}) {
  return (
    <div className="chip-row">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-[.75rem] font-bold tracking-wide transition-colors ${
            value === o.value
              ? 'bg-[var(--coral)] text-white'
              : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Campo de moeda: mostra "70.000,00" e mantém a máscara enquanto digita.
function Moeda({
  name,
  value,
  onChange,
}: {
  name?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[.8rem] text-[var(--text-muted)]">R$</span>
      <input
        {...(name ? { name } : {})}
        type="text"
        inputMode="numeric"
        className="flex-1"
        value={value}
        placeholder="0,00"
        onChange={(e) => onChange(maskMoeda(e.target.value))}
      />
    </div>
  )
}

export function OrdemForm({
  action,
  mode,
  ordemId,
  isGerencia,
  unidades,
  unidadeFixa,
  veiculos,
  bancos,
  formasPagamento,
  defaults,
  errorMessage,
}: {
  action: (formData: FormData) => void
  mode: 'new' | 'edit'
  ordemId?: string
  isGerencia: boolean
  unidades: UnidadeOpt[]
  unidadeFixa: string
  veiculos: VeiculoOpt[]
  bancos: string[]
  formasPagamento: FormaOpt[]
  defaults: OrdemFormDefaults
  errorMessage?: string
}) {
  const [tipo, setTipo] = useState(defaults.tipo || 'venda')
  const [fonte, setFonte] = useState(defaults.veiculo_fonte || 'estoque')
  const [temDesconto, setTemDesconto] = useState(parseBRL(defaults.desconto) > 0)

  const [cpf, setCpf] = useState(defaults.cliente_cpf_cnpj)
  const [rg, setRg] = useState(defaults.cliente_rg)
  const [celular, setCelular] = useState(defaults.cliente_celular)
  const [cep, setCep] = useState(defaults.cliente_cep)
  const [endereco, setEndereco] = useState(defaults.cliente_endereco)
  const [cepErro, setCepErro] = useState('')
  const [cepBuscando, setCepBuscando] = useState(false)

  const [valorTotal, setValorTotal] = useState(defaults.valor_total)
  const [desconto, setDesconto] = useState(defaults.desconto)
  const [over, setOver] = useState(defaults.over)
  const [valorFinanciado, setValorFinanciado] = useState(defaults.valor_financiado)

  const [pagamentos, setPagamentos] = useState<PagamentoInit[]>(
    defaults.pagamentos.length ? defaults.pagamentos : [{ forma: '', valor: '' }]
  )
  const [trocas, setTrocas] = useState<TrocaInit[]>(defaults.trocas)
  const [manutencaoItens, setManutencaoItens] = useState<string[]>(
    defaults.manutencao_itens.length ? defaults.manutencao_itens : ['']
  )

  const isVenda = tipo === 'venda'
  const compradorLabel = isVenda ? 'Comprador' : 'Vendedor'

  async function buscarCep() {
    const digitos = cep.replace(/\D/g, '')
    if (digitos.length !== 8) return
    setCepBuscando(true)
    setCepErro('')
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      const data = await resp.json()
      if (data.erro) {
        setCepErro('CEP não encontrado')
        return
      }
      // Monta o endereço a partir do que veio; a pessoa completa o número.
      const partes = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean)
      setEndereco(partes.join(' - '))
    } catch {
      setCepErro('Não foi possível buscar o CEP')
    } finally {
      setCepBuscando(false)
    }
  }

  function setPagamentoForma(i: number, forma: string) {
    setPagamentos((ps) => ps.map((p, idx) => (idx === i ? { ...p, forma } : p)))
  }
  function setPagamentoValor(i: number, valor: string) {
    setPagamentos((ps) => ps.map((p, idx) => (idx === i ? { ...p, valor } : p)))
  }

  function setTroca(i: number, campo: keyof TrocaInit, v: string) {
    setTrocas((ts) => ts.map((t, idx) => (idx === i ? { ...t, [campo]: v } : t)))
  }

  // Cálculo ao vivo do que falta receber, com o mesmo piso em 0 do servidor.
  const faltaReceber = useMemo(() => {
    const total = parseBRL(valorTotal)
    const desc = temDesconto ? parseBRL(desconto) : 0
    const somaPag = pagamentos.reduce((acc, p) => acc + parseBRL(p.valor), 0)
    const somaTrocas = isVenda
      ? trocas.reduce((acc, t) => acc + (parseBRL(t.valor_avaliado) - parseBRL(t.divida)), 0)
      : 0
    const financiado = parseBRL(valorFinanciado)
    return Math.max(0, total - desc - somaPag - somaTrocas - financiado)
  }, [valorTotal, temDesconto, desconto, pagamentos, trocas, valorFinanciado, isVenda])

  // Pagamento e troca viram JSON num campo escondido; o server action faz o parse.
  const pagamentosSubmit = pagamentos.filter((p) => p.forma && parseBRL(p.valor) > 0)
  const trocasSubmit = isVenda ? trocas.filter((t) => t.marca || t.modelo || parseBRL(t.valor_avaliado) > 0) : []
  const manutencaoItensSubmit = manutencaoItens.map((m) => m.trim()).filter(Boolean)

  return (
    <form action={action} className="os-form w-full max-w-2xl flex flex-col gap-4">
      {mode === 'edit' && ordemId && <input type="hidden" name="id" value={ordemId} />}
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="veiculo_fonte" value={fonte} />
      <input type="hidden" name="cliente_endereco" value={endereco} />
      <input type="hidden" name="desconto" value={temDesconto ? desconto : ''} />
      <input type="hidden" name="over" value={isVenda ? over : ''} />
      <input type="hidden" name="tem_troca" value={trocasSubmit.length > 0 ? 'sim' : 'nao'} />
      <input type="hidden" name="pagamentos_json" value={JSON.stringify(pagamentosSubmit)} />
      <input type="hidden" name="trocas_json" value={JSON.stringify(trocasSubmit)} />
      <input type="hidden" name="manutencao_itens_json" value={JSON.stringify(manutencaoItensSubmit)} />

      {errorMessage && (
        <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
          {errorMessage}
        </p>
      )}

      <div>
        <div className="sec-header">
          <div className="sec-title">{mode === 'new' ? 'Nova ordem de serviço' : 'Editar ordem de serviço'}</div>
        </div>
        <div className="sec-body sec-pad flex flex-col gap-3">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Tipo</label>
            <Pills
              value={tipo}
              onChange={setTipo}
              options={[
                { value: 'venda', label: 'Venda' },
                { value: 'compra', label: 'Compra' },
              ]}
            />
          </div>

          {isVenda && (
            <label className="flex items-center gap-2 text-[.78rem] normal-case text-[var(--text-muted)]">
              <input type="checkbox" name="revenda" defaultChecked={defaults.revenda} style={{ width: 'auto' }} />
              Revenda (comissão fixa de R$ 500, em vez do padrão por valor)
            </label>
          )}

          <div className="grid2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Data da venda</label>
              <input name="data_venda" type="date" defaultValue={defaults.data_venda} required />
            </div>
            {isGerencia ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Unidade</label>
                <select name="unidade_id" required defaultValue={defaults.unidade_id}>
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="unidade_id" value={unidadeFixa} />
            )}
          </div>

          <div className="grid3">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Origem do cliente</label>
              <input name="origem_cliente" type="text" defaultValue={defaults.origem_cliente} placeholder="Carteira, Marketplace…" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nº venda</label>
              <input name="numero_venda" type="text" defaultValue={defaults.numero_venda} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Retorno</label>
              <input name="retorno" type="text" defaultValue={defaults.retorno} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="sec-header">
          <div className="sec-title">{compradorLabel}</div>
        </div>
        <div className="sec-body sec-pad flex flex-col gap-3">
          <div className="grid2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nome</label>
              <input name="cliente_nome" type="text" required defaultValue={defaults.cliente_nome} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>CPF/CNPJ</label>
              <input
                name="cliente_cpf_cnpj"
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(maskCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
          </div>
          <div className="grid2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>RG</label>
              <input
                name="cliente_rg"
                type="text"
                inputMode="numeric"
                value={rg}
                onChange={(e) => setRg(maskRgRj(e.target.value))}
                placeholder="00.000.000-0"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Celular</label>
              <input
                name="cliente_celular"
                type="tel"
                inputMode="numeric"
                value={celular}
                onChange={(e) => setCelular(maskTelefone(e.target.value))}
                placeholder="(21) 99999-9999"
              />
            </div>
          </div>
          <div className="grid2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>CEP</label>
              <input
                name="cliente_cep"
                type="text"
                inputMode="numeric"
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                onBlur={buscarCep}
                placeholder="00000-000"
              />
              {cepBuscando && <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">Buscando…</p>}
              {cepErro && <p className="mt-1 text-[.68rem] normal-case text-[var(--red)]">{cepErro}</p>}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>E-mail</label>
              <input name="cliente_email" type="email" defaultValue={defaults.cliente_email} />
            </div>
          </div>
          <div className="grid2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Endereço</label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Preenchido pelo CEP"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Número</label>
              <input name="cliente_numero" type="text" defaultValue={defaults.cliente_numero} />
            </div>
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
            <Pills
              value={fonte}
              onChange={setFonte}
              options={[
                { value: 'estoque', label: 'Do estoque' },
                { value: 'avulso', label: 'Avulso (fora do estoque)' },
              ]}
            />
          </div>

          {fonte === 'estoque' ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Veículo em estoque</label>
              <select name="veiculo_id" defaultValue={defaults.veiculo_id}>
                <option value="" disabled>
                  Selecione...
                </option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Marca</label>
                  <input name="veiculo_marca_manual" type="text" defaultValue={defaults.veiculo_marca_manual} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Modelo</label>
                  <input name="veiculo_modelo_manual" type="text" defaultValue={defaults.veiculo_modelo_manual} />
                </div>
              </div>
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Ano</label>
                  <input name="veiculo_ano_manual" type="text" placeholder="2023/2024" defaultValue={defaults.veiculo_ano_manual} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Placa</label>
                  <input name="veiculo_placa_manual" type="text" className="uppercase" defaultValue={defaults.veiculo_placa_manual} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cor</label>
                <input name="veiculo_cor_manual" type="text" defaultValue={defaults.veiculo_cor_manual} />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>KM</label>
            <input name="veiculo_km" type="text" defaultValue={defaults.veiculo_km} placeholder="Ex.: 41.285" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Observações</label>
            <textarea name="observacao" rows={2} defaultValue={defaults.observacao} />
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
              <Moeda name="valor_total" value={valorTotal} onChange={setValorTotal} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Houve desconto?</label>
              <Pills
                value={temDesconto ? 'sim' : 'nao'}
                onChange={(v) => setTemDesconto(v === 'sim')}
                options={[
                  { value: 'sim', label: 'Sim' },
                  { value: 'nao', label: 'Não' },
                ]}
              />
            </div>
          </div>

          {temDesconto && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Valor do desconto</label>
              <Moeda value={desconto} onChange={setDesconto} />
            </div>
          )}

          {isVenda && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Over (vendeu acima do estipulado)</label>
              <Moeda value={over} onChange={setOver} />
              <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
                Metade desse valor vira comissão extra do consultor quando a venda for aprovada.
              </p>
            </div>
          )}

          <div className="grid2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Valor financiado</label>
              <Moeda name="valor_financiado" value={valorFinanciado} onChange={setValorFinanciado} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Financeira</label>
              <input name="financeira" type="text" list="bancos-list" placeholder="Selecione ou digite" defaultValue={defaults.financeira} />
              <datalist id="bancos-list">
                {bancos.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="sec-header">
          <div className="sec-title">Formas de pagamento</div>
        </div>
        <div className="sec-body sec-pad flex flex-col gap-3">
          <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
            Pode repetir a mesma forma mais de uma vez (ex.: dois PIX de valores diferentes).
          </p>
          {pagamentos.map((p, i) => (
            <div key={i} className="grid2 items-end">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Forma</label>
                <select value={p.forma} onChange={(e) => setPagamentoForma(i, e.target.value)}>
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {formasPagamento.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                  <label>Valor</label>
                  <Moeda value={p.valor} onChange={(v) => setPagamentoValor(i, v)} />
                </div>
                {pagamentos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPagamentos((ps) => ps.filter((_, idx) => idx !== i))}
                    className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                    style={{ marginBottom: 11 }}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPagamentos((ps) => [...ps, { forma: '', valor: '' }])}
            className="btn btn-outline btn-sm self-start"
          >
            + Adicionar forma de pagamento
          </button>
        </div>
      </div>

      {isVenda && (
        <div>
          <div className="sec-header">
            <div className="sec-title">Troca</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-4">
            {trocas.length === 0 && (
              <p className="text-[.78rem] normal-case text-[var(--text-muted)]">Nenhum veículo na troca.</p>
            )}

            {trocas.map((t, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[.72rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Veículo {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTrocas((ts) => ts.filter((_, idx) => idx !== i))}
                    className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                  >
                    Remover
                  </button>
                </div>
                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Marca</label>
                    <input type="text" value={t.marca} onChange={(e) => setTroca(i, 'marca', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Modelo</label>
                    <input type="text" value={t.modelo} onChange={(e) => setTroca(i, 'modelo', e.target.value)} />
                  </div>
                </div>
                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Ano</label>
                    <input type="text" placeholder="2023/2024" value={t.ano} onChange={(e) => setTroca(i, 'ano', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Placa</label>
                    <input type="text" className="uppercase" value={t.placa} onChange={(e) => setTroca(i, 'placa', e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Câmbio</label>
                  <Pills
                    value={t.cambio}
                    onChange={(v) => setTroca(i, 'cambio', v)}
                    options={[
                      { value: 'manual', label: 'Manual' },
                      { value: 'automatico', label: 'Automático' },
                    ]}
                  />
                  <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
                    Esse veículo entra automaticamente no estoque quando a venda for aprovada.
                  </p>
                </div>
                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Valor avaliado</label>
                    <Moeda value={t.valor_avaliado} onChange={(v) => setTroca(i, 'valor_avaliado', v)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Dívida do veículo</label>
                    <Moeda value={t.divida} onChange={(v) => setTroca(i, 'divida', v)} />
                  </div>
                </div>
                <p className="text-[.7rem] normal-case text-[var(--text-muted)]">
                  Abate na troca: R$ {formatBRLNumber(parseBRL(t.valor_avaliado) - parseBRL(t.divida))}
                </p>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setTrocas((ts) => [...ts, { ...trocaVazia }])}
              className="btn btn-outline btn-sm self-start"
            >
              + Adicionar veículo na troca
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="sec-header">
          <div className="sec-title">Manutenção — pós-venda</div>
        </div>
        <div className="sec-body sec-pad flex flex-col gap-2">
          <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
            Um serviço por linha. Cada um vira um item pra Luciana marcar no Pós-venda.
          </p>
          {manutencaoItens.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                placeholder="Ex.: Padrão"
                onChange={(e) =>
                  setManutencaoItens((itens) => itens.map((v, idx) => (idx === i ? e.target.value : v)))
                }
              />
              {manutencaoItens.length > 1 && (
                <button
                  type="button"
                  onClick={() => setManutencaoItens((itens) => itens.filter((_, idx) => idx !== i))}
                  className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setManutencaoItens((itens) => [...itens, ''])}
            className="btn btn-outline btn-sm self-start"
          >
            + Adicionar serviço
          </button>
        </div>
      </div>

      {/* Cálculo ao vivo — mesma fórmula do servidor (piso em 0). */}
      <div className="sec-body sec-pad flex items-center justify-between">
        <span className="text-[.8rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">Falta receber</span>
        <span className="text-[1.3rem] font-extrabold text-white">{formatBRL(faltaReceber)}</span>
      </div>

      <button type="submit" className="btn btn-red self-start">
        Salvar ordem de serviço
      </button>
    </form>
  )
}
