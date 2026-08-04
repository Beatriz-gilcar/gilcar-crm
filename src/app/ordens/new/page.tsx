import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { OrdemForm, type OrdemFormDefaults } from '@/components/OrdemForm'
import { formaPagamentoLabel, bancos } from '@/lib/ordens'
import { maskTelefone } from '@/lib/mask'
import { createOrdem } from '../actions'
import { isGerenciaCargo, podeVerTudo } from '@/lib/membros'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }
type VeiculoOpcao = { id: string; marca: string; modelo: string; placa: string | null; unidades: { nome: string } | null }

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function NewOrdemPage({
  searchParams,
}: {
  // cliente/celular/veiculo vêm do botão "Virou venda" da Ficha, que empurra
  // os dados do atendimento pra cá.
  searchParams: Promise<{
    error?: string
    cliente?: string
    celular?: string
    veiculo?: string
  }>
}) {
  const { error, cliente, celular, veiculo } = await searchParams
  const supabase = await createClient()

  const veioDeAtendimento = Boolean(cliente || celular || veiculo)

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
  const veiculos = (veiculosData ?? []).map((v) => ({
    id: v.id,
    label: `${v.marca} ${v.modelo} · ${v.placa ?? 'sem placa'}${v.unidades?.nome ? ` · ${v.unidades.nome}` : ''}`,
  }))

  const pagamentosVazios = Object.fromEntries(Object.keys(formaPagamentoLabel).map((f) => [f, '']))

  const defaults: OrdemFormDefaults = {
    tipo: 'venda',
    data_venda: hojeISO(),
    unidade_id: '',
    origem_cliente: '',
    numero_venda: '',
    revenda: false,
    retorno: '',
    cliente_nome: cliente ?? '',
    cliente_cpf_cnpj: '',
    cliente_rg: '',
    cliente_celular: celular ? maskTelefone(celular) : '',
    cliente_cep: '',
    cliente_numero: '',
    cliente_endereco: '',
    cliente_email: '',
    veiculo_km: '',
    observacao: '',
    manutencao_itens: [],
    veiculo_fonte: veioDeAtendimento ? 'avulso' : 'estoque',
    veiculo_id: '',
    veiculo_marca_manual: '',
    veiculo_modelo_manual: veiculo ?? '',
    veiculo_ano_manual: '',
    veiculo_placa_manual: '',
    veiculo_cor_manual: '',
    valor_total: '',
    desconto: '',
    valor_financiado: '',
    financeira: '',
    pagamentos: pagamentosVazios,
    trocas: [],
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
        <OrdemForm
          action={createOrdem}
          mode="new"
          isGerencia={isGerencia}
          unidades={unidades}
          unidadeFixa={profile?.unidade_id ?? ''}
          veiculos={veiculos}
          bancos={bancos}
          formasPagamento={Object.entries(formaPagamentoLabel).map(([value, label]) => ({ value, label }))}
          defaults={defaults}
          errorMessage={error}
        />
      </div>
    </>
  )
}
