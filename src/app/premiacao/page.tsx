import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { formatBRL } from '@/lib/ordens'
import { mesAtualISO, mesRange, mesLabel } from '@/lib/metas'
import { podeVerTudo } from '@/lib/membros'
import { tiersMotos, tiersCarros, melhorPremio, type PremioTier } from '@/lib/premiacao'

type ProfileSummary = { nome: string; cargo: string }
type Profile = { id: string; nome: string }
type VendaMin = { consultor_id: string; tipo: string }
type ProtecaoMin = { consultor_id: string }

function mesesRecentes(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    out.push(new Date(d.getFullYear(), d.getMonth() - i, 1).toISOString().slice(0, 7))
  }
  return out
}

function LinhaPremio({ premio, sub }: { premio: PremioTier | null; sub: string }) {
  if (!premio) {
    return <span className="text-[var(--text-muted)]">{sub}: — (sem prêmio)</span>
  }
  return (
    <span className="text-white">
      {sub}: <span className="font-bold text-[var(--success)]">{formatBRL(premio.dinheiro)}</span>
      {premio.trafego > 0 && <> + {formatBRL(premio.trafego)} tráfego</>}
      <span className="text-[var(--text-muted)]"> · {premio.label}</span>
    </span>
  )
}

export default async function PremiacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes: mesParam } = await searchParams
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
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  const { inicio, fim } = mesRange(mes)

  // Service role: precisa dos números de todos os vendedores (o RLS esconde as
  // vendas/proteções alheias). Só devolvemos contagens/prêmios.
  const admin = createAdminClient()
  const [vendedoresRes, vendasRes, protecoesRes] = await Promise.all([
    admin.from('profiles').select('id, nome').eq('ativo', true).neq('cargo', 'visualizador').order('nome'),
    admin.from('vendas').select('consultor_id, tipo').eq('status', 'ativa').gte('data', inicio).lt('data', fim),
    admin
      .from('vendas_protecao')
      .select('consultor_id')
      .eq('status', 'ativa')
      .gte('data', inicio)
      .lt('data', fim),
  ])

  const vendedores = (vendedoresRes.data ?? []) as Profile[]
  const vendas = (vendasRes.data ?? []) as VendaMin[]
  const protecoes = (protecoesRes.data ?? []) as ProtecaoMin[]

  const motosPor = new Map<string, number>()
  const carrosPor = new Map<string, number>()
  const protPor = new Map<string, number>()
  for (const v of vendas) {
    const m = v.tipo === 'moto' ? motosPor : carrosPor
    m.set(v.consultor_id, (m.get(v.consultor_id) ?? 0) + 1)
  }
  for (const p of protecoes) {
    protPor.set(p.consultor_id, (protPor.get(p.consultor_id) ?? 0) + 1)
  }

  const linhas = vendedores
    .map((vend) => {
      const motos = motosPor.get(vend.id) ?? 0
      const carros = carrosPor.get(vend.id) ?? 0
      const prot = protPor.get(vend.id) ?? 0
      const premioMotos = melhorPremio(tiersMotos, motos, prot)
      const premioCarros = melhorPremio(tiersCarros, carros, prot)
      const total =
        (premioMotos ? premioMotos.dinheiro + premioMotos.trafego : 0) +
        (premioCarros ? premioCarros.dinheiro + premioCarros.trafego : 0)
      return { nome: vend.nome, motos, carros, prot, premioMotos, premioCarros, total }
    })
    .filter((l) => l.motos > 0 || l.carros > 0 || l.prot > 0)
    .sort((a, b) => b.total - a.total)

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="premiacao"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              🏆 Prêmios para vendedores — {mesLabel(mes)}
            </div>
            <form method="get" className="flex items-center gap-2">
              <select name="mes" defaultValue={mes}>
                {mesesRecentes().map((m) => (
                  <option key={m} value={m}>
                    {mesLabel(m)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-outline btn-sm">
                Ver
              </button>
            </form>
          </div>

          <div className="sec-body mt-4" style={{ padding: 0 }}>
            {linhas.length === 0 ? (
              <div className="empty-state">Nenhuma venda/proteção lançada em {mesLabel(mes)}.</div>
            ) : (
              <div className="flex flex-col">
                {linhas.map((l) => (
                  <div key={l.nome} className="border-t border-[var(--border)] px-4 py-3 first:border-t-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">{l.nome}</p>
                      <span className="text-[.8rem]">
                        Prêmio do mês:{' '}
                        <span className="text-[1.05rem] font-extrabold text-[var(--success)]">
                          {l.total > 0 ? formatBRL(l.total) : '—'}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-[.72rem] text-[var(--text-muted)]">
                      🏍️ {l.motos} motos · 🚗 {l.carros} carros · 🛡️ {l.prot} proteções
                    </p>
                    <div className="mt-1 flex flex-col gap-0.5 text-[.74rem] normal-case">
                      <LinhaPremio premio={l.premioMotos} sub="🏍️ Motos" />
                      <LinhaPremio premio={l.premioCarros} sub="🚗 Carros" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela da regra, pra todo mundo saber o que está perseguindo. */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="sec-header">
                <div className="sec-title">🏍️ Motos</div>
              </div>
              <div className="sec-body sec-pad flex flex-col gap-1 text-[.76rem] normal-case text-[var(--text-muted)]">
                {tiersMotos.map((t) => (
                  <p key={t.label}>
                    {t.label} → <span className="text-white">{formatBRL(t.dinheiro)}</span>
                    {t.trafego > 0 && ` + ${formatBRL(t.trafego)} tráfego`}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <div className="sec-header">
                <div className="sec-title">🚗 Carros</div>
              </div>
              <div className="sec-body sec-pad flex flex-col gap-1 text-[.76rem] normal-case text-[var(--text-muted)]">
                {tiersCarros.map((t) => (
                  <p key={t.label}>
                    {t.label} → <span className="text-white">{formatBRL(t.dinheiro)}</span>
                    {t.trafego > 0 && ` + ${formatBRL(t.trafego)} tráfego`}
                  </p>
                ))}
                <p className="mt-1 text-[var(--danger)]">🔴 Carro acima de 100 mil → 1% de comissão (em breve)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
