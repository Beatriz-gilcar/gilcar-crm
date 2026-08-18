'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseBRL } from '@/lib/mask'

function texto(formData: FormData, key: string): string | null {
  return (formData.get(key) as string)?.trim() || null
}

function voltar(data: string, erro?: string) {
  const qs = new URLSearchParams({ data })
  if (erro) qs.set('error', erro)
  redirect(`/pos-venda/lancamentos?${qs.toString()}`)
}

export async function criarLancamentoPosVenda(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)
  const descricao = texto(formData, 'descricao')
  const fornecedor = texto(formData, 'fornecedor')
  const valor = parseBRL((formData.get('valor') as string) ?? '')

  if (!descricao || !fornecedor || valor <= 0) {
    voltar(data, 'Preencha descrição, fornecedor e um valor maior que zero')
  }

  const { error } = await supabase.from('pos_venda_lancamentos').insert({
    data,
    veiculo_placa: texto(formData, 'veiculo_placa')?.toUpperCase() ?? null,
    descricao,
    fornecedor,
    valor,
    observacao: texto(formData, 'observacao'),
    criado_por: user.id,
  })

  if (error) {
    voltar(data, 'Não foi possível lançar')
  }

  revalidatePath('/pos-venda/lancamentos')
  voltar(data)
}

export async function atualizarLancamentoPosVenda(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string
  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)
  const descricao = texto(formData, 'descricao')
  const fornecedor = texto(formData, 'fornecedor')
  const valor = parseBRL((formData.get('valor') as string) ?? '')

  if (!descricao || !fornecedor || valor <= 0) {
    voltar(data, 'Preencha descrição, fornecedor e um valor maior que zero')
  }

  const { error } = await supabase
    .from('pos_venda_lancamentos')
    .update({
      veiculo_placa: texto(formData, 'veiculo_placa')?.toUpperCase() ?? null,
      descricao,
      fornecedor,
      valor,
      observacao: texto(formData, 'observacao'),
    })
    .eq('id', id)

  if (error) {
    voltar(data, 'Não foi possível salvar a edição')
  }

  revalidatePath('/pos-venda/lancamentos')
  voltar(data)
}

export async function excluirLancamentoPosVenda(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const data = formData.get('data') as string

  const { error } = await supabase.from('pos_venda_lancamentos').delete().eq('id', id)

  if (error) {
    voltar(data, 'Não foi possível excluir o lançamento')
  }

  revalidatePath('/pos-venda/lancamentos')
  voltar(data)
}
