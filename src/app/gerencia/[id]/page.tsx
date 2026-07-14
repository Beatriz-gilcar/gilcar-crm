import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { tipoLabel, percentualColor } from '@/lib/checklists'

type ChecklistDetail = {
  id: string
  tipo: string
  data: string
  percentual_sim: number
  avaliado: { nome: string } | null
  avaliador: { nome: string } | null
  unidades: { nome: string } | null
}

type Item = {
  id: string
  ordem: number
  pergunta: string
  resposta: boolean
  observacao: string | null
}

type ProfileSummary = { nome: string; cargo: string }

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: checklist } = await supabase
    .from('checklists_gerencia')
    .select(
      `id, tipo, data, percentual_sim,
       avaliado:profiles!checklists_gerencia_avaliado_id_fkey(nome),
       avaliador:profiles!checklists_gerencia_avaliador_id_fkey(nome),
       unidades(nome)`
    )
    .eq('id', id)
    .single<ChecklistDetail>()

  if (!checklist) {
    notFound()
  }

  const { data: itensData } = await supabase
    .from('checklist_itens')
    .select('id, ordem, pergunta, resposta, observacao')
    .eq('checklist_id', id)
    .order('ordem')
    .overrideTypes<Item[]>()

  const itens = itensData ?? []
  const cor = percentualColor(checklist.percentual_sim)

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        isGerencia={isGerencia}
        isAdmin={isAdmin}
        active="gerencia"
      />
      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <Link href="/gerencia" className="text-[.72rem] text-[var(--text-muted)] hover:text-white">
            ← Gerência
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-enviado">{tipoLabel[checklist.tipo]}</span>
            <span className={`badge ${cor.badgeClass}`}>{checklist.percentual_sim.toFixed(0)}% sim</span>
            <span className="text-[.75rem] normal-case text-[var(--text-muted)]">
              {checklist.avaliado?.nome} · {checklist.unidades?.nome} ·{' '}
              {new Date(`${checklist.data}T12:00:00`).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <p className="text-[.72rem] normal-case text-[var(--text-muted)]">
            Preenchido por {checklist.avaliador?.nome ?? '—'}
          </p>

          <div className="flex flex-col gap-3">
            {itens.map((item) => (
              <div key={item.id} className="card sec-pad flex flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="normal-case text-[.85rem] text-white">
                    {item.ordem + 1}. {item.pergunta}
                  </p>
                  <span className={`badge ${item.resposta ? 'badge-aprovado' : 'badge-rejeitado'}`}>
                    {item.resposta ? 'Sim' : 'Não'}
                  </span>
                </div>
                {item.observacao && (
                  <p className="whitespace-pre-wrap normal-case text-[.78rem] text-[var(--text-muted)]">
                    {item.observacao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
