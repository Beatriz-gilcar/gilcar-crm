import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo, isGerenciaCargo } from '@/lib/membros'
import { formatBRL } from '@/lib/ordens'
import { buscarFeedAutocerto, normalizarPlaca, type VeiculoAutocerto } from '@/lib/autocerto'

type ProfileSummary = { nome: string; cargo: string }
type VeiculoCrm = {
  id: string
  marca: string
  modelo: string
  placa: string | null
  status: string
  unidades: { nome: string } | null
}

export default async function EstoqueAutocertoPage() {
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

  // Cruza o estoque inteiro (todas as unidades) — não faz sentido por
  // consultor, então fica restrito a quem já enxerga tudo (gerência/admin),
  // mesmo corte usado em /estoque pra transferência entre unidades.
  if (!isGerenciaCargo(profile?.cargo)) {
    redirect('/estoque')
  }

  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  const [{ data: veiculosData }, feedResult] = await Promise.all([
    supabase.from('veiculos').select('id, marca, modelo, placa, status, unidades(nome)').overrideTypes<VeiculoCrm[]>(),
    buscarFeedAutocerto()
      .then((feed) => ({ ok: true as const, feed }))
      .catch((e) => ({ ok: false as const, erro: e instanceof Error ? e.message : 'falha desconhecida' })),
  ])

  const veiculosCrm = veiculosData ?? []

  if (!feedResult.ok) {
    return (
      <>
        <Topbar nome={profile?.nome ?? user.email ?? ''} cargo={profile?.cargo ?? ''} verTudo={verTudo} isAdmin={isAdmin} active="estoque" />
        <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
          <div className="mx-auto w-full max-w-4xl">
            <Link href="/estoque" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
              ← Estoque
            </Link>
            <div className="sec-title mt-2" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Conferência com Autocerto
            </div>
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              Não foi possível buscar o feed do Autocerto agora ({feedResult.erro}). Tenta de novo em alguns minutos.
            </p>
          </div>
        </div>
      </>
    )
  }

  const feedPorPlaca = new Map<string, VeiculoAutocerto>()
  for (const v of feedResult.feed) feedPorPlaca.set(v.placa, v)

  const crmPorPlaca = new Map<string, VeiculoCrm>()
  for (const v of veiculosCrm) {
    const placa = normalizarPlaca(v.placa)
    if (placa) crmPorPlaca.set(placa, v)
  }

  // 1) O caso que custa dinheiro: vendido aqui, mas o anúncio lá continua de
  // pé — cliente liga pra carro que já foi embora.
  const vendidoMasAnunciado = veiculosCrm
    .map((v) => ({ v, placa: normalizarPlaca(v.placa) }))
    .filter((x) => x.v.status === 'vendido' && x.placa && feedPorPlaca.has(x.placa))
    .map((x) => ({ crm: x.v, autocerto: feedPorPlaca.get(x.placa!)! }))

  // 2) Disponível aqui mas nunca publicado lá — oportunidade perdida de
  // visibilidade (só considera quem tem placa; sem placa não dá pra cruzar).
  const disponivelSemAnuncio = veiculosCrm
    .map((v) => ({ v, placa: normalizarPlaca(v.placa) }))
    .filter((x) => x.v.status === 'disponivel' && x.placa && !feedPorPlaca.has(x.placa))
    .map((x) => x.v)

  // 3) Anunciado lá mas o CRM nem conhece essa placa — pode ser falta de
  // cadastro aqui, vale olhar.
  const anunciadoForaDoCrm = feedResult.feed.filter((v) => !crmPorPlaca.has(v.placa))

  return (
    <>
      <Topbar nome={profile?.nome ?? user.email ?? ''} cargo={profile?.cargo ?? ''} verTudo={verTudo} isAdmin={isAdmin} active="estoque" />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <Link href="/estoque" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Estoque
          </Link>
          <div className="sec-title mt-2" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Conferência com Autocerto
          </div>
          <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">
            {veiculosCrm.length} veículos no CRM · {feedResult.feed.length} anúncios no Autocerto. Cruzado pela placa.
          </p>

          <div className="mt-4">
            <div className="sec-header">
              <div className="sec-title" style={{ color: vendidoMasAnunciado.length > 0 ? 'var(--danger)' : undefined }}>
                ⚠️ Vendido no CRM, ainda anunciado no Autocerto ({vendidoMasAnunciado.length})
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {vendidoMasAnunciado.length === 0 ? (
                <div className="empty-state">Nenhum — tudo em dia.</div>
              ) : (
                vendidoMasAnunciado.map(({ crm, autocerto }) => (
                  <div
                    key={crm.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 first:border-t-0"
                  >
                    <div className="normal-case">
                      <p className="text-white">
                        {crm.marca} {crm.modelo} · {crm.placa}
                      </p>
                      <p className="text-[.72rem] text-[var(--text-muted)]">
                        {crm.unidades?.nome ?? '—'}
                        {autocerto.precoDecimal != null && ` · Anunciado por ${formatBRL(autocerto.precoDecimal)}`}
                      </p>
                    </div>
                    {autocerto.linkAnuncio && (
                      <a
                        href={autocerto.linkAnuncio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                      >
                        Ver anúncio
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="sec-header">
              <div className="sec-title">Disponível no CRM, sem anúncio no Autocerto ({disponivelSemAnuncio.length})</div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {disponivelSemAnuncio.length === 0 ? (
                <div className="empty-state">Nenhum — tudo publicado.</div>
              ) : (
                disponivelSemAnuncio.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 first:border-t-0">
                    <p className="normal-case text-white">
                      {v.marca} {v.modelo} · {v.placa}
                      <span className="ml-2 text-[.72rem] text-[var(--text-muted)]">{v.unidades?.nome ?? '—'}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="sec-header">
              <div className="sec-title">Anunciado no Autocerto, placa não encontrada no CRM ({anunciadoForaDoCrm.length})</div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {anunciadoForaDoCrm.length === 0 ? (
                <div className="empty-state">Nenhum.</div>
              ) : (
                anunciadoForaDoCrm.map((v) => (
                  <div key={v.idveiculo} className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 first:border-t-0">
                    <p className="normal-case text-white">
                      {v.marca} {v.modelo} · {v.placa}
                      {v.precoDecimal != null && (
                        <span className="ml-2 text-[.72rem] text-[var(--text-muted)]">{formatBRL(v.precoDecimal)}</span>
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
