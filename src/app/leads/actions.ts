'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createLead(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo, unidade_id')
    .eq('id', user.id)
    .single<{ cargo: string; unidade_id: string | null }>()

  const isGerencia = profile?.cargo === 'admin' || profile?.cargo === 'gerente'
  const nome = (formData.get('nome') as string)?.trim()
  const observacoes = (formData.get('observacoes') as string)?.trim() || null
  const unidadeId = isGerencia ? (formData.get('unidade_id') as string) : profile?.unidade_id

  if (!nome) {
    redirect(`/leads/new?error=${encodeURIComponent('Informe o nome do lead')}`)
  }

  if (!unidadeId) {
    redirect(`/leads/new?error=${encodeURIComponent('Selecione a unidade')}`)
  }

  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({ nome, observacoes, unidade_id: unidadeId, consultor_id: user.id })
    .select('id')
    .single<{ id: string }>()

  if (error || !cliente) {
    redirect(`/leads/new?error=${encodeURIComponent('Não foi possível salvar o lead')}`)
  }

  const contatosInformados = [
    { tipo: 'celular', valor: (formData.get('celular') as string)?.trim() },
    { tipo: 'whatsapp', valor: (formData.get('whatsapp') as string)?.trim() },
    { tipo: 'email', valor: (formData.get('email') as string)?.trim() },
  ].filter((c) => c.valor)

  if (contatosInformados.length > 0) {
    await supabase.from('contatos').insert(
      contatosInformados.map((c, i) => ({
        cliente_id: cliente.id,
        tipo: c.tipo,
        valor: c.valor,
        principal: i === 0,
      }))
    )
  }

  revalidatePath('/leads')
  redirect(`/leads/${cliente.id}`)
}

export async function createAtendimento(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const clienteId = formData.get('cliente_id') as string
  const tipo = formData.get('tipo') as string
  const clienteNome = (formData.get('cliente_nome') as string)?.trim() || null
  const celular = (formData.get('celular') as string)?.trim() || null
  const veiculoInteresse = (formData.get('veiculo_interesse') as string)?.trim() || null
  const observacao = (formData.get('observacao') as string)?.trim() || null
  const origem = (formData.get('origem') as string) || null

  if (!clienteNome && !celular && !veiculoInteresse) {
    redirect(
      `/leads/${clienteId}?error=${encodeURIComponent('Preencha pelo menos um campo do atendimento antes de enviar')}`
    )
  }

  const payload: Record<string, unknown> = {
    cliente_id: clienteId,
    consultor_id: user.id,
    tipo,
    cliente_nome: clienteNome,
    celular,
    veiculo_interesse: veiculoInteresse,
    observacao,
    origem,
  }

  if (tipo === 'presencial') {
    payload.cv = (formData.get('cv') as string) || null
    payload.fechou_negocio = formData.get('fechou_negocio') === 'sim'
  } else {
    payload.agendou_visita = formData.get('agendou_visita') === 'sim'
  }

  const { error } = await supabase.from('atendimentos').insert(payload)

  if (error) {
    redirect(
      `/leads/${clienteId}?error=${encodeURIComponent('Não foi possível registrar o atendimento')}`
    )
  }

  revalidatePath(`/leads/${clienteId}`)
  redirect(`/leads/${clienteId}`)
}
