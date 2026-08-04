// Regras de comissão do consultor (definidas pela diretoria em 2026-08):
// Carro < R$100.000: R$700 fixo (R$500 se teve desconto) · Carro >= R$100.000: 1% do valor
// Moto até 124cc: R$200 · 125-249cc: R$400 · 250-599cc: R$450 · 600cc+: R$600
// Revenda: R$500 fixo (escolhido na ordem, não é automático)
// Compra de carro avulsa: R$500 · Compra de moto avulsa: R$150
// Over: valor que o consultor digita na ordem (venda acima do estipulado) —
// metade fica pra loja, metade some à comissão do consultor, em qualquer
// categoria de venda.

// Marcas que só vendem moto no Brasil — carro/moto ambíguo (Honda, Suzuki,
// BMW fabricam os dois) cai no fallback por palavras do modelo.
const MARCAS_MOTO = [
  'yamaha', 'kawasaki', 'harley-davidson', 'harley', 'triumph', 'royal enfield',
  'dafra', 'shineray', 'haojue', 'kasinski', 'traxx', 'sundown', 'ducati',
  'ktm', 'aprilia', 'piaggio', 'vespa', 'husqvarna',
]

const MARCAS_CARRO = [
  'fiat', 'chevrolet', 'gm', 'volkswagen', 'vw', 'ford', 'toyota', 'hyundai',
  'renault', 'nissan', 'jeep', 'citroen', 'citroën', 'peugeot', 'mitsubishi',
  'kia', 'mercedes', 'mercedes-benz', 'audi', 'chery', 'caoa chery', 'jac',
  'byd', 'gwm', 'great wall', 'land rover', 'volvo', 'subaru', 'mini',
  'porsche', 'ram', 'troller',
]

// Nomes de modelo típicos de moto — usado só quando a marca é ambígua
// (Honda/Suzuki/BMW) ou desconhecida.
const MODELOS_MOTO = [
  /\bcg\b/i, /\btitan/i, /\bfan\b/i, /\bbiz\b/i, /\bbros\b/i, /\bxre\b/i,
  /\bcb\b/i, /\bcbr/i, /\btwister/i, /\bhornet/i, /\bfalcon/i, /\bnx\b/i,
  /\bpop\b/i, /\belite/i, /\bpcx\b/i, /\bnmax\b|n-max/i, /\bxmax\b|x-max/i,
  /\bgsx/i, /\bburgman/i, /\bintruder/i, /\bbandit/i, /\bhayabusa/i,
  /\bg ?310\b/i, /\bf ?(750|850|900)\b/i, /\br ?1250\b/i, /\bs ?1000\b/i,
]

export function ehMoto(marca: string, modelo: string): boolean {
  const m = (marca || '').toLowerCase()
  if (MARCAS_MOTO.some((x) => m.includes(x))) return true
  if (MARCAS_CARRO.some((x) => m.includes(x))) return false
  return MODELOS_MOTO.some((re) => re.test(modelo || ''))
}

// Boa parte dos modelos de moto vendidos aqui carrega a cilindrada no nome
// (ex.: "CG 160", "PCX 150", "Fazer 250") — extrai o primeiro número nessa
// faixa plausível de cc. Sem número reconhecível, retorna null (cai no
// menor valor, com aviso na descrição pra conferência manual).
export function extrairCilindrada(modelo: string): number | null {
  // Sem \b no fim: nomes de moto costumam colar uma letra na cilindrada
  // ("CBR 650R", "CB 300F"), e \b não separa dígito de letra (os dois são
  // \w) — com \b essas ficavam sem cilindrada nenhuma reconhecida.
  const match = (modelo || '').match(/(\d{2,4})/)
  if (!match) return null
  const n = Number(match[1])
  if (n < 49 || n > 2500) return null
  return n
}

function comissaoMoto(cc: number | null): number {
  if (cc === null) return 200
  if (cc <= 124) return 200
  if (cc <= 249) return 400
  if (cc <= 599) return 450
  return 600
}

function comissaoCarro(valorTotal: number, temDesconto: boolean): number {
  if (valorTotal >= 100000) return Math.round(valorTotal * 0.01 * 100) / 100
  return temDesconto ? 500 : 700
}

export function calcularComissao(params: {
  tipoOrdem: string
  revenda: boolean
  marca: string
  modelo: string
  valorTotal: number
  desconto: number
  over: number
}): { valor: number; descricao: string } {
  const moto = ehMoto(params.marca, params.modelo)
  const veiculo = `${params.marca} ${params.modelo}`.trim()
  // Over só existe em venda (compra não tem "preço estipulado" pra superar).
  const overConsultor = params.tipoOrdem === 'venda' ? Math.round((params.over / 2) * 100) / 100 : 0
  const notaOver = overConsultor > 0 ? ` + over R$ ${overConsultor.toFixed(2).replace('.', ',')}` : ''

  if (params.tipoOrdem === 'compra') {
    return moto
      ? { valor: 150, descricao: `Compra de moto — ${veiculo}` }
      : { valor: 500, descricao: `Compra de carro — ${veiculo}` }
  }

  if (params.revenda) {
    return { valor: 500 + overConsultor, descricao: `Revenda — ${veiculo}${notaOver}` }
  }

  if (moto) {
    const cc = extrairCilindrada(params.modelo)
    const nota = cc === null ? ' (cilindrada não identificada, confira)' : ''
    return { valor: comissaoMoto(cc) + overConsultor, descricao: `Moto ${cc ? `${cc}cc` : ''} — ${veiculo}${nota}${notaOver}` }
  }

  const temDesconto = params.desconto > 0
  const notaDesconto = temDesconto && params.valorTotal < 100000 ? ' (com desconto)' : ''
  return {
    valor: comissaoCarro(params.valorTotal, temDesconto) + overConsultor,
    descricao: `Carro — ${veiculo}${notaDesconto}${notaOver}`,
  }
}
