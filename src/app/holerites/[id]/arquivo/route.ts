import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { marcarVisualizado } from '../../actions'

// Serve o PDF do holerite via URL assinada (bucket é privado). Se for o
// próprio colaborador abrindo, registra o evento "visualizado" antes de
// redirecionar — só na primeira vez (marcarVisualizado já checa o status).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: profile } = await supabase
    .from('profiles')
    .select('gerencia_holerites')
    .eq('id', user.id)
    .single<{ gerencia_holerites: boolean }>()
  const gerenciaHolerites = profile?.gerencia_holerites ?? false

  const { data: holerite } = await supabase
    .from('holerites')
    .select('id, colaborador_id, arquivo_path')
    .eq('id', id)
    .maybeSingle<{ id: string; colaborador_id: string; arquivo_path: string }>()

  if (!holerite || (!gerenciaHolerites && holerite.colaborador_id !== user.id)) {
    return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }

  if (!gerenciaHolerites) {
    await marcarVisualizado(holerite.id, user.id)
  }

  const admin = createAdminClient()
  const { data: signed, error } = await admin.storage
    .from('holerites')
    .createSignedUrl(holerite.arquivo_path, 60)

  if (error || !signed) {
    return NextResponse.json({ error: 'não foi possível abrir o arquivo' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
