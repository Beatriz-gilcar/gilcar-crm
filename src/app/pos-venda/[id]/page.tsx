import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { ConfirmButton } from '@/components/ConfirmButton'
import { podeVerTudo, podeEditarPosVenda } from '@/lib/membros'
import { posVendaStatusLabel, posVendaStatusBadgeClass } from '@/lib/pos_venda'
import { updatePosVenda, deletePosVenda } from '../actions'

type PosVenda = {
  id: string
  ordem_id: string | null
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  status: string
  entrega_em: string | null
  revisao_em: string | null
  prestador: string | null
  anotacoes: string | null
  unidades: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }

function dataBR(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

export default async function PosVendaDetailPage({
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
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'
  const podeEditar = podeEditarPosVenda(profile?.cargo)

  const { data: registro } = await supabase
    .from('pos_venda')
    .select(
      'id, ordem_id, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, status, entrega_em, revisao_em, prestador, anotacoes, unidades(nome)'
    )
    .eq('id', id)
    .single<PosVenda>()

  if (!registro) {
    notFound()
  }

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
        <div className="w-full max-w-lg">
          <div className="sec-header">
            <div className="sec-title">Pós-venda</div>
            <Link href="/pos-venda" className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white">
              ← Voltar
            </Link>
          </div>

          {/* Cliente e veículo vêm da venda de origem — não editáveis aqui. */}
          <div className="sec-body sec-pad mb-4 flex flex-col gap-1 text-[.82rem] normal-case text-white">
            <p className="font-semibold">{registro.cliente_nome}</p>
            <p className="text-[var(--text-muted)]">
              {registro.veiculo_marca} {registro.veiculo_modelo}
              {registro.veiculo_placa ? ` · ${registro.veiculo_placa}` : ''}
              {registro.unidades?.nome ? ` · ${registro.unidades.nome}` : ''}
            </p>
            {registro.ordem_id && (
              <Link
                href={`/ordens/${registro.ordem_id}`}
                className="mt-1 text-[.72rem] font-bold text-[var(--coral)] hover:underline"
              >
                Ver ordem de venda →
              </Link>
            )}
          </div>

          {podeEditar ? (
            <form action={updatePosVenda} className="sec-body sec-pad flex flex-col gap-3">
              <input type="hidden" name="id" value={registro.id} />
              {error && (
                <p className="rounded-md bg-[#1a0808] px-3 py-2 text-[.78rem] normal-case text-[var(--red)]">
                  {error}
                </p>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Status</label>
                <ToggleGroup
                  name="status"
                  defaultValue={registro.status}
                  options={Object.entries(posVendaStatusLabel).map(([value, label]) => ({ value, label }))}
                />
              </div>

              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Data de entrega</label>
                  <input name="entrega_em" type="date" defaultValue={registro.entrega_em ?? ''} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Data de revisão</label>
                  <input name="revisao_em" type="date" defaultValue={registro.revisao_em ?? ''} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Prestador (onde o veículo está)</label>
                <input name="prestador" type="text" defaultValue={registro.prestador ?? ''} placeholder="Oficina / concessionária" />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Anotações (garantia / manutenção)</label>
                <textarea name="anotacoes" rows={4} defaultValue={registro.anotacoes ?? ''} />
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-red self-start">
                  Salvar
                </button>
              </div>
            </form>
          ) : (
            // Consultor: só leitura.
            <div className="sec-body sec-pad flex flex-col gap-3 text-[.82rem] normal-case text-white">
              <div>
                <span className="text-[.68rem] uppercase tracking-wide text-[var(--text-muted)]">Status</span>
                <div className="mt-1">
                  <span className={`badge ${posVendaStatusBadgeClass[registro.status]}`}>
                    {posVendaStatusLabel[registro.status]}
                  </span>
                </div>
              </div>
              <p>
                <span className="text-[var(--text-muted)]">Entrega:</span> {dataBR(registro.entrega_em)}
                {'   ·   '}
                <span className="text-[var(--text-muted)]">Revisão:</span> {dataBR(registro.revisao_em)}
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Prestador:</span> {registro.prestador ?? '—'}
              </p>
              <div>
                <span className="text-[var(--text-muted)]">Anotações:</span>
                <p className="mt-1 whitespace-pre-wrap">{registro.anotacoes ?? '—'}</p>
              </div>
            </div>
          )}

          {podeEditar && (
            <form action={deletePosVenda} className="mt-4">
              <input type="hidden" name="id" value={registro.id} />
              <ConfirmButton
                className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
                confirmMessage={`Remover o pós-venda de ${registro.cliente_nome} (${registro.veiculo_marca} ${registro.veiculo_modelo})?`}
              >
                Excluir registro
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
