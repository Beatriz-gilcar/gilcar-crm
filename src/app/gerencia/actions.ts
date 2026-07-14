'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { perguntasPorTipo } from '@/lib/checklists'

export async function createChecklist(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tipo = formData.get('tipo') as string
  const avaliado_id = formData.get('avaliado_id') as string
  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)

  const perguntas = perguntasPorTipo[tipo]

  if (!tipo || !perguntas || !avaliado_id) {
    redirect(`/gerencia/new?tipo=${tipo ?? ''}&error=${encodeURIComponent('Preencha o gerente avaliado')}`)
  }

  const { data: avaliado } = await supabase
    .from('profiles')
    .select('unidade_id')
    .eq('id', avaliado_id)
    .single<{ unidade_id: string | null }>()

  if (!avaliado?.unidade_id) {
    redirect(`/gerencia/new?tipo=${tipo}&error=${encodeURIComponent('Gerente avaliado sem unidade definida')}`)
  }

  const itens = perguntas.map((pergunta, i) => {
    const resposta = formData.get(`resposta_${i}`) === 'sim'
    const observacao = (formData.get(`observacao_${i}`) as string)?.trim() || null
    return { ordem: i, pergunta, resposta, observacao }
  })

  const totalSim = itens.filter((item) => item.resposta).length
  const percentual_sim = Number(((totalSim / itens.length) * 100).toFixed(2))

  const { data: checklist, error } = await supabase
    .from('checklists_gerencia')
    .insert({
      tipo,
      avaliado_id,
      avaliador_id: user.id,
      unidade_id: avaliado!.unidade_id,
      data,
      percentual_sim,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !checklist) {
    redirect(`/gerencia/new?tipo=${tipo}&error=${encodeURIComponent('Não foi possível salvar o checklist')}`)
  }

  const { error: itensError } = await supabase
    .from('checklist_itens')
    .insert(itens.map((item) => ({ ...item, checklist_id: checklist!.id })))

  if (itensError) {
    redirect(`/gerencia/new?tipo=${tipo}&error=${encodeURIComponent('Checklist criado, mas os itens falharam')}`)
  }

  revalidatePath('/gerencia')
  redirect(`/gerencia/${checklist!.id}`)
}
