// Atividades do Dia da Ficha. As metas são constantes fixas, exatamente como
// no sistema antigo (Html:868-875) — não vêm da planilha/tabela de Metas, que
// trata de vendas, faturamento e lucratividade.

export type AtividadeCampo =
  | 'feed'
  | 'reels'
  | 'stories'
  | 'wa_status'
  | 'tiktok'
  | 'marketplace'
  | 'olx'
  | 'avaliacoes'
  | 'ligacoes'

export const atividadeGrupos: {
  titulo: string
  itens: { campo: AtividadeCampo; label: string; meta: number }[]
}[] = [
  {
    titulo: 'Instagram / Facebook',
    itens: [
      { campo: 'feed', label: 'Feed', meta: 1 },
      { campo: 'reels', label: 'Reels', meta: 1 },
      { campo: 'stories', label: 'Stories', meta: 2 },
    ],
  },
  {
    titulo: 'WhatsApp',
    itens: [{ campo: 'wa_status', label: 'Status', meta: 2 }],
  },
  {
    titulo: 'TikTok',
    itens: [{ campo: 'tiktok', label: 'TikTok', meta: 1 }],
  },
  {
    titulo: 'Marketplace',
    itens: [
      { campo: 'marketplace', label: 'Marketplace', meta: 5 },
      { campo: 'olx', label: 'OLX', meta: 1 },
    ],
  },
  {
    titulo: 'Avaliações no Google',
    itens: [{ campo: 'avaliacoes', label: 'Avaliações Google', meta: 1 }],
  },
  {
    titulo: 'Ligações',
    itens: [{ campo: 'ligacoes', label: 'Ligações', meta: 10 }],
  },
]

export const atividadeCampos: AtividadeCampo[] = atividadeGrupos.flatMap((g) =>
  g.itens.map((i) => i.campo)
)
