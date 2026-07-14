import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { createVeiculo } from '../actions'

type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }

export default async function NewVeiculoPage({
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
  const isAdmin = profile?.cargo === 'admin'

  let unidades: Unidade[] = []
  if (isAdmin) {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome')
    unidades = data ?? []
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="estoque"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <form action={createVeiculo} className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Novo veículo</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-3">
            {error && (
              <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                {error}
              </p>
            )}

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Marca</label>
                <input name="marca" type="text" required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Modelo</label>
                <input name="modelo" type="text" required />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Câmbio</label>
              <ToggleGroup
                name="cambio"
                defaultValue="manual"
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'automatico', label: 'Automático' },
                ]}
              />
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>GNV</label>
                <ToggleGroup
                  name="gnv"
                  defaultValue="nao"
                  options={[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                  ]}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Blindado</label>
                <ToggleGroup
                  name="blindado"
                  defaultValue="indefinido"
                  options={[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                    { value: 'indefinido', label: 'Não informado' },
                  ]}
                />
              </div>
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cor</label>
                <input name="cor" type="text" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Ano</label>
                <input name="ano" type="text" placeholder="2023/2024" />
              </div>
            </div>

            <div className="grid2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Placa</label>
                <input name="placa" type="text" required className="uppercase" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Licenciado até</label>
                <input name="licenciado_ate" type="number" min="1900" max="2100" placeholder="Ano" />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>No site</label>
              <ToggleGroup
                name="no_site"
                defaultValue="nao"
                options={[
                  { value: 'sim', label: 'Sim' },
                  { value: 'nao', label: 'Não' },
                ]}
              />
            </div>

            {isAdmin ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Unidade</label>
                <select name="unidade_id" required defaultValue="">
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {unidades.map((unidade) => (
                    <option key={unidade.id} value={unidade.id}>
                      {unidade.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="unidade_id" value={profile?.unidade_id ?? ''} />
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Status</label>
              <ToggleGroup
                name="status"
                defaultValue="disponivel"
                options={[
                  { value: 'disponivel', label: 'Disponível' },
                  { value: 'reservado', label: 'Reservado' },
                  { value: 'vendido', label: 'Vendido' },
                ]}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Manutenção / Observação</label>
              <textarea name="observacao" rows={2} />
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
