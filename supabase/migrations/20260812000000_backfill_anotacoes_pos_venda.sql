-- Preenche a anotação de registros de Pós-venda que já existiam antes do
-- auto-preenchimento (migration 20260811000000) e ficaram sem a manutenção
-- da ordem de origem. Só toca quem está com anotações vazias — não sobrescreve
-- nada que a Luciana já tenha escrito.
update pos_venda p
set anotacoes = o.manutencao
from ordens_servico o
where p.ordem_id = o.id
  and p.anotacoes is null
  and o.manutencao is not null;
