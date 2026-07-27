import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mesAtualISO, mesRange } from '@/lib/metas'

type MetaRow = { escopo: string; unidade_id: string | null; consultor_id: string | null; valor_meta: number }
type VendaMin = { consultor_id: string; unidade_id: string | null }
type Unidade = { id: string; nome: string }
type Profile = { id: string; nome: string; unidade_id: string | null }

// Placar da "Corrida da Meta": progresso de vendas do mês por loja e por
// consultor. É um leaderboard visível pra todo mundo, mas o RLS de `vendas`
// deixa o consultor ver só as próprias — então os agregados vêm pelo service
// role (createAdminClient), e devolvemos apenas contagens (nada sensível).
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const mes = mesAtualISO()
  const { inicio, fim } = mesRange(mes)

  const [unidadesRes, profilesRes, metasRes, vendasRes] = await Promise.all([
    admin.from('unidades').select('id, nome').order('nome'),
    admin
      .from('profiles')
      .select('id, nome, unidade_id')
      .eq('ativo', true)
      .neq('cargo', 'visualizador')
      .order('nome'),
    admin
      .from('metas')
      .select('escopo, unidade_id, consultor_id, valor_meta')
      .eq('tipo', 'vendas')
      .eq('periodo', mes),
    admin
      .from('vendas')
      .select('consultor_id, unidade_id')
      .eq('status', 'ativa')
      .gte('data', inicio)
      .lt('data', fim),
  ])

  const todasUnidades = (unidadesRes.data ?? []) as Unidade[]
  const todosProfiles = (profilesRes.data ?? []) as Profile[]
  const metas = (metasRes.data ?? []) as MetaRow[]
  const vendas = (vendasRes.data ?? []) as VendaMin[]

  // A Corrida da Meta é a competição da empresa inteira: mostra todas as lojas
  // e TODOS os consultores pra todo mundo (o corte por unidade fica só na lista
  // de vendas do /metas, não aqui).
  const unidades = todasUnidades
  const profiles = todosProfiles

  const metaUnidade = new Map<string, number>()
  const metaConsultor = new Map<string, number>()
  for (const m of metas) {
    if (m.escopo === 'unidade' && m.unidade_id) metaUnidade.set(m.unidade_id, m.valor_meta)
    if (m.escopo === 'consultor' && m.consultor_id) metaConsultor.set(m.consultor_id, m.valor_meta)
  }

  const realUnidade = new Map<string, number>()
  const realConsultor = new Map<string, number>()
  for (const v of vendas) {
    if (v.unidade_id) realUnidade.set(v.unidade_id, (realUnidade.get(v.unidade_id) ?? 0) + 1)
    realConsultor.set(v.consultor_id, (realConsultor.get(v.consultor_id) ?? 0) + 1)
  }

  const lojas = unidades
    .map((u) => ({ nome: u.nome, realizado: realUnidade.get(u.id) ?? 0, meta: metaUnidade.get(u.id) ?? 0 }))
    .filter((l) => l.meta > 0 || l.realizado > 0)

  const consultores = profiles
    .map((p) => ({ nome: p.nome, realizado: realConsultor.get(p.id) ?? 0, meta: metaConsultor.get(p.id) ?? 0 }))
    .filter((c) => c.meta > 0 || c.realizado > 0)
    .sort((a, b) => b.realizado - a.realizado)

  return NextResponse.json({ lojas, consultores })
}
