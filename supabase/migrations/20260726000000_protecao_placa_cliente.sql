-- Proteção passa a guardar placa e cliente, como no sistema antigo.
--
-- A aba VendasSeguro do antigo grava:
--   ['Mes','Data','Vendedor','Email','Unidade','Placa','Cliente','Valor']
--
-- Aqui existia um `descricao` genérico ("Ex: Seguro veicular, Proteção premium")
-- no lugar dos dois campos. Por isso a tabela "Vendas de Proteção Registradas",
-- que no antigo tem colunas PLACA e CLIENTE, não tinha como existir — o dado
-- não estava separado.
--
-- Tabela com 0 registros, então é troca direta, sem migração de dados.

alter table vendas_protecao drop column if exists descricao;

alter table vendas_protecao add column if not exists placa text;
alter table vendas_protecao add column if not exists cliente text not null default '';

-- O default '' existe só pra satisfazer o not null caso a tabela tivesse
-- linhas; daqui pra frente o formulário exige o nome.
alter table vendas_protecao alter column cliente drop default;
