import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lembretes do próprio usuário — usados pelo widget flutuante (listar/criar).
// Alerta é de quem criou, então tudo é filtrado por consultor_id = user.id.
// Admin, além dos seus, pode mandar lembrete pra outra pessoa ou grupo — mesma
// lógica de /lembretes/new, só que embutida aqui pro widget flutuante.

type Pessoa = { id: string; nome: string; cargo: string }

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()
  const isAdmin = profile?.cargo === 'admin'

  let gerentes: Pessoa[] = []
  let consultores: Pessoa[] = []
  if (isAdmin) {
    const { data: pessoasData } = await supabase
      .from('profiles')
      .select('id, nome, cargo')
      .in('cargo', ['gerente', 'supervisor', 'consultor'])
      .eq('ativo', true)
      .order('nome')
      .overrideTypes<Pessoa[]>()
    const pessoas = pessoasData ?? []
    gerentes = pessoas.filter((p) => p.cargo === 'gerente' || p.cargo === 'supervisor')
    consultores = pessoas.filter((p) => p.cargo === 'consultor')
  }

  return NextResponse.json({ lembretes: data ?? [], isAdmin, gerentes, consultores })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    titulo?: string
    data_vencimento?: string
    destino?: string
  }
  const titulo = body.titulo?.trim()
  if (!titulo) return NextResponse.json({ error: 'informe o título' }, { status: 400 })

  // data_vencimento vem como "YYYY-MM-DDTHH:MM" (local do Brasil); ancora -03:00.
  const raw = body.data_vencimento?.trim() || ''
  const dataVencimento = raw
    ? new Date(`${raw.length === 16 ? `${raw}:00` : raw}-03:00`).toISOString()
    : null

  // "destino" (mandar pra outra pessoa ou grupo inteiro) só vale pro admin —
  // ignora o campo pra qualquer outro cargo, mesmo que alguém mexa na chamada.
  let destinatarios: string[] = [user.id]
  const destino = body.destino?.trim() || ''
  if (destino) {
    const { data: profile } = await supabase.from('profiles').select('cargo').eq('id', user.id).single<{ cargo: string }>()
    if (profile?.cargo === 'admin') {
      if (destino.startsWith('pessoa:')) {
        destinatarios = [destino.slice('pessoa:'.length)]
      } else if (destino === 'grupo:gerente') {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .in('cargo', ['gerente', 'supervisor'])
          .eq('ativo', true)
          .overrideTypes<{ id: string }[]>()
        destinatarios = (data ?? []).map((p) => p.id)
      } else if (destino === 'grupo:consultor') {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('cargo', 'consultor')
          .eq('ativo', true)
          .overrideTypes<{ id: string }[]>()
        destinatarios = (data ?? []).map((p) => p.id)
      }
    }
  }

  if (destinatarios.length === 0) {
    return NextResponse.json({ error: 'nenhum destinatário encontrado pro grupo escolhido' }, { status: 400 })
  }

  const { error } = await supabase.from('lembretes').insert(
    destinatarios.map((consultor_id) => ({
      titulo,
      data_vencimento: dataVencimento,
      consultor_id,
    }))
  )
  if (error) return NextResponse.json({ error: 'não foi possível salvar' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
