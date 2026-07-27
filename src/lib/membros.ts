export const cargoLabel: Record<string, string> = {
  consultor: 'Consultor',
  supervisor: 'Supervisor',
  gerente: 'Gerente',
  pos_venda: 'Pós-venda',
  sdr: 'SDR',
  visualizador: 'Visualizador',
  admin: 'Admin',
}

export const cargoBadgeClass: Record<string, string> = {
  consultor: 'badge-enviado',
  supervisor: 'badge-neutro',
  gerente: 'badge-pendente',
  pos_venda: 'badge-neutro',
  sdr: 'badge-neutro',
  visualizador: 'badge-rejeitado',
  admin: 'badge-aprovado',
}

// Espelha is_gerencia() no banco: quem escreve e aprova além dos próprios
// registros. Visualizador de propósito fora — ele lê tudo mas não escreve nada,
// então manter ele fora daqui já esconde os botões de escrita da tela dele.
export function isGerenciaCargo(cargo: string | null | undefined): boolean {
  return cargo === 'gerente' || cargo === 'supervisor' || cargo === 'admin'
}

// Quem enxerga os dados de todo mundo, escrevendo ou não. Use para abas,
// rótulos e telas de leitura — não para liberar ação.
export function podeVerTudo(cargo: string | null | undefined): boolean {
  return isGerenciaCargo(cargo) || cargo === 'visualizador'
}

export function isSomenteLeitura(cargo: string | null | undefined): boolean {
  return cargo === 'visualizador'
}

// Quem pode escrever no módulo de Pós-venda: SÓ o cargo pos_venda (Luciana).
// Nem gerência nem admin editam — todos os outros apenas leem. Espelha
// pode_editar_pos_venda() no banco (migration 20260803000000).
export function podeEditarPosVenda(cargo: string | null | undefined): boolean {
  return cargo === 'pos_venda'
}

// Módulo SDR (lançamento de leads por consultor). Acessam: a equipe de SDR
// (cargo 'sdr', que inclui a gerente delas) e o admin (Junior, que vê o
// consolidado). Quem valida o dia é a gerente (flag valida_sdr no profile) ou o
// admin — isso é checado com o campo, não só com o cargo.
export function isSdr(cargo: string | null | undefined): boolean {
  return cargo === 'sdr'
}
export function podeAcessarSdr(cargo: string | null | undefined): boolean {
  return cargo === 'sdr' || cargo === 'admin'
}

// Cargos de rede inteira, que podem ficar com Unidade = "Todas". O acesso deles
// não passa por unidade nenhuma. Os demais precisam de unidade: é ela que define
// o escopo do consultor/gerente, e a Ficha não grava sem.
export function podeFicarSemUnidade(cargo: string | null | undefined): boolean {
  // pos_venda entra aqui porque a Luciana cuida de TODAS as unidades — precisa
  // poder ser cadastrada com Unidade = "Todas".
  // sdr entra aqui porque a equipe de SDR é central (atende TODAS as unidades) —
  // precisa poder ser cadastrada com Unidade = "Todas".
  return cargo === 'admin' || cargo === 'visualizador' || cargo === 'pos_venda' || cargo === 'sdr'
}
