import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/Topbar'
import { EditarListaVendas } from '@/components/EditarListaVendas'
import { mesAtualISO, mesRange, mesLabel } from '@/lib/metas'
import { isGerenciaCargo, podeVerTudo } from '@/lib/membros'
import { salvarListaVendas } from '../actions'

type ProfileSummary = { nome: string; cargo: string }
type Membro = { id: string; nome: string; unidades: { nome: string } | null }
type Unidade = { id: string; nome: string }
type VendaRow = {
  id: string
  consultor_id: string
  unidade_id: string | null
  veiculo_modelo: string
  status: string
  tipo: string
}

export default async function EditarListaPage({
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
    .select('nome, cargo')
    .eq('id', user.id)
    .single<ProfileSummary>()

  const isGerencia = isGerenciaCargo(profile?.cargo)
  const verTudo = podeVerTudo(profile?.cargo)
  const isAdmin = profile?.cargo === 'admin'

  // Só o admin edita a lista.
  if (!isAdmin) {
    redirect('/metas')
  }

  const { inicio, fim } = mesRange(mes)

  const [vendasRes, membrosRes, unidadesRes] = await Promise.all([
    supabase
      .from('vendas')
      .select('id, consultor_id, unidade_id, veiculo_modelo, status, tipo')
      .gte('data', inicio)
      .lt('data', fim)
      .order('posicao', { ascending: true, nullsFirst: false })
      .order('numero_sequencial', { ascending: true })
      .overrideTypes<VendaRow[]>(),
    supabase
      .from('profiles')
      .select('id, nome, unidades(nome)')
      .eq('ativo', true)
      .neq('cargo', 'visualizador')
      .order('nome')
      .overrideTypes<Membro[]>(),
    supabase.from('unidades').select('id, nome').order('nome').overrideTypes<Unidade[]>(),
  ])

  const linhasIniciais = (vendasRes.data ?? []).map((v) => ({
    id: v.id,
    consultor_id: v.consultor_id,
    unidade_id: v.unidade_id,
    veiculo: v.veiculo_modelo,
    status: v.status,
    tipo: v.tipo,
  }))
  const membros = (membrosRes.data ?? []).map((m) => ({
    id: m.id,
    nome: m.nome,
    unidadeNome: m.unidades?.nome ?? 'Todas',
  }))
  const unidades = unidadesRes.data ?? []

  return (
    <>
      <Topbar
        nome={profile?.nome ?? user.email ?? ''}
        cargo={profile?.cargo ?? ''}
        verTudo={verTudo}
        isAdmin={isAdmin}
        active="metas"
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="sec-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              Editar lista de vendas — {mesLabel(mes)}
            </div>
            <Link href={`/metas?mes=${mes}`} className="btn btn-outline btn-sm">
              ← Voltar
            </Link>
          </div>

          {error && (
            <p className="mt-2 rounded-2xl bg-[var(--danger-soft)] px-3 py-2 text-[.78rem] normal-case text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="mt-4">
            <EditarListaVendas
              mes={mes}
              membros={membros}
              unidades={unidades}
              linhasIniciais={linhasIniciais}
              action={salvarListaVendas}
            />
          </div>
        </div>
      </div>
    </>
  )
}
