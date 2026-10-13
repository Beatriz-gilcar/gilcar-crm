'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SupaClient = Awaited<ReturnType<typeof createClient>>

// Mesma regra de pode_financeiro() no banco (flag por pessoa + admin) —
// defesa em profundidade, a RLS já barra isso também.
async function soFinanceiro(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase
    .from('profiles')
    .select('cargo, acesso_financeiro')
    .eq('id', user.id)
    .single<{ cargo: string; acesso_financeiro: boolean }>()
  if (p?.cargo !== 'admin' && !p?.acesso_financeiro) {
    redirect('/')
  }
  return user
}

export async function iniciarContagem(formData: FormData) {
  const supabase = await createClient()
  const user = await soFinanceiro(supabase)
  const unidade_id = formData.get('unidade_id') as string

  if (!unidade_id) {
    redirect(`/estoque/contagem?error=${encodeURIComponent('Escolha a unidade')}`)
  }

  // Já tem contagem aberta pra essa unidade? Reaproveita em vez de duplicar.
  const { data: aberta } = await supabase
    .from('estoque_contagens')
    .select('id')
    .eq('unidade_id', unidade_id)
    .eq('concluida', false)
    .maybeSingle<{ id: string }>()

  if (aberta) {
    redirect(`/estoque/contagem/${aberta.id}`)
  }

  const { data: contagem, error } = await supabase
    .from('estoque_contagens')
    .insert({ unidade_id, criado_por: user.id, concluida: false })
    .select('id')
    .single<{ id: string }>()

  if (error?.code === '23505') {
    // UNIQUE (unidade_id, data): já existe uma contagem de hoje pra essa
    // unidade, só que finalizada (a aberta já foi tratada acima) — abre ela
    // em vez de travar numa mensagem de erro sem saída.
    const { data: existente } = await supabase
      .from('estoque_contagens')
      .select('id')
      .eq('unidade_id', unidade_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>()
    if (existente) {
      redirect(`/estoque/contagem/${existente.id}`)
    }
  }

  if (error || !contagem) {
    redirect(`/estoque/contagem?error=${encodeURIComponent('Não foi possível iniciar a contagem')}`)
  }

  // Snapshot: um item por veículo disponível/reservado da unidade, no
  // momento em que a contagem abre.
  const { data: veiculos } = await supabase
    .from('veiculos')
    .select('id')
    .eq('unidade_id', unidade_id)
    .in('status', ['disponivel', 'reservado'])
    .overrideTypes<{ id: string }[]>()

  if (veiculos && veiculos.length > 0) {
    await supabase.from('estoque_contagem_itens').insert(
      veiculos.map((v) => ({
        contagem_id: contagem!.id,
        veiculo_id: v.id,
        conferido: false,
      }))
    )
  }

  revalidatePath('/estoque/contagem')
  redirect(`/estoque/contagem/${contagem!.id}`)
}

export async function marcarItemContagem(formData: FormData) {
  const supabase = await createClient()
  await soFinanceiro(supabase)

  const item_id = formData.get('item_id') as string
  const contagem_id = formData.get('contagem_id') as string
  const conferido = formData.get('conferido') === 'sim'
  const observacao = (formData.get('observacao') as string)?.trim() || null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('estoque_contagem_itens')
    .update({
      conferido,
      observacao,
      conferido_por: conferido ? user?.id ?? null : null,
      conferido_em: conferido ? new Date().toISOString() : null,
    })
    .eq('id', item_id)

  if (error) {
    redirect(`/estoque/contagem/${contagem_id}?error=${encodeURIComponent('Não foi possível salvar')}`)
  }

  revalidatePath(`/estoque/contagem/${contagem_id}`)
  redirect(`/estoque/contagem/${contagem_id}`)
}

export async function finalizarContagem(formData: FormData) {
  const supabase = await createClient()
  await soFinanceiro(supabase)
  const contagem_id = formData.get('contagem_id') as string

  const { error } = await supabase.from('estoque_contagens').update({ concluida: true }).eq('id', contagem_id)

  if (error) {
    redirect(`/estoque/contagem/${contagem_id}?error=${encodeURIComponent('Não foi possível finalizar')}`)
  }

  revalidatePath('/estoque/contagem')
  revalidatePath(`/estoque/contagem/${contagem_id}`)
  redirect(`/estoque/contagem/${contagem_id}`)
}
