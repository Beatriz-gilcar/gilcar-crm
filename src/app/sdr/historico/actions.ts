'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { podeAcessarSdr } from '@/lib/membros'

const VISITAS_VALIDAS = new Set(['SIM', 'NÃO', 'REAGENDOU'])

// Atualiza se o cliente compareceu ou não. Quando vira "NÃO", cria um
// lembrete automático de follow-up pro consultor responsável — só nessa hora
// (não retroativo pro histórico inteiro, senão seria uma enxurrada de
// lembretes vencidos de leads de mais de um ano atrás).
export async function atualizarVisita(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', user.id)
    .single<{ cargo: string }>()
  if (!podeAcessarSdr(profile?.cargo)) redirect('/')

  const id = formData.get('id') as string
  const visita = (formData.get('visita') as string)?.trim().toUpperCase()
  const voltarPara = (formData.get('voltar_para') as string) || '/sdr/historico'

  if (!id || !VISITAS_VALIDAS.has(visita)) redirect(voltarPara)

  const { data: lead, error } = await supabase
    .from('sdr_leads_historico')
    .update({ visita })
    .eq('id', id)
    .select('cliente_nome, consultor_id')
    .single<{ cliente_nome: string; consultor_id: string }>()

  if (error || !lead) {
    redirect(`${voltarPara}${voltarPara.includes('?') ? '&' : '?'}error=${encodeURIComponent('Não foi possível salvar')}`)
  }

  if (visita === 'NÃO') {
    const vencimento = new Date()
    vencimento.setDate(vencimento.getDate() + 3)
    await supabase.from('lembretes').insert({
      consultor_id: lead!.consultor_id,
      titulo: `Follow-up: ${lead!.cliente_nome} não compareceu`,
      descricao: 'Cliente do histórico de leads da SDR marcado como "não compareceu" — vale retomar contato.',
      data_vencimento: vencimento.toISOString(),
    })
  }

  revalidatePath('/sdr/historico')
  redirect(voltarPara)
}
