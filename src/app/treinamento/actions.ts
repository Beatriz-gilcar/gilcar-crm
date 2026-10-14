'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isGerenciaCargo } from '@/lib/membros'

type SupaClient = Awaited<ReturnType<typeof createClient>>

// Defesa em profundidade — a RLS já só deixa gerência escrever; isso aqui dá
// a mensagem certa e, abaixo, restringe por unidade (que a RLS não faz).
async function soGerencia(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase
    .from('profiles')
    .select('cargo, unidade_id')
    .eq('id', user.id)
    .single<{ cargo: string; unidade_id: string | null }>()
  if (!isGerenciaCargo(p?.cargo)) {
    redirect(`/treinamento?error=${encodeURIComponent('Só a gerência marca etapas do treinamento')}`)
  }
  return { user, cargo: p?.cargo ?? null, unidade_id: p?.unidade_id ?? null }
}

export async function marcarEtapaTreinamento(formData: FormData) {
  const supabase = await createClient()
  const { user, cargo, unidade_id } = await soGerencia(supabase)

  const consultor_id = formData.get('consultor_id') as string
  const etapa = formData.get('etapa') as string
  const concluido = formData.get('concluido') === 'on'

  // Gerente/supervisor só mexe na própria unidade; admin mexe em qualquer
  // uma. Mesmo padrão de unidadeGerente usado nas páginas de listagem.
  if (cargo !== 'admin') {
    const { data: consultor } = await supabase
      .from('profiles')
      .select('unidade_id')
      .eq('id', consultor_id)
      .single<{ unidade_id: string | null }>()
    if (consultor?.unidade_id !== unidade_id) {
      redirect(`/treinamento?error=${encodeURIComponent('Fora da sua unidade')}`)
    }
  }

  if (concluido) {
    const { error } = await supabase
      .from('treinamento_progresso')
      .upsert(
        { consultor_id, etapa, concluido_por: user.id, concluido_em: new Date().toISOString() },
        { onConflict: 'consultor_id,etapa' }
      )
    if (error) {
      redirect(`/treinamento/${consultor_id}?error=${encodeURIComponent('Não foi possível salvar')}`)
    }
  } else {
    const { error } = await supabase
      .from('treinamento_progresso')
      .delete()
      .eq('consultor_id', consultor_id)
      .eq('etapa', etapa)
    if (error) {
      redirect(`/treinamento/${consultor_id}?error=${encodeURIComponent('Não foi possível salvar')}`)
    }
  }

  revalidatePath('/treinamento')
  revalidatePath(`/treinamento/${consultor_id}`)
  redirect(`/treinamento/${consultor_id}`)
}
