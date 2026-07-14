import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { tipoLabel, statusLabel, statusBadgeClass, formatBRL } from '@/lib/ordens'

type Ordem = {
  id: string
  tipo: string
  cliente_nome: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  data_venda: string
  status: string
  falta_receber: number
  unidades: { nome: string } | null
  vendedor: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }
type Vendedor = { id: string; nome: string }

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; data_de?: string; data_ate?: string; vendedor_id?: string; status?: string }>
}) {
  const { busca, data_de, data_ate, vendedor_id, status } = await searchParams
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

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const isAdmin = profile?.cargo === 'admin'

  let vendedores: Vendedor[] = []
  if (isGerencia) {
    const { data } = await supabase.from('profiles').select('id, nome').order('nome')
    vendedores = data ?? []
  }

  let query = supabase
    .from('ordens_servico')
    .select(
      'id, tipo, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, data_venda, status, falta_receber, unidades(nome), vendedor:profiles!ordens_servico_consultor_id_fkey(nome)'
    )
    .order('data_venda', { ascending: false })

  if (status) query = query.eq('status', status)
  if (data_de) query = query.gte('data_venda', data_de)
  if (data_ate) query = query.lte('data_venda', data_ate)
  if (isGerencia && vendedor_id) query = query.eq('consultor_id', vendedor_id)
  if (busca) {
    const termo = `%${busca}%`
    query = query.or(`cliente_nome.ilike.${termo},veiculo_marca.ilike.${termo},veiculo_modelo.ilike.${termo},veiculo_placa.ilike.${termo}`)
  }

  const { data: ordensData } = await query.overrideTypes<Ordem[]>()
  const ordens = ordensData ?? []

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="ordens"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="sec-header">
            <div className="sec-title">Ordens Salvas</div>
            <Link href="/ordens/new" className="btn btn-red btn-sm">
              + Nova Ordem
            </Link>
          </div>
          <div className="sec-body sec-pad">
            <form className="filtros" method="get">
              <input name="busca" type="text" placeholder="Comprador, veículo ou placa" defaultValue={busca ?? ''} />
              <input name="data_de" type="date" defaultValue={data_de ?? ''} title="De" />
              <input name="data_ate" type="date" defaultValue={data_ate ?? ''} title="Até" />
              <select name="status" defaultValue={status ?? ''}>
                <option value="">Todos status</option>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {isGerencia && (
                <select name="vendedor_id" defaultValue={vendedor_id ?? ''}>
                  <option value="">Todos vendedores</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className="btn btn-outline btn-sm">
                Filtrar
              </button>
            </form>
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {ordens.length === 0 ? (
              <div className="empty-state">Nenhuma ordem de serviço encontrada.</div>
            ) : (
              <div className="flex flex-col">
                {ordens.map((ordem) => (
                  <Link
                    key={ordem.id}
                    href={`/ordens/${ordem.id}`}
                    className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-white/[.03]"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {ordem.cliente_nome}
                        <span className="ml-2 text-[.68rem] font-normal text-[var(--text-muted)]">
                          {tipoLabel[ordem.tipo]}
                        </span>
                      </p>
                      <p className="text-[.72rem] text-[var(--text-muted)]">
                        {ordem.veiculo_marca} {ordem.veiculo_modelo}
                        {ordem.veiculo_placa ? ` · ${ordem.veiculo_placa}` : ''}
                        {' · '}
                        {ordem.unidades?.nome ?? '—'}
                        {ordem.vendedor?.nome ? ` · ${ordem.vendedor.nome}` : ''}
                        {' · '}
                        {new Date(`${ordem.data_venda}T12:00:00`).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`badge ${statusBadgeClass[ordem.status]}`}>
                        {statusLabel[ordem.status]}
                      </span>
                      <span className="text-[.72rem] text-[var(--text-muted)]">
                        Falta: {formatBRL(ordem.falta_receber)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
