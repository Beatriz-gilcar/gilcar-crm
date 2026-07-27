/**
 * WhatsApp Cloud API (Meta) — envio de template.
 *
 * Escolhemos a API oficial da Meta, direto, e não Z-API/Evolution/similares:
 * aquelas dirigem o WhatsApp Web por baixo, o que viola os termos e arrisca o
 * banimento do número. O número de vendas da Gilcar é canal de trabalho — dois
 * terços dos atendimentos vêm de WhatsApp — e não vale arriscá-lo.
 *
 * Mensagem iniciada pela empresa exige TEMPLATE aprovado pela Meta. Texto
 * livre só funciona dentro da janela de 24h depois que a pessoa escreve pra
 * gente, o que não é o nosso caso: aqui é sempre o sistema quem inicia.
 */

const API_VERSION = 'v21.0'

export type TemplateNome =
  | 'ficha_enviada_aprovacao'
  | 'lembrete_vencendo'
  | 'ficha_pendente_cobranca'

export type ResultadoEnvio =
  | { ok: true; id: string }
  | { ok: false; motivo: string; desligado?: boolean }

/**
 * Sem credenciais o módulo fica inerte: nada é enviado e nada quebra. É o que
 * permite subir o código antes de a conta da Meta existir.
 */
export function whatsappConfigurado(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TOKEN)
}

/**
 * Normaliza pro formato que a Cloud API exige: E.164 sem símbolos.
 *
 *   (21) 99999-8888  ->  5521999998888
 *
 * O 9 do celular e o DDI 55 são acrescentados quando faltam, porque é assim
 * que os números aparecem na planilha antiga (a coluna Celular do Atendimento
 * tem "(21)981118686" e "21999"). Número que não dá pra salvar vira null e o
 * envio é pulado — melhor não mandar do que mandar pro desconhecido.
 */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  const so = String(bruto ?? '').replace(/\D/g, '')
  if (!so) return null

  // Já veio com DDI.
  if (so.length === 12 || so.length === 13) {
    return so.startsWith('55') ? so : null
  }
  // Veio só com DDD (10 = fixo, 11 = celular).
  if (so.length === 10 || so.length === 11) {
    return `55${so}`
  }
  return null
}

/** 5521999998888 -> (21) 99999-8888, só pra exibir. */
export function formatarTelefone(e164: string | null | undefined): string {
  const s = String(e164 ?? '').replace(/\D/g, '')
  if (s.length < 12 || !s.startsWith('55')) return String(e164 ?? '—')
  const ddd = s.slice(2, 4)
  const numero = s.slice(4)
  const meio = numero.length === 9 ? 5 : 4
  return `(${ddd}) ${numero.slice(0, meio)}-${numero.slice(meio)}`
}

type Parametro = string

async function enviarTemplate(
  telefone: string,
  template: TemplateNome,
  parametros: Parametro[]
): Promise<ResultadoEnvio> {
  if (!whatsappConfigurado()) {
    return { ok: false, motivo: 'WhatsApp não configurado', desligado: true }
  }

  const destino = normalizarTelefone(telefone)
  if (!destino) {
    return { ok: false, motivo: `telefone inválido: "${telefone}"` }
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'template',
        template: {
          name: template,
          language: { code: 'pt_BR' },
          components: parametros.length
            ? [{ type: 'body', parameters: parametros.map((p) => ({ type: 'text', text: p })) }]
            : [],
        },
      }),
      // A notificação não pode segurar o fluxo de trabalho: se a Meta demorar,
      // desiste e segue.
      signal: AbortSignal.timeout(8000),
    })

    const corpo = await r.json()

    if (!r.ok) {
      const erro = corpo?.error?.message ?? `HTTP ${r.status}`
      return { ok: false, motivo: erro }
    }

    return { ok: true, id: corpo?.messages?.[0]?.id ?? '—' }
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'falha de rede' }
  }
}

/**
 * Dispara sem segurar quem chamou, e sem deixar exceção vazar.
 *
 * Notificação é acessório: se o WhatsApp estiver fora, a ficha tem que ser
 * enviada do mesmo jeito. O erro vai pro log do servidor, não pra tela do
 * consultor — ele não pode fazer nada a respeito.
 */
export function notificar(
  telefone: string | null | undefined,
  template: TemplateNome,
  parametros: Parametro[],
  contexto: string
): void {
  if (!telefone || !whatsappConfigurado()) return

  void enviarTemplate(telefone, template, parametros).then((r) => {
    if (!r.ok && !r.desligado) {
      console.error(`[whatsapp] ${contexto} -> ${r.motivo}`)
    }
  })
}

/** Versão que espera o resultado — pro cron, que precisa do relatório. */
export async function notificarAguardando(
  telefone: string | null | undefined,
  template: TemplateNome,
  parametros: Parametro[]
): Promise<ResultadoEnvio> {
  if (!telefone) return { ok: false, motivo: 'sem telefone' }
  return enviarTemplate(telefone, template, parametros)
}
