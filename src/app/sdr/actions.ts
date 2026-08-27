'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type SupaClient = Awaited<ReturnType<typeof createClient>>

// Acesso ao módulo é da equipe de SDR (cargo 'sdr'), da gerente delas
// (valida_sdr) e do admin. O RLS já barra o resto; aqui é a trava do servidor
// pra não dar pra burlar por fora.
async function quemPodeSdr(supabase: SupaClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase
    .from('profiles')
    .select('cargo, valida_sdr')
    .eq('id', user.id)
    .single<{ cargo: string; valida_sdr: boolean }>()
  const pode = p?.cargo === 'sdr' || p?.cargo === 'admin' || p?.valida_sdr === true
  if (!pode) redirect('/')
  return { user, valida: p?.valida_sdr === true || p?.cargo === 'admin' }
}

function inteiro(v: unknown): number {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Lead a lead (nome, telefone, motivo, veículo, origem), direto em
// sdr_leads_historico — substitui o lançamento antigo por número agregado.
// Agendamentos/comparecimentos do Consolidado passam a ser contados a partir
// daqui (ver /sdr/page.tsx), não mais digitados à mão.
export async function adicionarLeadSdr(formData: FormData) {
  const supabase = await createClient()
  const { user } = await quemPodeSdr(supabase)

  const data = (formData.get('data') as string) || ''
  const consultor_id = (formData.get('consultor_id') as string) || ''
  const cliente_nome = (formData.get('cliente_nome') as string)?.trim()
  const cliente_telefone = (formData.get('cliente_telefone') as string)?.trim() || null
  const motivo = (formData.get('motivo') as string)?.trim() || null
  const veiculo_interesse = (formData.get('veiculo_interesse') as string)?.trim() || null
  const origem = (formData.get('origem') as string)?.trim() || null
  const observacao = (formData.get('observacao') as string)?.trim() || null

  if (!data || !consultor_id || !cliente_nome) {
    redirect(`/sdr?data=${data}&error=${encodeURIComponent('Preencha consultor e nome do cliente')}`)
  }

  // Unidade do consultor: SDR não enxerga o perfil de outra pessoa pela RLS
  // normal (só o próprio), então usa a service role pra essa consulta —
  // mesmo padrão já usado nas listas de consultores/unidades desta página.
  const admin = createAdminClient()
  const { data: consultorProfile } = await admin
    .from('profiles')
    .select('unidade_id')
    .eq('id', consultor_id)
    .single<{ unidade_id: string | null }>()

  const { error } = await supabase.from('sdr_leads_historico').insert({
    data,
    consultor_id,
    unidade_id: consultorProfile?.unidade_id ?? null,
    cliente_nome,
    cliente_telefone,
    motivo,
    veiculo_interesse,
    origem,
    observacao,
    lancado_por: user.id,
  })

  if (error) {
    redirect(`/sdr?data=${data}&error=${encodeURIComponent('Não foi possível salvar o lead')}`)
  }

  revalidatePath('/sdr')
  revalidatePath('/sdr/historico')
  redirect(`/sdr?data=${data}&success=salvo`)
}

// Total de leads recebidos no dia (número único da empresa, por SDR) — não
// muda com o lançamento lead a lead, continua um número à parte.
export async function salvarLeadsRecebidosProprio(formData: FormData) {
  const supabase = await createClient()
  const { user } = await quemPodeSdr(supabase)

  const data = (formData.get('data') as string) || ''
  if (!data) redirect('/sdr')

  const leadsRecebidos = inteiro(formData.get('leads_recebidos'))
  const { error } = await supabase
    .from('sdr_dia')
    .upsert({ data, sdr_id: user.id, leads_recebidos: leadsRecebidos, updated_at: new Date().toISOString() }, { onConflict: 'data,sdr_id' })
  if (error) {
    redirect(`/sdr?data=${data}&error=${encodeURIComponent('Não foi possível salvar o total de leads')}`)
  }

  revalidatePath('/sdr')
  redirect(`/sdr?data=${data}&success=salvo`)
}

// Thuane/admin corrige o total de leads recebidos de cada SDR num dia (a SDR
// normalmente digita o próprio, mas às vezes é a gerente quem sabe o número
// certo, ex. quando a SDR esqueceu ou lançou errado).
export async function salvarLeadsRecebidosSdrs(formData: FormData) {
  const supabase = await createClient()
  const { valida } = await quemPodeSdr(supabase)
  const data = (formData.get('data') as string) || ''
  const de = (formData.get('de') as string) || ''
  const ate = (formData.get('ate') as string) || ''
  const voltar = `/sdr?de=${de}&ate=${ate}`

  if (!valida) redirect(`${voltar}&error=${encodeURIComponent('Só a gerente de SDR corrige o de outra pessoa')}`)
  if (!data) redirect('/sdr')

  const registros: { data: string; sdr_id: string; leads_recebidos: number; updated_at: string }[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('leads_')) continue
    const sdr_id = key.slice('leads_'.length)
    registros.push({ data, sdr_id, leads_recebidos: inteiro(value), updated_at: new Date().toISOString() })
  }

  if (registros.length > 0) {
    const { error } = await supabase.from('sdr_dia').upsert(registros, { onConflict: 'data,sdr_id' })
    if (error) {
      redirect(`${voltar}&error=${encodeURIComponent('Não foi possível salvar os leads recebidos')}`)
    }
  }

  revalidatePath('/sdr')
  redirect(`${voltar}&success=salvo`)
}

// Valida o dia (só a gerente de SDR ou o admin). Marca/desmarca.
export async function validarDiaSdr(formData: FormData) {
  const supabase = await createClient()
  const { user, valida } = await quemPodeSdr(supabase)
  const data = (formData.get('data') as string) || ''
  const desvalidar = formData.get('desvalidar') === '1'
  if (!valida) redirect(`/sdr?data=${data}&error=${encodeURIComponent('Só a gerente de SDR valida o dia')}`)
  if (!data) redirect('/sdr')

  if (desvalidar) {
    await supabase.from('sdr_dia_validado').delete().eq('data', data)
  } else {
    const { error } = await supabase
      .from('sdr_dia_validado')
      .upsert({ data, validado_por: user.id, validado_em: new Date().toISOString() }, { onConflict: 'data' })
    if (error) redirect(`/sdr?data=${data}&error=${encodeURIComponent('Não foi possível validar o dia')}`)
  }

  revalidatePath('/sdr')
  redirect(`/sdr?data=${data}&success=${desvalidar ? 'desvalidado' : 'validado'}`)
}
