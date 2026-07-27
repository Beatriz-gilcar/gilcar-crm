import { createAdminClient } from '@/lib/supabase/admin'
import { notificarAguardando, whatsappConfigurado } from '@/lib/whatsapp'

/**
 * Disparo diário de WhatsApp: lembretes que vencem hoje + cobrança de ficha.
 *
 * Roda pelo Vercel Cron (vercel.json) às 20:30 UTC = 17:30 de Brasília.
 *
 * O horário não é arbitrário: é UM disparo por dia (limite do plano Hobby) e
 * os dois avisos querem horários opostos. Lembrete pedia manhã; cobrança de
 * ficha às 9h cobraria a equipe inteira todo dia, já que ninguém registra a
 * ficha antes de atender. Às 17:30 a cobrança é acionável — sobram 30 minutos
 * até o "fechar a planilha" das 17:50 da rotina — e o lembrete ainda chega no
 * dia do vencimento.
 *
 * Usa a service key porque não há usuário logado (é o servidor falando
 * sozinho), e por isso a autorização tem que ser explícita aqui via
 * CRON_SECRET — sem RLS pra proteger, a rota ficaria aberta.
 */

// Fuso da loja. Sem isto, "hoje" no servidor (UTC) vira o dia seguinte a
// partir das 21h de Brasília, e o cron das 9h cobraria a ficha errada.
function hojeNaLoja(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function diaUtil(dataISO: string): boolean {
  const d = new Date(`${dataISO}T12:00:00Z`).getUTCDay()
  return d !== 0 // domingo não tem cobrança de ficha
}

export async function GET(request: Request) {
  // O Vercel Cron manda o header; um curioso que descobrir a URL, não.
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ erro: 'não autorizado' }, { status: 401 })
  }

  if (!whatsappConfigurado()) {
    return Response.json({ pulado: 'WhatsApp não configurado', enviados: 0 })
  }

  const supabase = createAdminClient()
  const hoje = hojeNaLoja()
  const relatorio = { lembretes: 0, cobrancas: 0, falhas: [] as string[] }

  // ── 1. Lembretes que vencem hoje ───────────────────────────────────────
  const { data: lembretes } = await supabase
    .from('lembretes')
    .select('titulo, profiles!lembretes_consultor_id_fkey(nome, telefone, ativo)')
    .eq('concluido', false)
    .gte('data_vencimento', `${hoje}T00:00:00Z`)
    .lt('data_vencimento', `${hoje}T23:59:59Z`)
    .overrideTypes<{ titulo: string; profiles: { nome: string; telefone: string | null; ativo: boolean } | null }[]>()

  for (const l of lembretes ?? []) {
    if (!l.profiles?.ativo || !l.profiles.telefone) continue
    const r = await notificarAguardando(l.profiles.telefone, 'lembrete_vencendo', [
      l.profiles.nome,
      l.titulo,
    ])
    if (r.ok) relatorio.lembretes++
    else relatorio.falhas.push(`lembrete "${l.titulo}" -> ${r.motivo}`)
  }

  // ── 2. Quem ainda não registrou a ficha ────────────────────────────────
  // Substitui o enviarLembretes() do antigo, que mandava e-mail pra TODOS os
  // consultores todo dia, inclusive quem já tinha registrado. Aqui só quem
  // falta é cobrado — cobrar quem já fez ensina a ignorar o aviso.
  if (diaUtil(hoje)) {
    const { data: vendedores } = await supabase
      .from('profiles')
      .select('id, nome, telefone')
      .in('cargo', ['consultor', 'supervisor'])
      .eq('ativo', true)
      .not('telefone', 'is', null)
      .overrideTypes<{ id: string; nome: string; telefone: string }[]>()

    const { data: fichas } = await supabase
      .from('fichas_diarias')
      .select('consultor_id')
      .eq('data', hoje)
      .overrideTypes<{ consultor_id: string }[]>()

    const jaRegistrou = new Set((fichas ?? []).map((f) => f.consultor_id))

    for (const v of vendedores ?? []) {
      if (jaRegistrou.has(v.id)) continue
      const r = await notificarAguardando(v.telefone, 'ficha_pendente_cobranca', [v.nome])
      if (r.ok) relatorio.cobrancas++
      else relatorio.falhas.push(`cobrança ${v.nome} -> ${r.motivo}`)
    }
  }

  return Response.json({ data: hoje, ...relatorio })
}
