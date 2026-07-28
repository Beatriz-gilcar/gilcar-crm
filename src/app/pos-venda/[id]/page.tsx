import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { ToggleGroup } from '@/components/ToggleGroup'
import { ConfirmButton } from '@/components/ConfirmButton'
import { AutoSubmitCheckbox } from '@/components/AutoSubmitCheckbox'
import { podeVerTudo, podeEditarPosVenda, isGerenciaCargo } from '@/lib/membros'
import { posVendaStatusLabel, posVendaStatusBadgeClass } from '@/lib/pos_venda'
import { updatePosVenda, deletePosVenda, adicionarItemPosVenda, atualizarItemPosVenda, excluirItemPosVenda } from '../actions'

type PosVenda = {
  id: string
  ordem_id: string | null
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  veiculo_km: string | null
  status: string
  entrega_em: string | null
  revisao_em: string | null
  prestador: string | null
  anotacoes: string | null
  unidades: { nome: string } | null
}

type ItemManutencao = {
  id: string
  descricao: string
  feito: boolean
  local: string | null
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
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { id } = await params
  const { error, success } = await searchParams
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
  // Só gerência/admin conseguem de fato abrir a Ordem de Serviço (RLS).
  // Cargo pos_venda (Luciana) nunca acessa — mostrar o link pra ela só levaria
  // a um 404, então nem exibimos.
  const podeVerOrdem = isGerenciaCargo(profile?.cargo)

  const { data: registro } = await supabase
    .from('pos_venda')
    .select(
      'id, ordem_id, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, veiculo_km, status, entrega_em, revisao_em, prestador, anotacoes, unidades(nome)'
    )
    .eq('id', id)
    .single<PosVenda>()

  if (!registro) {
    notFound()
  }

  const { data: itensData } = await supabase
    .from('pos_venda_itens')
    .select('id, descricao, feito, local')
    .eq('pos_venda_id', id)
    .order('posicao')
    .overrideTypes<ItemManutencao[]>()

  const itens = itensData ?? []
  const pendentes = itens.filter((item) => !item.feito)
  const concluidos = itens.filter((item) => item.feito)

  function renderItem(item: ItemManutencao) {
    return podeEditar ? (
      <form
        key={item.id}
        action={atualizarItemPosVenda}
        className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="pos_venda_id" value={registro!.id} />
        <label className="flex flex-1 items-center gap-2 normal-case text-white">
          <AutoSubmitCheckbox name="feito" defaultChecked={item.feito} />
          {item.descricao}
        </label>
        <input
          name="local"
          type="text"
          defaultValue={item.local ?? ''}
          placeholder="Local"
          style={{ maxWidth: 140 }}
        />
        <button type="submit" name="acao" value="salvar_local" className="btn btn-outline btn-sm">
          Salvar local
        </button>
        <button
          type="submit"
          formAction={excluirItemPosVenda}
          className="text-[.72rem] font-bold text-[var(--danger)] hover:underline"
        >
          Excluir
        </button>
      </form>
    ) : (
      <div
        key={item.id}
        className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-[.82rem] normal-case text-white first:border-t-0 first:pt-0"
      >
        <span className="flex items-center gap-2">
          <input type="checkbox" checked={item.feito} disabled readOnly />
          {item.descricao}
          {item.feito && <span className="badge badge-aprovado">✓ Feito</span>}
        </span>
        <span className="text-[var(--text-muted)]">{item.local || '—'}</span>
      </div>
    )
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
              {registro.veiculo_km ? ` · ${registro.veiculo_km} km` : ''}
              {registro.unidades?.nome ? ` · ${registro.unidades.nome}` : ''}
            </p>
            {registro.ordem_id && podeVerOrdem && (
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
              {success && (
                <p className="rounded-md bg-[#081a0c] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
                  {success}
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
                  <label>Fim do pós-venda</label>
                  <p className="text-[.85rem] normal-case text-white" style={{ padding: '10px 0' }}>
                    {dataBR(registro.revisao_em)}
                  </p>
                  <p className="text-[.68rem] normal-case text-[var(--text-muted)]">
                    Sempre 3 meses depois da entrega — recalcula ao salvar.
                  </p>
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
                <span className="text-[var(--text-muted)]">Fim do pós-venda:</span> {dataBR(registro.revisao_em)}
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

          <div className="sec-header mt-4">
            <div className="sec-title">Serviços de manutenção</div>
          </div>
          <div className="sec-body sec-pad flex flex-col gap-3">
            {itens.length === 0 ? (
              <p className="text-[.78rem] normal-case text-[var(--text-muted)]">Nenhum serviço lançado.</p>
            ) : (
              <>
                {pendentes.length === 0 ? (
                  <p className="text-[.78rem] normal-case text-[var(--text-muted)]">Nenhum serviço pendente.</p>
                ) : (
                  pendentes.map((item) => renderItem(item))
                )}

                {concluidos.length > 0 && (
                  <div className="mt-2 flex flex-col gap-3 border-t border-[var(--border)] pt-3">
                    <span className="text-[.68rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      Concluídos
                    </span>
                    {concluidos.map((item) => renderItem(item))}
                  </div>
                )}
              </>
            )}

            {podeEditar && (
              <form action={adicionarItemPosVenda} className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
                <input type="hidden" name="pos_venda_id" value={registro.id} />
                <input name="descricao" type="text" placeholder="Novo serviço" className="flex-1" />
                <button type="submit" className="btn btn-outline btn-sm whitespace-nowrap">
                  + Adicionar
                </button>
              </form>
            )}
          </div>

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
