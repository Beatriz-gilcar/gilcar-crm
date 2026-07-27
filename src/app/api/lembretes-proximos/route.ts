import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lembretes do próprio usuário que estão perto de vencer (últimas 2h + próximas
// 24h), pendentes e com horário. O "vigia" no cliente usa isso pra alertar na
// hora. Filtramos por consultor_id porque o alerta é pra quem criou o lembrete.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const agora = Date.now()
  const inicio = new Date(agora - 2 * 60 * 60 * 1000).toISOString()
  const fim = new Date(agora + 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('lembretes')
    .select('id, titulo, data_vencimento')
    .eq('consultor_id', user.id)
    .eq('concluido', false)
    .not('data_vencimento', 'is', null)
    .gte('data_vencimento', inicio)
    .lt('data_vencimento', fim)
    .order('data_vencimento', { ascending: true })

  return NextResponse.json({ lembretes: data ?? [] })
}
