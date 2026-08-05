import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Tarefas da rotina marcadas como "Destacar" (bater ponto, preparar
// fechamento, etc.) que ainda não foram feitas hoje na loja do usuário —
// usado pelo widget flutuante que avisa quando chega a hora de cada uma.
// Sem loja fixa (Junior, admin "Todas as unidades") não há uma rotina única
// pra seguir, então não alerta ninguém nesse caso.

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('unidade_id')
    .eq('id', user.id)
    .single<{ unidade_id: string | null }>()

  if (!profile?.unidade_id) {
    return NextResponse.json({ alertas: [] })
  }

  const { data: itensData } = await supabase
    .from('rotina_itens')
    .select('id, hora, tarefa, rotina_marcacoes(data)')
    .eq('unidade_id', profile.unidade_id)
    .eq('ativo', true)
    .eq('destaque', true)
    .order('hora')
    .overrideTypes<{ id: string; hora: string; tarefa: string; rotina_marcacoes: { data: string }[] }[]>()

  const hoje = hojeISO()
  const alertas = (itensData ?? [])
    .filter((i) => !i.rotina_marcacoes.some((m) => m.data === hoje))
    .map((i) => ({ id: i.id, hora: i.hora, tarefa: i.tarefa }))

  return NextResponse.json({ alertas })
}
