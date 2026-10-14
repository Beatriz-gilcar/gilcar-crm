-- Ranking de veículos mais vendidos (por marca/modelo) e ticket médio de
-- venda por unidade, pro Dashboard. Mesmo padrão de dashboard_functions.sql
-- (security invoker — respeita a RLS de ordens_servico: gerente só vê a
-- própria unidade, admin/CEO vê tudo).
--
-- Fonte é ordens_servico (tipo='venda', status='aprovada'), não a tabela
-- vendas (essa é só um contador pra meta, sem valor confiável) nem
-- veiculos.status (vendido é efeito colateral da aprovação da OS).

create or replace function dashboard_ranking_veiculos(p_inicio date, p_fim date)
  returns table (marca text, modelo text, total bigint, valor_total numeric)
  language sql security invoker stable set search_path = public
  as $$
  select
    max(veiculo_marca) as marca,
    max(veiculo_modelo) as modelo,
    count(*) as total,
    coalesce(sum(valor_total - desconto), 0) as valor_total
  from ordens_servico
  where tipo = 'venda'
    and status = 'aprovada'
    and data_venda >= p_inicio
    and data_venda < p_fim
  group by lower(trim(veiculo_marca)), lower(trim(veiculo_modelo))
  order by total desc, valor_total desc
$$;

create or replace function dashboard_ticket_medio_unidade(p_inicio date, p_fim date)
  returns table (unidade_id uuid, unidade_nome text, total_vendas bigint, valor_total numeric, ticket_medio numeric)
  language sql security invoker stable set search_path = public
  as $$
  select
    o.unidade_id,
    u.nome,
    count(*) as total_vendas,
    coalesce(sum(o.valor_total - o.desconto), 0) as valor_total,
    coalesce(sum(o.valor_total - o.desconto), 0) / count(*) as ticket_medio
  from ordens_servico o
  join unidades u on u.id = o.unidade_id
  where o.tipo = 'venda'
    and o.status = 'aprovada'
    and o.data_venda >= p_inicio
    and o.data_venda < p_fim
  group by o.unidade_id, u.nome
  order by ticket_medio desc
$$;
