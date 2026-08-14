import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isGerenciaCargo } from '@/lib/membros'

type PostRow = { id: string; tipo: string; titulo: string; autor_id: string; profiles: { nome: string } | null }

// Avisa gerência/admin de posts novos no Mural (dúvidas e sugestões) — usado
// pelo widget flutuante MuralAlertWidget. Só últimas 24h, pra não pesar a
// consulta nem re-listar coisa antiga; o widget filtra o que já foi visto
// dentro disso via localStorage.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ posts: [] })

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()

  if (!isGerenciaCargo(profile?.cargo)) return NextResponse.json({ posts: [] })

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('mural_posts')
    .select('id, tipo, titulo, autor_id, profiles(nome)')
    .gte('created_at', desde)
    .neq('autor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
    .overrideTypes<PostRow[]>()

  const posts = (data ?? []).map((p) => ({
    id: p.id,
    tipo: p.tipo,
    titulo: p.titulo,
    autor: p.profiles?.nome ?? '—',
  }))

  return NextResponse.json({ posts })
}
