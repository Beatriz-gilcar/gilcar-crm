// Feed de anúncios do Autocerto (XML, ~950KB, ~270 veículos). Usado só pra
// conferência — ver nos relatórios de /estoque/autocerto — não escreve nada
// de volta no Autocerto (a URL é só de leitura).
//
// Parser bem enxuto de propósito: não é XML genérico, é só pra extrair um
// punhado de campos *folha* (sem tag filha, sem CDATA) de dentro de cada
// bloco <veiculo>...</veiculo>. Não usa lib de XML — não precisa pra isso.

export type VeiculoAutocerto = {
  idveiculo: string
  placa: string
  marca: string
  modelo: string
  precoDecimal: number | null
  dataAtualizacao: string | null
  linkAnuncio: string | null
}

function campoTexto(bloco: string, tag: string): string | null {
  const m = bloco.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return m ? m[1].trim() || null : null
}

function campoCdata(bloco: string, tag: string): string | null {
  const m = bloco.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))
  return m ? m[1].trim() || null : null
}

// "KWJ-7D24" / "kwj7d24" / "KWJ 7D24" -> "KWJ7D24", pra casar com a placa do
// CRM independente de hífen/maiúscula/espaço.
export function normalizarPlaca(bruta: string | null | undefined): string | null {
  const limpa = String(bruta ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return limpa || null
}

export async function buscarFeedAutocerto(): Promise<VeiculoAutocerto[]> {
  const url = process.env.AUTOCERTO_FEED_URL
  if (!url) {
    throw new Error('AUTOCERTO_FEED_URL não configurada')
  }

  const r = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' })
  if (!r.ok) {
    throw new Error(`Autocerto respondeu ${r.status}`)
  }
  const xml = await r.text()

  const blocos = xml.match(/<veiculo>[\s\S]*?<\/veiculo>/g) ?? []

  return blocos
    .map((bloco): VeiculoAutocerto | null => {
      const placa = normalizarPlaca(campoTexto(bloco, 'placa'))
      const idveiculo = campoTexto(bloco, 'idveiculo')
      if (!placa || !idveiculo) return null

      const precoStr = campoTexto(bloco, 'precodecimal')
      return {
        idveiculo,
        placa,
        marca: campoTexto(bloco, 'marca') ?? '—',
        modelo: campoTexto(bloco, 'modelo') ?? '—',
        precoDecimal: precoStr ? Number(precoStr) : null,
        dataAtualizacao: campoTexto(bloco, 'DataAtualizacao'),
        linkAnuncio: campoCdata(bloco, 'linkAnuncioSite'),
      }
    })
    .filter((v): v is VeiculoAutocerto => v !== null)
}
