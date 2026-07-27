import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Concluir (PATCH) ou excluir (DELETE) um lembrete próprio. O RLS já garante
// que só mexe nos do próprio usuário.
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { error } = await supabase
    .from('lembretes')
    .update({ concluido: true, concluido_em: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'falhou' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { error } = await supabase.from('lembretes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'falhou' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
