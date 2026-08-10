'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { atividadeCampos } from '@/lib/atividades'
import { notificar } from '@/lib/whatsapp'

type Sessao = { userId: string; unidadeId: string | null }

async function sessao(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; s: Sessao }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('unidade_id')
    .eq('id', user.id)
    .single<{ unidade_id: string | null }>()

  return { supabase, s: { userId: user.id, unidadeId: profile?.unidade_id ?? null } }
}

function voltar(data: string, erro?: string) {
  const qs = new URLSearchParams({ data })
  if (erro) qs.set('error', erro)
  redirect(`/ficha?${qs.toString()}`)
}

// Cada atendimento é enviado na hora, igual ao antigo (salvarAtendimentoIndividual).
export async function registrarAtendimento(formData: FormData) {
  const { supabase, s } = await sessao()

  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)
  const tipo = formData.get('tipo') as string
  const clienteNome = (formData.get('cliente_nome') as string)?.trim() || null
  const celular = (formData.get('celular') as string)?.trim() || null
  const veiculoInteresse = (formData.get('veiculo_interesse') as string)?.trim() || null
  const observacao = (formData.get('observacao') as string)?.trim() || null
  const origem = (formData.get('origem') as string) || null

  if (!clienteNome) {
    voltar(data, 'Informe o nome do cliente do atendimento')
  }

  if (!s.unidadeId) {
    voltar(data, 'Seu perfil não tem unidade definida — fale com o administrador')
  }

  const payload: Record<string, unknown> = {
    consultor_id: s.userId,
    tipo,
    cliente_nome: clienteNome,
    celular,
    veiculo_interesse: veiculoInteresse,
    observacao,
    origem,
    // A Ficha grava na data escolhida, não em "agora": o consultor pode estar
    // lançando o dia anterior. Meio-dia UTC evita virar o dia no fuso -03.
    data_atendimento: `${data}T12:00:00Z`,
  }

  // Fechou negócio? vale para os dois tipos (presencial e digital).
  payload.fechou_negocio = formData.get('fechou_negocio') === 'sim'
  if (tipo === 'presencial') {
    payload.cv = (formData.get('cv') as string) || null
  } else {
    payload.agendou_visita = formData.get('agendou_visita') === 'sim'
  }

  const { error } = await supabase.from('atendimentos').insert(payload)

  if (error) {
    const dup = error.message.includes('já foi aprovado')
    voltar(data, dup ? error.message : 'Não foi possível registrar o atendimento')
  }

  revalidatePath('/ficha')
  voltar(data)
}

export async function excluirAtendimento(formData: FormData) {
  const { supabase } = await sessao()

  const id = formData.get('id') as string
  const data = formData.get('data') as string

  const { error } = await supabase.from('atendimentos').delete().eq('id', id)

  if (error) {
    voltar(data, 'Não foi possível excluir o atendimento')
  }

  revalidatePath('/ficha')
  voltar(data)
}

// Registrar Dia: consolida os totais do dia + os contadores de atividades.
// No antigo isso dava appendRow e duplicava a cada clique; aqui é upsert por
// (consultor, data), então registrar de novo atualiza a mesma ficha.
export async function registrarDia(formData: FormData) {
  const { supabase, s } = await sessao()

  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)

  if (!s.unidadeId) {
    voltar(data, 'Seu perfil não tem unidade definida — fale com o administrador')
  }

  const inicio = `${data}T00:00:00Z`
  const fim = new Date(new Date(inicio).getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data: atendimentos, error: erroLeitura } = await supabase
    .from('atendimentos')
    .select('tipo, fechou_negocio, agendou_visita')
    .eq('consultor_id', s.userId)
    .gte('data_atendimento', inicio)
    .lt('data_atendimento', fim)
    .overrideTypes<{ tipo: string; fechou_negocio: boolean | null; agendou_visita: boolean | null }[]>()

  if (erroLeitura) {
    voltar(data, 'Não foi possível ler os atendimentos do dia')
  }

  const lista = atendimentos ?? []

  if (lista.length === 0) {
    voltar(data, 'Envie ao menos um atendimento antes de registrar o dia')
  }

  const ficha = {
    consultor_id: s.userId,
    unidade_id: s.unidadeId,
    data,
    presenciais: lista.filter((a) => a.tipo === 'presencial').length,
    digitais: lista.filter((a) => a.tipo === 'digital').length,
    fechamentos: lista.filter((a) => a.fechou_negocio).length,
    agendamentos: lista.filter((a) => a.agendou_visita).length,
    updated_at: new Date().toISOString(),
  }

  const { error: erroFicha } = await supabase
    .from('fichas_diarias')
    .upsert(ficha, { onConflict: 'consultor_id,data' })

  if (erroFicha) {
    const dup = erroFicha.message.includes('já foi aprovado')
    voltar(data, dup ? erroFicha.message : 'Não foi possível registrar o dia')
  }

  const atividades: Record<string, unknown> = {
    consultor_id: s.userId,
    unidade_id: s.unidadeId,
    data,
    updated_at: new Date().toISOString(),
  }
  for (const campo of atividadeCampos) {
    atividades[campo] = Number(formData.get(campo)) || 0
  }

  const { error: erroAtiv } = await supabase
    .from('atividades_dia')
    .upsert(atividades, { onConflict: 'consultor_id,data' })

  if (erroAtiv) {
    voltar(data, 'Dia registrado, mas não foi possível salvar as atividades')
  }

  revalidatePath('/ficha')
  redirect(`/ficha?data=${data}&success=registrado`)
}

