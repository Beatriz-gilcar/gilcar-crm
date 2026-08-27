import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo, podeAcessarSdr } from '@/lib/membros'
import { normalizarTelefone } from '@/lib/whatsapp'
import { atualizarVisita } from './actions'

type ProfileSummary = { nome: string; cargo: string }
type Pessoa = { id: string; nome: string }

type Lead = {
  id: string
  data: string
  cliente_nome: string
  cliente_telefone: string | null
  motivo: string | null
  veiculo_interesse: string | null
  origem: string | null
  observacao: string | null
  visita: string | null
  fechou: string | null
  consultor_id: string
  lancado_por: string | null
  unidade_id: string | null
}

const visitaBadge: Record<string, string> = {
  SIM: 'badge-aprovado',
  NÃO: 'badge-rejeitado',
  REAGENDOU: 'badge-pendente',
}

export default async function SdrHistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; sdr?: string; consultor?: string; busca?: string }>
}) {
  const { de, ate, sdr: sdrId, consultor: consultorId, busca } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isAdmin = profile?.cargo === 'admin'
  const verTudo = podeVerTudo(profile?.cargo)
  if (!podeAcessarSdr(profile?.cargo)) redirect('/')

  const admin = createAdminClient()
  const [{ data: sdrsData }, { data: consultoresData }, { data: unidadesData }] = await Promise.all([
    admin.from('profiles').select('id, nome').eq('cargo', 'sdr').order('nome').overrideTypes<Pessoa[]>(),
    admin
      .from('profiles')
      .select('id, nome')
      .in('cargo', ['consultor', 'supervisor'])
      .order('nome')
      .overrideTypes<Pessoa[]>(),
    admin.from('unidades').select('id, nome').order('nome').overrideTypes<Pessoa[]>(),
  ])
  const sdrs = sdrsData ?? []
  const consultores = consultoresData ?? []
  const unidades = unidadesData ?? []
  const nomePorId = new Map([...sdrs, ...consultores].map((p) => [p.id, p.nome]))
  const unidadeNomePorId = new Map(unidades.map((u) => [u.id, u.nome]))

  // Telefone visível pra quem acessa o SDR (mesma trava de acesso da página
  // inteira) — é quem precisa contatar o cliente pro follow-up.
  let query = admin
    .from('sdr_leads_historico')
    .select(
      'id, data, cliente_nome, cliente_telefone, motivo, veiculo_interesse, origem, observacao, visita, fechou, consultor_id, lancado_por, unidade_id'
    )
    .order('data', { ascending: false })
    .limit(300)

  if (de) query = query.gte('data', de)
  if (ate) query = query.lte('data', ate)
  if (sdrId) query = query.eq('lancado_por', sdrId)
  if (consultorId) query = query.eq('consultor_id', consultorId)
  if (busca) query = query.ilike('cliente_nome', `%${busca}%`)

  const { data: leadsData } = await query.overrideTypes<Lead[]>()
  const leads = leadsData ?? []

  const qs = new URLSearchParams()
  if (de) qs.set('de', de)
  if (ate) qs.set('ate', ate)
  if (sdrId) qs.set('sdr', sdrId)
  if (consultorId) qs.set('consultor', consultorId)
  if (busca) qs.set('busca', busca)
  const voltarPara = `/sdr/historico${qs.toString() ? `?${qs.toString()}` : ''}`

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="sdr"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="chip-row mb-4">
            <Link href="/sdr" className="toggle-btn">
              Lançamento
            </Link>
            <Link href="/sdr/historico" className="toggle-btn ativo">
              Histórico de leads
            </Link>
          </div>

          <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Histórico de leads
          </div>
          <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">
            {leads.length} resultado{leads.length === 1 ? '' : 's'} (máx. 300 por vez — use os filtros pra refinar).
            Clique no nome pra abrir o WhatsApp do cliente.
          </p>

          <form method="get" className="card sec-pad mt-3 flex flex-wrap items-end gap-3">
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 160 }}>
              <label>De</label>
              <input type="date" name="de" defaultValue={de ?? ''} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 160 }}>
              <label>Até</label>
              <input type="date" name="ate" defaultValue={ate ?? ''} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 180 }}>
              <label>SDR</label>
              <select name="sdr" defaultValue={sdrId ?? ''}>
                <option value="">Todas</option>
                {sdrs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 200 }}>
              <label>Consultor</label>
              <select name="consultor" defaultValue={consultorId ?? ''}>
                <option value="">Todos</option>
                {consultores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: 160 }}>
              <label>Cliente</label>
              <input type="text" name="busca" defaultValue={busca ?? ''} placeholder="Nome do cliente" />
            </div>
            <button type="submit" className="btn btn-red btn-sm">
              Buscar
            </button>
          </form>

          <div className="sec-body mt-4" style={{ padding: 0 }}>
            {leads.length === 0 ? (
              <div className="empty-state">Nenhum lead encontrado com esses filtros.</div>
            ) : (
              <div className="flex flex-col">
                {leads.map((l) => {
                  const telefoneWa = normalizarTelefone(l.cliente_telefone)
                  return (
                  <div
                    key={l.id}
                    className="flex flex-col gap-1 border-t border-[var(--border)] px-4 py-3 first:border-t-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {telefoneWa ? (
                        <a
                          href={`https://wa.me/${telefoneWa}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-white underline decoration-[var(--text-muted)] hover:text-[var(--coral)]"
                        >
                          {l.cliente_nome}
                          {l.cliente_telefone ? ` · ${l.cliente_telefone}` : ''}
                        </a>
                      ) : (
                        <p className="font-semibold text-white">{l.cliente_nome}</p>
                      )}
                      <form action={atualizarVisita} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="voltar_para" value={voltarPara} />
                        {(['SIM', 'NÃO', 'REAGENDOU'] as const).map((v) => (
                          <button
                            key={v}
                            type="submit"
                            name="visita"
                            value={v}
                            className={`badge ${l.visita === v ? (visitaBadge[v] ?? 'badge-neutro') : 'badge-neutro'}`}
                            style={{ cursor: 'pointer', opacity: l.visita === v ? 1 : 0.45 }}
                            title={`Marcar como ${v}`}
                          >
                            {v}
                          </button>
                        ))}
                      </form>
                    </div>
                    <p className="text-[.72rem] text-[var(--text-muted)]">
                      {new Date(`${l.data}T12:00:00`).toLocaleDateString('pt-BR')}
                      {' · '}
                      {nomePorId.get(l.consultor_id) ?? '—'}
                      {l.unidade_id ? ` · ${unidadeNomePorId.get(l.unidade_id) ?? '—'}` : ''}
                      {l.lancado_por ? ` · SDR: ${nomePorId.get(l.lancado_por) ?? '—'}` : ''}
                    </p>
                    <p className="normal-case text-white">
                      {[l.motivo, l.veiculo_interesse, l.origem].filter(Boolean).join(' · ')}
                    </p>
                    {l.observacao && (
                      <p className="text-[.78rem] normal-case text-[var(--text-muted)]">{l.observacao}</p>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
