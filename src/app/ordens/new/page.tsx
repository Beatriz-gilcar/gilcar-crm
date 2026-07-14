import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { formaPagamentoLabel } from '@/lib/ordens'
import { createOrdem } from '../actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }
type VeiculoOpcao = { id: string; marca: string; modelo: string; placa: string; unidades: { nome: string } | null }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function NewOrdemPage({
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

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'

  let unidades: Unidade[] = []
  if (isGerencia) {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome')
    unidades = data ?? []
  }

  let veiculosQuery = supabase
    .from('veiculos')
    .select('id, marca, modelo, placa, unidades(nome)')
    .eq('status', 'disponivel')
    .order('marca')

  if (!isGerencia && profile?.unidade_id) {
    veiculosQuery = veiculosQuery.eq('unidade_id', profile.unidade_id)
  }

  const { data: veiculosData } = await veiculosQuery.overrideTypes<VeiculoOpcao[]>()
  const veiculos = veiculosData ?? []

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        active="ordens"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createOrdem} className="os-form w-full max-w-2xl flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
              {error}
            </p>
          )}

          <div>
            <div className="sec-header">
              <div className="sec-title">Nova ordem de serviço</div>
            </div>
            <div className="sec-body sec-pad flex flex-col gap-3">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo</label>
                <ToggleGroup
                  name="tipo"
                  defaultValue="venda"
                  options={[
                    { value: 'venda', label: 'Venda' },
                    { value: 'compra', label: 'Compra' },
                  ]}
                />
              </div>

              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Data da venda</label>
                  <input name="data_venda" type="date" defaultValue={hojeISO()} required />
                </div>
                {isGerencia ? (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Unidade</label>
                    <select name="unidade_id" required defaultValue="">
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
                  <input type="hidden" name="unidade_id" value={profile?.unidade_id ?? ''} />
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
                  <input name="cliente_nome" type="text" required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>CPF/CNPJ</label>
                  <input name="cliente_cpf_cnpj" type="text" />
                </div>
              </div>
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>RG</label>
                  <input name="cliente_rg" type="text" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Celular</label>
                  <input name="cliente_celular" type="tel" />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Endereço</label>
                <input name="cliente_endereco" type="text" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>E-mail</label>
                <input name="cliente_email" type="email" />
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
                  defaultValue="estoque"
                  options={[
                    { value: 'estoque', label: 'Do estoque' },
                    { value: 'avulso', label: 'Avulso (fora do estoque)' },
                  ]}
                />
              </div>

              <div className="veiculo-estoque-block form-group" style={{ marginBottom: 0 }}>
                <label>Veículo em estoque</label>
                <select name="veiculo_id" defaultValue="">
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
                    <input name="veiculo_marca_manual" type="text" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Modelo</label>
                    <input name="veiculo_modelo_manual" type="text" />
                  </div>
                </div>
                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Ano</label>
                    <input name="veiculo_ano_manual" type="text" placeholder="2023/2024" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Placa</label>
                    <input name="veiculo_placa_manual" type="text" className="uppercase" />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Cor</label>
                  <input name="veiculo_cor_manual" type="text" />
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
                  <input name="valor_total" type="number" step="0.01" min="0" required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Desconto</label>
                  <input name="desconto" type="number" step="0.01" min="0" defaultValue="0" />
                </div>
              </div>
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Valor financiado</label>
                  <input name="valor_financiado" type="number" step="0.01" min="0" defaultValue="0" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Financeira</label>
                  <input name="financeira" type="text" />
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
                    <input name={`pagamento_${value}`} type="number" step="0.01" min="0" defaultValue="0" />
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
                  defaultValue="nao"
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
                    <input name="troca_marca" type="text" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Modelo</label>
                    <input name="troca_modelo" type="text" />
                  </div>
                </div>
                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Ano</label>
                    <input name="troca_ano" type="text" placeholder="2023/2024" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Placa</label>
                    <input name="troca_placa" type="text" className="uppercase" />
                  </div>
                </div>
                <div className="grid2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Valor avaliado</label>
                    <input name="troca_valor_avaliado" type="number" step="0.01" min="0" defaultValue="0" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Dívida do veículo</label>
                    <input name="troca_divida" type="number" step="0.01" min="0" defaultValue="0" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-red self-start">
            Salvar ordem de serviço
          </button>
        </form>
      </div>
    </>
  )
}
