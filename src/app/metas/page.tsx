import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { MetaWidget } from '@/components/MetaWidget'
import { VendasLista } from '@/components/VendasLista'
import { mesAtualISO, mesRange } from '@/lib/metas'
import { toggleVendaStatus, toggleVendaAutocerto, deleteVenda } from './actions'
import { isGerenciaCargo, podeVerTudo, isSomenteLeitura } from '@/lib/membros'

type Venda = {
  id: string
  numero_sequencial: number
  consultor_id: string
  unidade_id: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_placa: string | null
  valor: number
  data: string
  status: string
  enviado_autocerto: boolean
  profiles: { nome: string } | null
  unidades: { nome: string } | null
}

type Meta = { escopo: string; unidade_id: string | null; consultor_id: string | null; valor_meta: number }
type ProfileSummary = { nome: string; cargo: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string }>
}) {
  const { mes: mesParam, error } = await searchParams
  const mes = mesParam || mesAtualISO()
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

  const isGerencia = isGerenciaCargo(profile?.cargo)
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'
  // Gerente/supervisor vê só a própria unidade; admin/CEO veem a empresa toda.
  const veTudoUnidades = isAdmin || isSomenteLeitura(profile?.cargo)
  const unidadeGerente = !veTudoUnidades && isGerencia ? profile?.unidade_id ?? null : null

  const { inicio, fim } = mesRange(mes)

  // Busca a empresa toda: a corrida (barras por unidade) mostra todas as lojas
  // pra todo mundo. Só a LISTA de nomes abaixo é que fica restrita à unidade do
  // gerente (via vendasLista). Consultor já vê só as próprias pelo RLS.
  const { data: vendasData } = await supabase
    .from('vendas')
    .select(
      'id, numero_sequencial, consultor_id, unidade_id, veiculo_marca, veiculo_modelo, veiculo_placa, valor, data, status, enviado_autocerto, profiles(nome), unidades(nome)'
    )
    .gte('data', inicio)
    .lt('data', fim)
    // Ordem manual da lista (tela "Editar lista"); fallback pelo sequencial.
    .order('posicao', { ascending: true, nullsFirst: false })
    .order('numero_sequencial', { ascending: true })
    .overrideTypes<Venda[]>()

  const vendas = vendasData ?? []
  // Lista de nomes: gerente só vê a da própria unidade; admin/CEO veem tudo.
  const vendasLista = unidadeGerente ? vendas.filter((v) => v.unidade_id === unidadeGerente) : vendas

  const { data: metasData } = await supabase
    .from('metas')
    .select('escopo, unidade_id, consultor_id, valor_meta')
    .eq('tipo', 'vendas')
    .eq('periodo', mes)
    .overrideTypes<Meta[]>()

  const metas = metasData ?? []
  const metaEmpresa = metas.find((m) => m.escopo === 'empresa')?.valor_meta ?? 0
  const metaPorUnidade = new Map(
    metas.filter((m) => m.escopo === 'unidade').map((m) => [m.unidade_id, m.valor_meta])
  )
  const metaConsultor = metas.find((m) => m.escopo === 'consultor' && m.consultor_id === user.id)?.valor_meta ?? 0

  const { data: unidadesData } = await supabase.from('unidades').select('id, nome').order('nome')
  const unidades = (unidadesData ?? []) as Unidade[]

  // Só vendas ATIVAS contam pra meta — caída não conta. A lista abaixo continua
  // mostrando todas (inclusive as caídas, riscadas); só o realizado as ignora.
  const vendasAtivas = vendas.filter((v) => v.status === 'ativa')
  const realizadoTotal = vendasAtivas.length
  const realizadoPorUnidade = new Map<string, number>()
  for (const v of vendasAtivas) {
    realizadoPorUnidade.set(v.unidade_id, (realizadoPorUnidade.get(v.unidade_id) ?? 0) + 1)
  }
  const realizadoConsultor = vendasAtivas.filter((v) => v.consultor_id === user.id).length

  // Autocerto: quantas vendas ATIVAS da lista visível ainda não foram
  // registradas lá fora. Só conta ativa — venda caída não precisa subir.
  const pendentesAutocerto = vendasLista.filter((v) => v.status === 'ativa' && !v.enviado_autocerto)
  const pendentesPorConsultor = new Map<string, number>()
  for (const v of pendentesAutocerto) {
    const nome = v.profiles?.nome ?? '—'
    pendentesPorConsultor.set(nome, (pendentesPorConsultor.get(nome) ?? 0) + 1)
  }

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="metas"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Corrida da Meta
            </div>
            <div className="flex flex-wrap gap-2">
              <form method="get" className="flex items-center gap-2">
                <input name="mes" type="month" defaultValue={mes} />
                <button type="submit" className="btn btn-outline btn-sm">
                  Ver
                </button>
              </form>
              <Link href="/metas/protecao" className="btn btn-outline btn-sm">
                Proteção
              </Link>
              {isAdmin && (
                <Link href="/metas/definir" className="btn btn-outline btn-sm">
                  Definir metas
                </Link>
              )}
              {isAdmin && (
                <Link href={`/metas/editar?mes=${mes}`} className="btn btn-outline btn-sm">
                  Editar lista
                </Link>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-4">
            {isGerencia ? (
              <>
                <MetaWidget
                  titulo="Empresa"
                  subtitulo={mes}
                  realizadoLabel={`${realizadoTotal} vendas`}
                  metaLabel={`${metaEmpresa} vendas`}
                  pct={metaEmpresa > 0 ? (realizadoTotal / metaEmpresa) * 100 : 0}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {unidades.map((u) => {
                    const realizado = realizadoPorUnidade.get(u.id) ?? 0
                    const meta = metaPorUnidade.get(u.id) ?? 0
                    return (
                      <MetaWidget
                        key={u.id}
                        titulo={u.nome}
                        realizadoLabel={`${realizado} vendas`}
                        metaLabel={`${meta} vendas`}
                        pct={meta > 0 ? (realizado / meta) * 100 : 0}
                      />
                    )
                  })}
                </div>
              </>
            ) : (
              <MetaWidget
                titulo="Minha Meta"
                subtitulo={mes}
                realizadoLabel={`${realizadoConsultor} vendas`}
                metaLabel={`${metaConsultor} vendas`}
                pct={metaConsultor > 0 ? (realizadoConsultor / metaConsultor) * 100 : 0}
              />
            )}
          </div>

          {isGerencia && pendentesAutocerto.length > 0 && (
            <div className="mt-4 rounded-2xl border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3">
              <p className="text-[.72rem] font-bold uppercase tracking-wide text-[var(--warning)]">
                {pendentesAutocerto.length} {pendentesAutocerto.length === 1 ? 'venda' : 'vendas'} ainda não{' '}
                {pendentesAutocerto.length === 1 ? 'subiu' : 'subiram'} no Autocerto
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[.75rem] normal-case text-white">
                {[...pendentesPorConsultor.entries()].map(([nome, qtd]) => (
                  <span key={nome}>
                    <span className="font-semibold">{nome}</span>: {qtd}
                  </span>
                ))}
              </div>
            </div>
          )}

          <VendasLista
            vendas={vendasLista.map((v, i) => ({
              id: v.id,
              numero: i + 1,
              veiculo_marca: v.veiculo_marca,
              veiculo_modelo: v.veiculo_modelo,
              veiculo_placa: v.veiculo_placa,
              status: v.status,
              enviado_autocerto: v.enviado_autocerto,
              consultorNome: v.profiles?.nome ?? '—',
            }))}
            isAdmin={isAdmin}
            isGerencia={isGerencia}
            mes={mes}
            toggleVendaStatus={toggleVendaStatus}
            toggleVendaAutocerto={toggleVendaAutocerto}
            deleteVenda={deleteVenda}
          />

          {isAdmin && (
            <div className="mt-6 flex justify-center">
              <Link href="/metas/new" className="btn btn-red">
                + Lançar venda
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
