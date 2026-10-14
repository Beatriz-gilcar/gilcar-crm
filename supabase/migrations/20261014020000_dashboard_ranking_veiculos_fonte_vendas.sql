-- O ranking de veículos mais vendidos contava a partir de ordens_servico,
-- mas nem toda venda lançada em /metas (tabela vendas, a fonte oficial da
-- Corrida da Meta) tem uma OS aprovada correspondente — são lançamentos à
-- parte. Troca a fonte do ranking pra vendas (status='ativa'): é o registro
-- que a gerência mantém manualmente, sem risco de duplicata (ao contrário de
-- ordens_servico, que tem o problema de placa+cliente aprovada duas vezes
-- tratado em dashboard_ranking_dedup_ordens.sql).
--
-- Ticket médio continua em ordens_servico (dashboard_ticket_medio_unidade,
-- inalterada aqui) — vendas não tem valor confiável, toda venda lançada por
-- lá entra com valor=0 (nunca teve campo de preço no formulário).

-- create or replace não deixa mudar o conjunto de colunas de retorno (tirou
-- valor_total) — precisa derrubar a versão antiga primeiro.
drop function if exists dashboard_ranking_veiculos(date, date);

create or replace function dashboard_ranking_veiculos(p_inicio date, p_fim date)
  returns table (marca text, modelo text, total bigint)
  language sql security invoker stable set search_path = public
  as $$
  select
    veiculo_marca as marca,
    veiculo_modelo as modelo,
    count(*) as total
  from vendas
  where status = 'ativa'
    and data >= p_inicio
    and data < p_fim
  group by veiculo_marca, veiculo_modelo
  order by total desc
$$;
