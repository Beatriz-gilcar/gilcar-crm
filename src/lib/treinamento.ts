export function calcularProgresso(totalModulos: number, modulosAprovados: number) {
  return {
    total: totalModulos,
    feitas: modulosAprovados,
    percentual: totalModulos === 0 ? 0 : Math.round((modulosAprovados / totalModulos) * 100),
  }
}

export type StatusModulo = 'pendente' | 'aguardando_aprovacao' | 'aprovado'

export function statusDoModulo(
  progresso: { enviado_em: string | null; aprovado_em: string | null } | undefined
): StatusModulo {
  if (!progresso) return 'pendente'
  if (progresso.aprovado_em) return 'aprovado'
  if (progresso.enviado_em) return 'aguardando_aprovacao'
  return 'pendente' // devolvido pra refazer também cai aqui
}
