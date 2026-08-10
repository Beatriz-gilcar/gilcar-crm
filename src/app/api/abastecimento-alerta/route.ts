import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agoraNaLoja } from '@/lib/datas'

// Diz pro gerente logado se hoje é véspera ou o próprio dia de abastecimento
// da unidade dele — usado pelo widget flutuante (AbastecimentoAlertWidget).
// Os dois alertam o dia inteiro (não só de manhã): gerente que só abre o
// sistema à tarde não pode ficar sem o aviso.

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo, unidade_id')
    .eq('id', user.id)
    .single<{ cargo: string; unidade_id: string | null }>()

  if (profile?.cargo !== 'gerente' || !profile.unidade_id) {
    return NextResponse.json({ alerta: null })
  }

  const { data: config } = await supabase
    .from('abastecimento_config')
    .select('dia_semana, unidades(nome)')
    .eq('unidade_id', profile.unidade_id)
    .maybeSingle<{ dia_semana: number; unidades: { nome: string } | null }>()

  if (!config) return NextResponse.json({ alerta: null })

  const agora = agoraNaLoja()
  const diaHoje = agora.getUTCDay()
  const unidade = config.unidades?.nome ?? ''

  if (diaHoje === config.dia_semana) {
    return NextResponse.json({ alerta: { tipo: 'hoje', unidade } })
  }
  if (diaHoje === (config.dia_semana - 1 + 7) % 7) {
    return NextResponse.json({ alerta: { tipo: 'amanha', unidade } })
  }
  return NextResponse.json({ alerta: null })
}
