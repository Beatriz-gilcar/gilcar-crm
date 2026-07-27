'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { mesRange } from '@/lib/metas'
import { isGerenciaCargo } from '@/lib/membros'

type SupaClient = Awaited<ReturnType<typeof createClient>>

// Toda edição de vendas (lançar, marcar caída, excluir, editar lista) é só do
// admin — gerente e consultor apenas visualizam. Trava no servidor pra não dar
// pra burlar escondendo o botão (o RLS deixaria gerência/consultor editar).
async function soAdmin(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()
  if (p?.cargo !== 'admin') {
    redirect(`/metas?error=${encodeURIComponent('Só o admin pode lançar venda ou editar a lista')}`)
  }
  return user
}

// Marcar "enviado no Autocerto" é mais leve que editar a venda em si: admin
// e gerência (gerente/supervisor) podem, pra não depender só do admin pra
// manter isso em dia.
async function soGerencia(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()
  if (!isGerenciaCargo(p?.cargo)) {
    redirect(`/metas?error=${encodeURIComponent('Só admin ou gerência marcam o Autocerto')}`)
  }
  return user
}

type LinhaVenda = {
  id?: string
  consultor_id: string
  unidade_id?: string | null
  veiculo: string
  status?: string
  tipo?: string
}

// Salva a "lista de vendas do mês" inteira de uma vez (tela Editar lista):
// renumera 1..N pela ordem enviada, cria as novas, edita as existentes e apaga
// as que foram removidas. É a réplica do "Salvar lista" do sistema antigo.
export async function salvarListaVendas(formData: FormData) {
  const supabase = await createClient()
  await soAdmin(supabase)
  const mes = (formData.get('mes') as string) || ''
  const raw = (formData.get('rows') as string) || '[]'

  let linhas: LinhaVenda[]
  try {
    linhas = JSON.parse(raw)
  } catch {
    redirect(`/metas/editar?mes=${mes}&error=${encodeURIComponent('Erro ao ler a lista')}`)
  }
  linhas = linhas.filter((l) => l.consultor_id && l.veiculo?.trim())

  const { inicio, fim } = mesRange(mes)

  // Unidade padrão de cada vendedor (pra resolver a loja quando não escolhida).
  const consultorIds = [...new Set(linhas.map((l) => l.consultor_id))]
  const { data: profs } = await supabase.from('profiles').select('id, unidade_id').in('id', consultorIds)
  const unidadeDe = new Map((profs ?? []).map((p) => [p.id, p.unidade_id as string | null]))

  // Vendas do mês que já existem — as que sumiram da lista serão apagadas.
  const { data: existentes } = await supabase
    .from('vendas')
    .select('id')
    .gte('data', inicio)
    .lt('data', fim)
  const idsExistentes = new Set((existentes ?? []).map((v) => v.id as string))
  const idsEnviados = new Set(linhas.filter((l) => l.id).map((l) => l.id as string))
  const paraDeletar = [...idsExistentes].filter((id) => !idsEnviados.has(id))
  if (paraDeletar.length > 0) {
    await supabase.from('vendas').delete().in('id', paraDeletar)
  }

  // Renumera pela ordem enviada (posicao = i+1) e grava.
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]
    const unidade_id = l.unidade_id || unidadeDe.get(l.consultor_id) || null
    const campos = {
      posicao: i + 1,
      consultor_id: l.consultor_id,
      unidade_id,
      veiculo_marca: '',
      veiculo_modelo: l.veiculo.trim(),
      status: l.status === 'caida' ? 'caida' : 'ativa',
      tipo: l.tipo === 'moto' ? 'moto' : 'carro',
    }
    if (l.id && idsExistentes.has(l.id)) {
      await supabase.from('vendas').update(campos).eq('id', l.id)
    } else {
      await supabase.from('vendas').insert({ ...campos, valor: 0, data: inicio })
    }
  }

  revalidatePath('/metas')
  redirect(`/metas?mes=${mes}`)
}

