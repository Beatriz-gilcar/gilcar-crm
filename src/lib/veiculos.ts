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

export const statusLabel: Record<string, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
}

export const statusBadgeClass: Record<string, string> = {
  disponivel: 'badge-aprovado',
  reservado: 'badge-pendente',
  vendido: 'badge-enviado',
}

export const cambioLabel: Record<string, string> = {
  manual: 'Manual',
  automatico: 'Automático',
}
