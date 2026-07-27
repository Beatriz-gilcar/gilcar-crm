import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lembretes do próprio usuário — usados pelo widget flutuante (listar/criar).
// Alerta é de quem criou, então tudo é filtrado por consultor_id = user.id.

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { data } = await supabase
    .from('lembretes')
    .select('id, titulo, data_vencimento, concluido')
    .eq('consultor_id', user.id)
    .eq('concluido', false)
    .order('data_vencimento', { ascending: true, nullsFirst: false })

  return NextResponse.json({ lembretes: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { titulo?: string; data_vencimento?: string }
  const titulo = body.titulo?.trim()
  if (!titulo) return NextResponse.json({ error: 'informe o título' }, { status: 400 })

  // data_vencimento vem como "YYYY-MM-DDTHH:MM" (local do Brasil); ancora -03:00.
  const raw = body.data_vencimento?.trim() || ''
  const dataVencimento = raw
    ? new Date(`${raw.length === 16 ? `${raw}:00` : raw}-03:00`).toISOString()
    : null

  const { error } = await supabase.from('lembretes').insert({
    titulo,
    data_vencimento: dataVencimento,
    consultor_id: user.id,
  })
  if (error) return NextResponse.json({ error: 'não foi possível salvar' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
