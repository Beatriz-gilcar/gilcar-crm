import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo } from '@/lib/membros'
import { mesLabel, mesAtualISO } from '@/lib/metas'
import { enviarHolerite } from '../actions'

type ProfileSummary = { nome: string; cargo: string }
type Pessoa = { id: string; nome: string }

type HoleriteAdmin = {
  id: string
  colaborador_id: string
  mes_referencia: string
  status: string
  assinado_em: string | null
  profiles: { nome: string } | null
}

const statusLabel: Record<string, string> = { enviado: 'Enviado', visualizado: 'Visualizado', assinado: 'Assinado' }
const statusBadge: Record<string, string> = {
  enviado: 'badge-pendente',
  visualizado: 'badge-neutro',
  assinado: 'badge-aprovado',
}

export default async function HoleritesRhPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string; success?: string }>
}) {
  const { mes: mesParam, error, success } = await searchParams
  const mes = mesParam || mesAtualISO()
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
  if (!isAdmin) redirect('/holerites')

  const admin = createAdminClient()
  const [{ data: pessoasData }, { data: adminData }] = await Promise.all([
    admin.from('profiles').select('id, nome').eq('ativo', true).order('nome').overrideTypes<Pessoa[]>(),
    admin
      .from('holerites')
      .select('id, colaborador_id, mes_referencia, status, assinado_em, profiles(nome)')
      .eq('mes_referencia', `${mes}-01`)
      .overrideTypes<HoleriteAdmin[]>(),
  ])
  const colaboradores = pessoasData ?? []
  const holeritesAdmin = adminData ?? []
  const enviadosPorColaborador = new Set(holeritesAdmin.map((h) => h.colaborador_id))

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="holerites-rh"
      />
      <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Holerites — RH
            </div>
            <Link href="/holerites" className="btn btn-outline btn-sm">
              Meus holerites
            </Link>
          </div>

          {error && (
            <p className="mt-3 mb-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}
          {success === 'enviado' && (
            <p className="mt-3 mb-3 rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
              Holerite enviado.
            </p>
          )}

          <div className="card sec-pad mt-4 flex flex-col gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Enviar holerite
            </div>
            <form action={enviarHolerite} className="flex flex-col gap-3">
              <div className="grid2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Colaborador</label>
                  <select name="colaborador_id" required defaultValue="">
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {colaboradores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {enviadosPorColaborador.has(c.id) ? ' (já enviado nesse mês)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Mês de referência</label>
                  <input type="month" name="mes_referencia" required defaultValue={mes} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Arquivo PDF</label>
                <input type="file" name="arquivo" accept="application/pdf" required />
              </div>
              <button type="submit" className="btn btn-red self-start">
                Enviar
              </button>
            </form>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                Status do mês
              </div>
              <form method="get" className="flex items-end gap-2">
                <input type="month" name="mes" defaultValue={mes} />
                <button type="submit" className="btn btn-outline btn-sm">
                  Ver
                </button>
              </form>
            </div>
            <p className="mt-1 text-[.72rem] normal-case text-[var(--text-muted)]">{mesLabel(mes)}</p>
            <div className="sec-body mt-2" style={{ padding: 0 }}>
              {holeritesAdmin.length === 0 ? (
                <div className="empty-state">Nenhum holerite enviado nesse mês ainda.</div>
              ) : (
                <div className="flex flex-col">
                  {holeritesAdmin.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 first:border-t-0"
                    >
                      <p className="normal-case text-white">{h.profiles?.nome ?? '—'}</p>
                      <span className={`badge ${statusBadge[h.status] ?? 'badge-neutro'}`}>
                        {statusLabel[h.status] ?? h.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
