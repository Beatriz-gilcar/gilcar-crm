'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function num(formData: FormData, key: string): number {
  const raw = (formData.get(key) as string)?.trim()
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export async function createVenda(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const consultor_id = (formData.get('consultor_id') as string) || user!.id
  const unidade_id = formData.get('unidade_id') as string
  const veiculo_marca = (formData.get('veiculo_marca') as string)?.trim()
  const veiculo_modelo = (formData.get('veiculo_modelo') as string)?.trim()
  const veiculo_placa = (formData.get('veiculo_placa') as string)?.trim().toUpperCase() || null
  const valor = num(formData, 'valor')
  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)
  const observacao = (formData.get('observacao') as string)?.trim() || null

  if (!unidade_id || !veiculo_marca || !veiculo_modelo || valor <= 0) {
    redirect(`/metas/new?error=${encodeURIComponent('Preencha unidade, veículo e valor')}`)
  }

  const { error } = await supabase.from('vendas').insert({
    consultor_id,
    unidade_id,
    veiculo_marca,
    veiculo_modelo,
    veiculo_placa,
    valor,
    data,
    observacao,
  })

  if (error) {
    redirect(`/metas/new?error=${encodeURIComponent('Não foi possível lançar a venda')}`)
  }

  revalidatePath('/metas')
  redirect('/metas')
}

export async function toggleVendaStatus(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const statusAtual = formData.get('status_atual') as string
  const novoStatus = statusAtual === 'ativa' ? 'caida' : 'ativa'

  const { error } = await supabase.from('vendas').update({ status: novoStatus }).eq('id', id)

  if (error) {
    redirect(`/metas?error=${encodeURIComponent('Não foi possível atualizar o status')}`)
  }

  revalidatePath('/metas')
  redirect('/metas')
}

export async function deleteVenda(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('vendas').delete().eq('id', id)

  if (error) {
    redirect(`/metas?error=${encodeURIComponent('Não foi possível excluir a venda')}`)
  }

  revalidatePath('/metas')
  redirect('/metas')
}

export async function createVendaProtecao(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const consultor_id = (formData.get('consultor_id') as string) || user!.id
  const unidade_id = formData.get('unidade_id') as string
  const descricao = (formData.get('descricao') as string)?.trim()
  const valor = num(formData, 'valor')
  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)
  const observacao = (formData.get('observacao') as string)?.trim() || null

  if (!unidade_id || !descricao || valor <= 0) {
    redirect(`/metas/protecao/new?error=${encodeURIComponent('Preencha unidade, descrição e valor')}`)
  }

  const { error } = await supabase.from('vendas_protecao').insert({
    consultor_id,
    unidade_id,
    descricao,
    valor,
    data,
    observacao,
  })

  if (error) {
    redirect(`/metas/protecao/new?error=${encodeURIComponent('Não foi possível lançar a proteção')}`)
  }

  revalidatePath('/metas/protecao')
  redirect('/metas/protecao')
}

export async function toggleVendaProtecaoStatus(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const statusAtual = formData.get('status_atual') as string
  const novoStatus = statusAtual === 'ativa' ? 'caida' : 'ativa'

  const { error } = await supabase.from('vendas_protecao').update({ status: novoStatus }).eq('id', id)

  if (error) {
    redirect(`/metas/protecao?error=${encodeURIComponent('Não foi possível atualizar o status')}`)
  }

  revalidatePath('/metas/protecao')
  redirect('/metas/protecao')
}

export async function deleteVendaProtecao(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('vendas_protecao').delete().eq('id', id)

  if (error) {
    redirect(`/metas/protecao?error=${encodeURIComponent('Não foi possível excluir')}`)
  }

  revalidatePath('/metas/protecao')
  redirect('/metas/protecao')
}

export async function definirMeta(formData: FormData) {
  const supabase = await createClient()

  const tipo = formData.get('tipo') as string
  const escopo = formData.get('escopo') as string
  const unidade_id = escopo === 'unidade' ? (formData.get('unidade_id') as string) : null
  const consultor_id = escopo === 'consultor' ? (formData.get('consultor_id') as string) : null
  const periodo = formData.get('periodo') as string
  const valor_meta = num(formData, 'valor_meta')
  const valor_super_meta_raw = (formData.get('valor_super_meta') as string)?.trim()
  const valor_super_meta = valor_super_meta_raw ? Number(valor_super_meta_raw) : null

  if (!tipo || !escopo || !periodo || valor_meta <= 0 || (escopo === 'unidade' && !unidade_id) || (escopo === 'consultor' && !consultor_id)) {
    redirect(`/metas/definir?tipo=${tipo}&error=${encodeURIComponent('Preencha escopo, período e valor da meta')}`)
  }

  let existingQuery = supabase.from('metas').select('id').eq('tipo', tipo).eq('escopo', escopo).eq('periodo', periodo)
  existingQuery = escopo === 'unidade' ? existingQuery.eq('unidade_id', unidade_id) : existingQuery
  existingQuery = escopo === 'consultor' ? existingQuery.eq('consultor_id', consultor_id) : existingQuery
  const { data: existing } = await existingQuery.maybeSingle<{ id: string }>()

  if (existing) {
    await supabase.from('metas').delete().eq('id', existing.id)
  }

  const { error } = await supabase.from('metas').insert({
    tipo,
    escopo,
    unidade_id,
    consultor_id,
    periodo,
    valor_meta,
    valor_super_meta,
  })

  if (error) {
    redirect(`/metas/definir?tipo=${tipo}&error=${encodeURIComponent('Não foi possível salvar a meta')}`)
  }

  revalidatePath('/metas')
  revalidatePath('/metas/definir')
  redirect(`/metas/definir?tipo=${tipo}&success=1`)
}
