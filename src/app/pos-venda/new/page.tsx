import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { podeVerTudo, podeEditarPosVenda } from '@/lib/membros'
import { posVendaStatusLabel } from '@/lib/pos_venda'
import { createPosVenda } from '../actions'

type ProfileSummary = { nome: string; cargo: string }
type VendaOpcao = {
  id: string
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
}

export default async function NewPosVendaPage({
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
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  // Só quem edita cria registro; consultor cai de volta na lista.
  if (!podeEditarPosVenda(profile?.cargo)) {
    redirect('/pos-venda')
  }

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  const { data: vendasData } = await supabase
    .from('ordens_servico')
    .select('id, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa')
    .eq('tipo', 'venda')
    .eq('status', 'aprovada')
    .order('data_venda', { ascending: false })
    .overrideTypes<VendaOpcao[]>()
  const vendas = vendasData ?? []

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="pos-venda"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createPosVenda} className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Novo registro de pós-venda</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-3">
            {error && (
              <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                {error}
              </p>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Venda de origem (opcional)</label>
              <select name="ordem_id" defaultValue="">
                <option value="">Manual — preencher abaixo</option>
                {vendas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.cliente_nome} — {v.veiculo_marca} {v.veiculo_modelo}
                    {v.veiculo_placa ? ` (${v.veiculo_placa})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
                Ao escolher uma venda, cliente e veículo são puxados dela. Deixe em
                &quot;Manual&quot; para digitar à mão (ex.: carro vendido antes do sistema).
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Cliente (se manual)</label>
              <input name="cliente_nome" type="text" />
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Marca (se manual)</label>
                <input name="veiculo_marca" type="text" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Modelo (se manual)</label>
                <input name="veiculo_modelo" type="text" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Placa (se manual)</label>
              <input name="veiculo_placa" type="text" className="uppercase" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Status</label>
              <ToggleGroup
                name="status"
                defaultValue="aberto"
                options={Object.entries(posVendaStatusLabel).map(([value, label]) => ({ value, label }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Data de entrega</label>
              <input name="entrega_em" type="date" />
              <p className="mt-1 text-[.68rem] normal-case text-[var(--text-muted)]">
                O fim do pós-venda é calculado sozinho: 3 meses depois dessa data.
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Prestador (onde o veículo está)</label>
              <input name="prestador" type="text" placeholder="Oficina / concessionária" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Anotações (garantia / manutenção)</label>
              <textarea name="anotacoes" rows={3} />
            </div>

            <button type="submit" className="btn btn-red mt-1 self-start">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
