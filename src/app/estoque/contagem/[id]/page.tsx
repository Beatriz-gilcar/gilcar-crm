import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo } from '@/lib/membros'
import { ehMoto } from '@/lib/veiculos'
import { buscarFeedAutocerto, normalizarPlaca } from '@/lib/autocerto'
import { marcarItemContagem, finalizarContagem } from '../actions'

type ProfileSummary = { nome: string; cargo: string; acesso_financeiro: boolean }
type ContagemDetail = {
  id: string
  unidade_id: string
  created_at: string
  concluida: boolean
  unidades: { nome: string } | null
}
type ItemContagem = {
  id: string
  veiculo_id: string
  conferido: boolean
  observacao: string | null
  veiculos: { marca: string; modelo: string; placa: string | null } | null
}

function dataHoraBR(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function GrupoHeader({ titulo, total }: { titulo: string; total: number }) {
  return (
    <div className="border-t border-[var(--border)] bg-white/[.03] px-4 py-1.5 text-[.68rem] font-bold uppercase tracking-wide text-[var(--text-muted)] first:border-t-0">
      {titulo} ({total})
    </div>
  )
}

type FeedResult = { ok: boolean; placas: Set<string> }

function ItemLinha({
  item,
  aberta,
  contagemId,
  feedResult,
}: {
  item: ItemContagem
  aberta: boolean
  contagemId: string
  feedResult: FeedResult
}) {
  const placa = normalizarPlaca(item.veiculos?.placa)
  const anunciado = placa ? feedResult.placas.has(placa) : false
  return (
    <div className="border-t border-[var(--border)] px-4 py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="normal-case text-white">
          {item.veiculos?.marca} {item.veiculos?.modelo}
          {item.veiculos?.placa && ` · ${item.veiculos.placa}`}
        </p>
        <div className="flex items-center gap-2">
          {placa && (
            <span className={`badge ${anunciado ? 'badge-aprovado' : 'badge-neutro'}`}>
              {anunciado ? 'Anunciado no Autocerto' : 'Sem anúncio'}
            </span>
          )}
          <span className={`badge ${item.conferido ? 'badge-aprovado' : 'badge-rejeitado'}`}>
            {item.conferido ? 'Encontrado' : 'Não encontrado'}
          </span>
        </div>
      </div>

      {aberta && (
        <form action={marcarItemContagem} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="contagem_id" value={contagemId} />
          <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Observação</label>
            <input name="observacao" type="text" defaultValue={item.observacao ?? ''} placeholder="Ex.: tá na oficina" />
          </div>
          <button type="submit" name="conferido" value={item.conferido ? 'nao' : 'sim'} className="btn btn-outline btn-sm">
            {item.conferido ? 'Desmarcar' : 'Marcar encontrado'}
          </button>
        </form>
      )}
      {!aberta && item.observacao && (
        <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">Obs: {item.observacao}</p>
      )}
    </div>
  )
}

export default async function ContagemDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; tipo?: string }>
}) {
  const { id } = await params
  const { error, tipo } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo, acesso_financeiro')
    .eq('id', user.id)
    .single<ProfileSummary>()

  if (profile?.cargo !== 'admin' && !profile?.acesso_financeiro) {
    redirect('/')
  }

  const verTudo = podeVerTudo(profile.cargo)
  const isAdmin = profile.cargo === 'admin'

  const { data: contagem } = await supabase
    .from('estoque_contagens')
    .select('id, unidade_id, created_at, concluida, unidades(nome)')
    .eq('id', id)
    .single<ContagemDetail>()

  if (!contagem) {
    notFound()
  }

  const [{ data: itensData }, feedResult] = await Promise.all([
    supabase
      .from('estoque_contagem_itens')
      .select('id, veiculo_id, conferido, observacao, veiculos(marca, modelo, placa)')
      .eq('contagem_id', contagem.id)
      .overrideTypes<ItemContagem[]>(),
    buscarFeedAutocerto()
      .then((feed) => ({ ok: true as const, placas: new Set(feed.map((v) => v.placa)) }))
      .catch(() => ({ ok: false as const, placas: new Set<string>() })),
  ])

  const itens = itensData ?? []
  // Ordena: não conferido primeiro (é o que ainda falta olhar no pátio).
  const ordenados = [...itens].sort((a, b) => Number(a.conferido) - Number(b.conferido))

  // Separador carro/moto — mesma heurística usada no estoque (não tem
  // campo "tipo" no cadastro).
  const carros = ordenados.filter((i) => !ehMoto(i.veiculos?.marca ?? '', i.veiculos?.modelo ?? ''))
  const motos = ordenados.filter((i) => ehMoto(i.veiculos?.marca ?? '', i.veiculos?.modelo ?? ''))
  const tipoAtivo = tipo === 'carro' || tipo === 'moto' ? tipo : ''

  const encontrados = itens.filter((i) => i.conferido).length
  const naoEncontrados = itens.length - encontrados
  const aberta = !contagem.concluida

  return (
    <>
      <Topbar
        nome={profile.nome ?? user.email ?? ''}
        cargo={profile.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        veContagemEstoque={profile.acesso_financeiro}
        active="estoque-contagem"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <Link href="/estoque/contagem" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Conferência de estoque
          </Link>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                {contagem.unidades?.nome ?? '—'}
              </div>
              <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">
                Aberta em {dataHoraBR(contagem.created_at)}
                {contagem.concluida && ' · Finalizada'}
              </p>
            </div>
            {aberta && (
              <form action={finalizarContagem}>
                <input type="hidden" name="contagem_id" value={contagem.id} />
                <button type="submit" className="btn btn-red btn-sm">
                  Finalizar contagem
                </button>
              </form>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="kpi-grid mt-4">
            <div className="kpi-card">
              <div className="kpi-label">Encontrados</div>
              <div className="kpi-val">{encontrados}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Não encontrados</div>
              <div className="kpi-val" style={{ color: naoEncontrados > 0 ? 'var(--danger)' : undefined }}>
                {naoEncontrados}
              </div>
            </div>
          </div>

          {!feedResult.ok && (
            <p className="mt-3 text-[.7rem] normal-case text-[var(--text-muted)]">
              Não deu pra consultar o Autocerto agora — a tag de anúncio fica indisponível, o resto funciona normal.
            </p>
          )}

          <div className="chip-row mt-4">
            <Link href={`?tipo=`} className={`toggle-btn ${tipoAtivo === '' ? 'ativo' : ''}`}>
              Todos ({ordenados.length})
            </Link>
            <Link href={`?tipo=carro`} className={`toggle-btn ${tipoAtivo === 'carro' ? 'ativo' : ''}`}>
              🚗 Carros ({carros.length})
            </Link>
            <Link href={`?tipo=moto`} className={`toggle-btn ${tipoAtivo === 'moto' ? 'ativo' : ''}`}>
              🏍️ Motos ({motos.length})
            </Link>
          </div>

          <div className="mt-3 sec-body" style={{ padding: 0 }}>
            {ordenados.length === 0 ? (
              <div className="empty-state">Nenhum veículo disponível/reservado nessa unidade quando a contagem abriu.</div>
            ) : (tipoAtivo === 'carro' ? carros : tipoAtivo === 'moto' ? motos : ordenados).length === 0 ? (
              <div className="empty-state">Nenhum veículo desse tipo nessa contagem.</div>
            ) : tipoAtivo === 'carro' ? (
              carros.map((item) => (
                <ItemLinha key={item.id} item={item} aberta={aberta} contagemId={contagem.id} feedResult={feedResult} />
              ))
            ) : tipoAtivo === 'moto' ? (
              motos.map((item) => (
                <ItemLinha key={item.id} item={item} aberta={aberta} contagemId={contagem.id} feedResult={feedResult} />
              ))
            ) : (
              <>
                {carros.length > 0 && (
                  <>
                    <GrupoHeader titulo="🚗 Carros" total={carros.length} />
                    {carros.map((item) => (
                      <ItemLinha key={item.id} item={item} aberta={aberta} contagemId={contagem.id} feedResult={feedResult} />
                    ))}
                  </>
                )}
                {motos.length > 0 && (
                  <>
                    <GrupoHeader titulo="🏍️ Motos" total={motos.length} />
                    {motos.map((item) => (
                      <ItemLinha key={item.id} item={item} aberta={aberta} contagemId={contagem.id} feedResult={feedResult} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
