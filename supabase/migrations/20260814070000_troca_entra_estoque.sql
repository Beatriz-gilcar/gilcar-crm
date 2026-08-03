-- Veículo dado na troca de uma venda passa a entrar sozinho no estoque quando
-- a venda é aprovada (ver aprovarOrdem em src/app/ordens/actions.ts).

-- Câmbio do veículo da troca — precisa pra cadastrar no estoque (lá é
-- obrigatório). Fica nullable aqui porque trocas antigas não têm; o
-- formulário novo sempre manda 'manual' ou 'automatico'.
alter table ordens_servico_trocas add column if not exists cambio veiculo_cambio;

-- Rastreia de qual troca o veículo do estoque veio, pra não duplicar se
-- aprovarOrdem rodar de novo pra mesma ordem.
alter table veiculos add column if not exists origem_troca_id uuid references ordens_servico_trocas(id);
