// Máscaras e formatação de moeda, usadas no formulário de Ordem de Serviço.
// Funções puras (sem React) pra poderem rodar no cliente e no servidor.

export function apenasDigitos(valor: string): string {
  return (valor || '').replace(/\D/g, '')
}

// CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00), decidido pela quantidade
// de dígitos digitados. Formata progressivamente enquanto a pessoa digita.
export function maskCpfCnpj(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

// RG no padrão do RJ (Detran-RJ): 00.000.000-0 (2+3+3+1 dígito verificador).
export function maskRgRj(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 9)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

// Telefone (00) 00000-0000 (celular, 11 dígitos) ou (00) 0000-0000 (fixo, 10).
export function maskTelefone(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^\((\d{2})\) (\d{4})(\d)/, '($1) $2-$3')
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^\((\d{2})\) (\d{5})(\d)/, '($1) $2-$3')
}

// CEP 00000-000.
export function maskCep(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

// ── Moeda (R$) ─────────────────────────────────────────────────────────────

// Formata um número para o padrão brasileiro sem símbolo: 70000 -> "70.000,00".
export function formatBRLNumber(valor: number): string {
  return (Number.isFinite(valor) ? valor : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Converte o que a pessoa digitou ("R$ 70.000,00", "70000", "70.000,00") num
// número. Trata "." como separador de milhar e "," como decimal (padrão BR).
export function parseBRL(valor: string): number {
  if (!valor) return 0
  const limpo = valor.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : 0
}

// Máscara de digitação de moeda: cada tecla empurra os centavos da direita pra
// esquerda (digitou "7000000" -> "70.000,00"), como no caixa/POS.
export function maskMoeda(valor: string): string {
  const d = apenasDigitos(valor)
  if (!d) return ''
  const centavos = Number(d) / 100
  return formatBRLNumber(centavos)
}
