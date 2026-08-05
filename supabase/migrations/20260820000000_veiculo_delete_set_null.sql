-- Excluir um veículo do estoque falhava com erro de integridade sempre que
-- ele já tinha sido vendido/comprado (ordens_servico.veiculo_id apontando pra
-- ele) — a ordem já guarda marca/modelo/placa etc. em colunas próprias, então
-- perder o link pro estoque não perde informação nenhuma.
alter table ordens_servico drop constraint ordens_servico_veiculo_id_fkey;
alter table ordens_servico add constraint ordens_servico_veiculo_id_fkey
  foreign key (veiculo_id) references veiculos(id) on delete set null;
