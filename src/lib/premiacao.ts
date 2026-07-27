// Regras de "Prêmios para vendedores" (mensal, individual). Contadas por
// quantidade: nº de motos / carros vendidos no mês + nº de proteções. Cada
// categoria tem seus degraus; vale SÓ O MAIOR degrau atingido.

export type PremioTier = {
  vendasMin: number
  protecoesMin: number
  dinheiro: number
  trafego: number
  label: string
}

// 🏍️ Motos
export const tiersMotos: PremioTier[] = [
  { vendasMin: 5, protecoesMin: 3, dinheiro: 400, trafego: 0, label: '5 motos + 3 proteções' },
  { vendasMin: 7, protecoesMin: 4, dinheiro: 600, trafego: 0, label: '7 motos + 4 proteções' },
  { vendasMin: 10, protecoesMin: 0, dinheiro: 1000, trafego: 100, label: '10 motos' },
  { vendasMin: 15, protecoesMin: 0, dinheiro: 2000, trafego: 200, label: '15 motos' },
  { vendasMin: 20, protecoesMin: 0, dinheiro: 3000, trafego: 300, label: '20 motos' },
]

// 🚗 Carros
export const tiersCarros: PremioTier[] = [
  { vendasMin: 5, protecoesMin: 3, dinheiro: 600, trafego: 0, label: '5 carros + 3 proteções' },
  { vendasMin: 7, protecoesMin: 4, dinheiro: 1500, trafego: 0, label: '7 carros + 4 proteções' },
  { vendasMin: 10, protecoesMin: 0, dinheiro: 3000, trafego: 200, label: '10 carros' },
  { vendasMin: 15, protecoesMin: 0, dinheiro: 5000, trafego: 300, label: '15 carros' },
]

// Entre os degraus que o vendedor satisfaz (vendas e proteções suficientes),
// devolve o de maior valor (dinheiro + tráfego). null se não atingiu nenhum.
export function melhorPremio(
  tiers: PremioTier[],
  vendas: number,
  protecoes: number
): PremioTier | null {
  const satisfeitos = tiers.filter((t) => vendas >= t.vendasMin && protecoes >= t.protecoesMin)
  if (satisfeitos.length === 0) return null
  return satisfeitos.reduce((best, t) =>
    t.dinheiro + t.trafego > best.dinheiro + best.trafego ? t : best
  )
}