function num(formData: FormData, key: string): number {
  const raw = (formData.get(key) as string)?.trim()
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export async function createVenda(formData: FormData) {
  const supabase = await createClient()
  const user = await soAdmin(supabase)

  const consultor_id = (formData.get('consultor_id') as string) || user.id
  // Veículo num campo só ("Onix Vinho 2019"), como a lista do sistema antigo:
  // guardamos o nome inteiro em veiculo_modelo e deixamos marca vazia.
  const veiculo = (formData.get('veiculo') as string)?.trim()
  const tipo = (formData.get('tipo') as string) === 'moto' ? 'moto' : 'carro'
  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)
  const observacao = (formData.get('observacao') as string)?.trim() || null

  if (!consultor_id || !veiculo) {
    redirect(`/metas/new?error=${encodeURIComponent('Escolha o vendedor e informe o veículo')}`)
  }

  // Loja da venda: normalmente a unidade do vendedor. Mas vendedor "volante"
  // (Gilmar, Junior — sem unidade fixa) pode ser jogado pra qualquer loja: se
  // uma loja foi escolhida no formulário, ela vence a unidade do vendedor.
  const lojaEscolhida = (formData.get('unidade_id') as string) || null
  const { data: vendedor } = await supabase
    .from('profiles')
    .select('unidade_id')
    .eq('id', consultor_id)
    .single<{ unidade_id: string | null }>()

  const { error } = await supabase.from('vendas').insert({
    consultor_id,
    unidade_id: lojaEscolhida ?? vendedor?.unidade_id ?? null,
    veiculo_marca: '',
    veiculo_modelo: veiculo,
    veiculo_placa: null,
    valor: 0,
    tipo,
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
  await soAdmin(supabase)
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

export async function toggleVendaAutocerto(formData: FormData) {
  const supabase = await createClient()
  await soGerencia(supabase)
  const id = formData.get('id') as string
  const enviadoAtual = formData.get('enviado_atual') === '1'

  const { error } = await supabase.from('vendas').update({ enviado_autocerto: !enviadoAtual }).eq('id', id)

  if (error) {
    redirect(`/metas?error=${encodeURIComponent('Não foi possível atualizar o Autocerto')}`)
  }

  revalidatePath('/metas')
  redirect('/metas')
}

export async function deleteVenda(formData: FormData) {
  const supabase = await createClient()
  await soAdmin(supabase)
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
  const placa = (formData.get('placa') as string)?.trim().toUpperCase() || null
  const cliente = (formData.get('cliente') as string)?.trim()
  const valor = num(formData, 'valor')
  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)
  const observacao = (formData.get('observacao') as string)?.trim() || null

  // Valor pode ser zero: no antigo há proteções lançadas a R$ 0,00 e elas
  // contam como 1 seguro na meta igual às outras. Só o cliente é obrigatório.
  if (!unidade_id || !cliente) {
    redirect(`/metas/protecao/new?error=${encodeURIComponent('Preencha unidade e nome do cliente')}`)
  }

  if (valor < 0) {
    redirect(`/metas/protecao/new?error=${encodeURIComponent('O valor não pode ser negativo')}`)
  }

  const { error } = await supabase.from('vendas_protecao').insert({
    consultor_id,
    unidade_id,
    placa,
    cliente,
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

// Salva todas as metas de proteção do mês de uma vez — as 4 unidades e os 11
// vendedores num submit só, como o "Salvar Metas" do sistema antigo
// (salvarMetasSeguro). Pelo /metas/definir seriam 15 idas e voltas pra fazer
// o mesmo trabalho.
//
// Meta 0 significa "sem meta", e aí a linha é apagada em vez de gravada como
// zero: assim o widget mostra "sem meta definida" em vez de 100% de nada.
export async function salvarMetasProtecaoLote(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', user!.id)
    .single<{ cargo: string }>()

  if (profile?.cargo !== 'admin') redirect('/metas/protecao')

  const periodo = formData.get('periodo') as string

  if (!periodo) {
    redirect(`/metas/protecao?error=${encodeURIComponent('Informe o mês')}`)
  }

  const voltar = `/metas/protecao?mes=${periodo}`

  // Os inputs vêm como meta_unidade_<id> e meta_consultor_<id>.
  const alvos: { escopo: 'unidade' | 'consultor'; id: string; valor: number }[] = []

  for (const [chave, bruto] of formData.entries()) {
    const mUnidade = chave.match(/^meta_unidade_(.+)$/)
    const mConsultor = chave.match(/^meta_consultor_(.+)$/)
    if (!mUnidade && !mConsultor) continue

    const texto = (bruto as string)?.trim()
    const valor = texto ? Number(texto) : 0

    if (!Number.isFinite(valor) || valor < 0) {
      redirect(`${voltar}&error=${encodeURIComponent('As metas precisam ser números iguais ou maiores que zero')}`)
    }

    alvos.push({
      escopo: mUnidade ? 'unidade' : 'consultor',
      id: (mUnidade ?? mConsultor)![1],
      valor,
    })
  }

  for (const alvo of alvos) {
    const coluna = alvo.escopo === 'unidade' ? 'unidade_id' : 'consultor_id'

    const { data: existente } = await supabase
      .from('metas')
      .select('id')
      .eq('tipo', 'protecao')
      .eq('escopo', alvo.escopo)
      .eq('periodo', periodo)
      .eq(coluna, alvo.id)
      .maybeSingle<{ id: string }>()

    if (existente) {
      await supabase.from('metas').delete().eq('id', existente.id)
    }

    if (alvo.valor > 0) {
      const { error } = await supabase.from('metas').insert({
        tipo: 'protecao',
        escopo: alvo.escopo,
        periodo,
        valor_meta: alvo.valor,
        [coluna]: alvo.id,
      })

      if (error) {
        redirect(`${voltar}&error=${encodeURIComponent('Não foi possível salvar as metas')}`)
      }
    }
  }

  revalidatePath('/metas/protecao')
  redirect(`${voltar}&success=metas`)
}
