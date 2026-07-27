-- Backfill: toda venda já aprovada que ainda não tem registro de Pós-venda
-- ganha um agora, com a manutenção já anotada pelo consultor virando a
-- anotação inicial. Mesma regra que passa a valer daqui pra frente em
-- aprovarOrdem (src/app/ordens/actions.ts).
insert into pos_venda (ordem_id, unidade_id, cliente_nome, veiculo_marca, veiculo_modelo, veiculo_placa, status, entrega_em, anotacoes)
select o.id, o.unidade_id, o.cliente_nome, o.veiculo_marca, o.veiculo_modelo, o.veiculo_placa, 'aberto', o.data_entrega, o.manutencao
from ordens_servico o
where o.tipo = 'venda'
  and o.status = 'aprovada'
  and not exists (select 1 from pos_venda p where p.ordem_id = o.id);
