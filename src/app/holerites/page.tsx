import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { podeVerTudo } from '@/lib/membros'
import { mesLabel } from '@/lib/metas'
import { assinarHolerite } from './actions'

type ProfileSummary = { nome: string; cargo: string; gerencia_holerites: boolean }

type MeuHolerite = {
  id: string
  mes_referencia: string
  status: string
  enviado_em: string
  visualizado_em: string | null
  assinado_em: string | null
}

const statusLabel: Record<string, string> = { enviado: 'Enviado', visualizado: 'Visualizado', assinado: 'Assinado' }
const statusBadge: Record<string, string> = {
  enviado: 'badge-pendente',
  visualizado: 'badge-neutro',
  assinado: 'badge-aprovado',
}

export default async function HoleritesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { error, success } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, cargo, gerencia_holerites')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isAdmin = profile?.cargo === 'admin'
  const verTudo = podeVerTudo(profile?.cargo)
  const gerenciaHolerites = profile?.gerencia_holerites ?? false

  const { data: meusData } = await supabase
    .from('holerites')
    .select('id, mes_referencia, status, enviado_em, visualizado_em, assinado_em')
    .eq('colaborador_id', user.id)
    .order('mes_referencia', { ascending: false })
    .overrideTypes<MeuHolerite[]>()
  const meus = meusData ?? []

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        gerenciaHolerites={gerenciaHolerites}
        active="holerites"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Meus holerites
            </div>
            {gerenciaHolerites && (
              <Link href="/holerites/rh" className="btn btn-outline btn-sm">
                Painel RH
              </Link>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}
          {success === 'assinado' && (
            <p className="mt-3 rounded-2xl bg-[var(--success-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--success)]">
              Recebimento confirmado.
            </p>
          )}

          <div className="sec-body mt-4" style={{ padding: 0 }}>
            {meus.length === 0 ? (
              <div className="empty-state">Nenhum holerite enviado pra você ainda.</div>
            ) : (
              <div className="flex flex-col">
                {meus.map((h) => (
                  <div key={h.id} className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-3 first:border-t-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold normal-case text-white">{mesLabel(h.mes_referencia.slice(0, 7))}</p>
                      <span className={`badge ${statusBadge[h.status] ?? 'badge-neutro'}`}>
                        {statusLabel[h.status] ?? h.status}
                      </span>
                    </div>
                    <a href={`/holerites/${h.id}/arquivo`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm self-start">
                      Ver PDF
                    </a>
                    {h.status !== 'assinado' && (
                      <form action={assinarHolerite} className="mt-1 flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
                        <input type="hidden" name="id" value={h.id} />
                        <label className="flex items-start gap-2 text-[.75rem] normal-case text-[var(--text-muted)]">
                          <input type="checkbox" required style={{ width: 'auto', marginTop: 3 }} />
                          Declaro que visualizei e confirmo o recebimento do holerite referente a {mesLabel(h.mes_referencia.slice(0, 7))}.
                        </label>
                        <div className="flex items-end gap-2">
                          <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                            <label>Confirme sua senha</label>
                            <input type="password" name="senha" required placeholder="Sua senha de login" />
                          </div>
                          <button type="submit" className="btn btn-red btn-sm">
                            Confirmar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