export async function enviarParaAprovacao(formData: FormData) {
  const { supabase, s } = await sessao()

  const data = (formData.get('data') as string) || new Date().toISOString().slice(0, 10)

  const { data: ficha } = await supabase
    .from('fichas_diarias')
    .select('id, status')
    .eq('consultor_id', s.userId)
    .eq('data', data)
    .maybeSingle<{ id: string; status: string }>()

  if (!ficha) {
    voltar(data, 'Registre o dia antes de enviar para aprovação')
  }

  if (ficha!.status !== 'pendente') {
    voltar(data, 'Esta ficha já foi enviada para aprovação')
  }

  const { error } = await supabase
    .from('fichas_diarias')
    .update({ status: 'enviado', enviado_em: new Date().toISOString() })
    .eq('id', ficha!.id)

  if (error) {
    voltar(data, 'Não foi possível enviar para aprovação')
  }

  await avisarGerencia(supabase, s.userId, s.unidadeId)

  revalidatePath('/ficha')
  revalidatePath('/status-do-dia')
  redirect(`/ficha?data=${data}&success=enviado`)
}

/**
 * Avisa a gerência da unidade que tem ficha pra aprovar.
 *
 * Fecha a lacuna que a migração expôs: no sistema antigo isso saía por e-mail
 * (_notificarGerente, gs:399) e aqui não existia — o gerente só descobria se
 * abrisse o Status do Dia por conta própria.
 *
 * Duas decisões:
 *
 * 1. O alvo vem da UNIDADE, não do campo `gerente_responsavel`. Aquele campo é
 *    texto livre e está quebrado: 4 dos 6 valores não casam com perfil nenhum
 *    ("José", "Leonardo", "João", "Junior Klem" — o perfil se chama "Junior").
 *    unidade_id é chave estrangeira e não mente. É também o que o antigo faz.
 *
 * 2. Avisa TODA a gerência da unidade, não só uma pessoa. O antigo guarda o
 *    e-mail numa variável só e manda pra um — na Cachamorra, quem recebe é o
 *    Jefferson e o João nunca fica sabendo. Aqui os dois recebem.
 */
async function avisarGerencia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  consultorId: string,
  unidadeId: string | null
) {
  if (!unidadeId) return

  const { data: quem } = await supabase
    .from('profiles')
    .select('nome, telefone, unidades(nome)')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .in('cargo', ['gerente', 'supervisor'])
    .not('telefone', 'is', null)
    .overrideTypes<{ nome: string; telefone: string; unidades: { nome: string } | null }[]>()

  if (!quem?.length) return

  const { data: consultor } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', consultorId)
    .single<{ nome: string }>()

  for (const g of quem) {
    notificar(
      g.telefone,
      'ficha_enviada_aprovacao',
      [g.nome, consultor?.nome ?? 'Um consultor', g.unidades?.nome ?? '—'],
      `ficha de ${consultor?.nome} -> ${g.nome}`
    )
  }
}
