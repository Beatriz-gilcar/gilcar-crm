-- Resolução CONTRAN nº 1.026/2026: registro eletrônico de entrada/saída de
-- veículo em estoque no RENAVE passa a ser obrigatório em todo o Brasil,
-- prazo até 28/09/2026. Controla aqui só a entrada por enquanto (saída fica
-- pra depois, quando for pedida).
--
-- Sem policy nova: quem já pode editar o veículo (admin, consultor da
-- própria unidade, gerência da própria unidade via transferência) já
-- alcança essas colunas pela policy de update existente — e o trigger
-- prevent_veiculo_gerencia_edicao (20260903000000) só trava os campos que
-- ele lista, não esses.
alter table veiculos add column if not exists renave_entrada_registrado boolean not null default false;
alter table veiculos add column if not exists renave_entrada_em date;
