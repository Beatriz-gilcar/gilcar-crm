import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'

type Lead = {
  id: string
  nome: string
  created_at: string
  unidades: { nome: string } | null
  profiles: { nome: string } | null
}

type ProfileSummary = { nome: string; cargo: string }

export default async function LeadsPage() {
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

  const { data: leads } = await supabase
    .from('clientes')
    .select('id, nome, created_at, unidades(nome), profiles(nome)')
    .order('created_at', { ascending: false })
    .overrideTypes<Lead[]>()

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="leads"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <div className="sec-header">
            <div className="sec-title">Leads</div>
            <Link href="/leads/new" className="btn btn-red btn-sm">
              + Novo lead
            </Link>
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {!leads || leads.length === 0 ? (
              <div className="empty-state">Nenhum lead cadastrado ainda.</div>
            ) : (
              <div className="flex flex-col">
                {leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-4 py-3 first:border-t-0 hover:bg-white/[.03]"
                  >
                    <div>
                      <p className="font-semibold text-white">{lead.nome}</p>
                      <p className="text-[.72rem] text-[var(--text-muted)]">
                        {lead.unidades?.nome ?? 'sem unidade'}
                        {lead.profiles?.nome ? ` · ${lead.profiles.nome}` : ''}
                      </p>
                    </div>
                    <span className="text-[.72rem] text-[var(--text-muted)]">
                      {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                    </span>
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
