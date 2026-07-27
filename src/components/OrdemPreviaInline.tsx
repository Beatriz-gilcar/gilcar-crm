'use client'

import { useState } from 'react'
import { formaPagamentoLabel, formatBRL } from '@/lib/ordens'
import { GILCAR_LOGO } from '@/lib/logo'

export type PreviaTroca = {
  marca: string | null
  modelo: string | null
  ano: string | null
  placa: string | null
  valor_avaliado: number
  divida: number
  valor_liquido: number
}

export type PreviaData = {
  tipo: string
  origem_cliente: string | null
  numero_venda: string | null
  retorno: string | null
  data_venda: string
  data_entrega: string | null
  vendedor_nome: string | null
  cliente_nome: string
  cliente_endereco: string | null
  cliente_numero: string | null
  cliente_cep: string | null
  cliente_celular: string | null
  cliente_cpf_cnpj: string | null
  cliente_email: string | null
  financeira: string | null
  valor_financiado: number
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: string | null
  veiculo_cor: string | null
  veiculo_placa: string | null
  veiculo_km: string | null
  valor_total: number
  observacao: string | null
  manutencao: string | null
}

function fmtData(iso: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

// Campo do documento: rótulo pequeno em cima, valor sobre uma linha.
function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[.6rem] font-bold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="truncate border-b border-neutral-300 pb-1 pt-0.5 text-[.85rem] text-neutral-900">
        {value || '—'}
      </div>
    </div>
  )
}

function Secao({ titulo }: { titulo: string }) {
  return <h3 className="my-3 text-center text-[.8rem] font-extrabold uppercase tracking-[.2em] text-neutral-900">{titulo}</h3>
}

export function OrdemPreviaInline({
  dados,
  pagamentos,
  trocas,
}: {
  dados: PreviaData
  pagamentos: { forma: string; valor: number }[]
  trocas: PreviaTroca[]
}) {
  const [aberto, setAberto] = useState(false)
  const isVenda = dados.tipo === 'venda'

  const formaPagamento = [
    ...pagamentos.map((p) => `${formaPagamentoLabel[p.forma] ?? p.forma}: ${formatBRL(p.valor)}`),
    ...(dados.valor_financiado > 0
      ? [`Financiado: ${formatBRL(dados.valor_financiado)}${dados.financeira ? ` (${dados.financeira})` : ''}`]
      : []),
    ...trocas.map(
      (t, i) => `Troca ${i + 1}: ${[t.marca, t.modelo].filter(Boolean).join(' ')} (líq. ${formatBRL(t.valor_liquido)})`
    ),
  ].join('  ·  ')

  return (
    <div>
      <button type="button" onClick={() => setAberto((v) => !v)} className="btn btn-outline btn-sm">
        {aberto ? 'Ocultar prévia' : 'Ver prévia'}
      </button>

      {aberto && (
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-300 bg-white text-neutral-900 shadow-sm">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-4 border-b-2 border-[var(--coral)] px-6 py-4">
            <div className="flex items-center justify-center rounded-lg bg-neutral-900 px-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GILCAR_LOGO} alt="Gilcar" style={{ height: 26 }} />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              <Campo label="Origem do cliente" value={dados.origem_cliente} />
              <Campo label="Nº venda" value={dados.numero_venda} />
              <Campo label="Retorno" value={dados.retorno} />
              <Campo label="Data venda" value={fmtData(dados.data_venda)} />
              <Campo label="Data entrega" value={fmtData(dados.data_entrega)} />
            </div>
          </div>

          <div className="px-6 py-4">
            <Secao titulo="Pedido" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Campo label={isVenda ? 'Vendedor' : 'Comprador'} value={dados.vendedor_nome} />
              </div>
              <div className="sm:col-span-3">
                <Campo label={isVenda ? 'Comprador' : 'Vendedor'} value={dados.cliente_nome} />
              </div>
              <div className="sm:col-span-2">
                <Campo label="Endereço" value={dados.cliente_endereco} />
              </div>
              <Campo label="Número" value={dados.cliente_numero} />
              <Campo label="CEP" value={dados.cliente_cep} />
              <Campo label="Alienado a" value={dados.financeira} />
              <Campo label="Valor financiado" value={dados.valor_financiado > 0 ? formatBRL(dados.valor_financiado) : '—'} />
              <Campo label="Celular" value={dados.cliente_celular} />
              <Campo label="CPF" value={dados.cliente_cpf_cnpj} />
              <Campo label="E-mail" value={dados.cliente_email} />
            </div>

            <Secao titulo="Dados do Veículo" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Campo label="Marca" value={dados.veiculo_marca} />
              <Campo label="Modelo" value={dados.veiculo_modelo} />
              <Campo label="Ano" value={dados.veiculo_ano} />
              <Campo label="Cor" value={dados.veiculo_cor} />
              <Campo label="Placa" value={dados.veiculo_placa} />
              <Campo label="KM" value={dados.veiculo_km} />
              <div className="sm:col-span-3">
                <Campo label="Valor do veículo" value={formatBRL(dados.valor_total)} />
              </div>
              <div className="sm:col-span-3">
                <Campo label="Forma de pagamento" value={formaPagamento} />
              </div>
              <div className="sm:col-span-3">
                <Campo label="Observações" value={dados.observacao} />
              </div>
            </div>

            {/* Assinaturas */}
            <div className="mt-8 grid grid-cols-2 gap-8">
              <div className="border-t border-neutral-400 pt-1 text-center text-[.62rem] uppercase tracking-wide text-neutral-600">
                Ass. Gerência ___/___/___
              </div>
              <div className="border-t border-neutral-400 pt-1 text-center text-[.62rem] uppercase tracking-wide text-neutral-600">
                Ass. Direção ___/___/___
              </div>
            </div>

            {/* Manutenção — pós-venda */}
            <div className="my-4 border-t border-dashed border-neutral-400" />
            <Secao titulo="✂ Manutenção — Pós-venda" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Campo label="Carro" value={dados.veiculo_marca} />
              <Campo label="Modelo" value={dados.veiculo_modelo} />
              <Campo label="Ano" value={dados.veiculo_ano} />
              <Campo label="Placa" value={dados.veiculo_placa} />
              <Campo label="Cor" value={dados.veiculo_cor} />
              <Campo label="KM" value={dados.veiculo_km} />
              <Campo label="Data da venda" value={fmtData(dados.data_venda)} />
              <Campo label="Data da entrega" value={fmtData(dados.data_entrega)} />
              <div className="sm:col-span-3">
                <Campo label="Manutenção" value={dados.manutencao} />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8">
              <div className="border-t border-neutral-400 pt-1 text-center text-[.62rem] uppercase tracking-wide text-neutral-600">
                Ass. Gerência / Supervisor ___/___/___
              </div>
              <div className="border-t border-neutral-400 pt-1 text-center text-[.62rem] uppercase tracking-wide text-neutral-600">
                Ass. Consultor ___/___/___
              </div>
            </div>

            <p className="mt-6 text-center text-[.66rem] italic text-neutral-500">
              &quot;TUDO O QUE FIZERES, FAÇAM DE TODO O CORAÇÃO, COMO PARA O SENHOR, E NÃO PARA OS HOMENS&quot;
              <br />
              COLOSSENSES 3:23
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
