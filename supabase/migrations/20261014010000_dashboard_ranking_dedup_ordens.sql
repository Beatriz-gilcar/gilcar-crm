-- dashboard_ranking_veiculos e dashboard_ticket_medio_unidade (migration
-- anterior) contavam ordens_servico aprovadas direto, sem levar em conta que
-- a mesma venda pode ter mais de uma OS aprovada pra placa+cliente (duplo
-- clique no form, ou ordem relançada com valor corrigido sem reprovar a
-- antiga) — o mesmo problema que /despesas e /pagamentos já tratam com
-- dedupOrdensPorPlacaCliente() (src/lib/ordens.ts). Aqui replica a mesma
-- regra em SQL: agrupa por placa+cliente (sem placa, mantém a ordem sozinha
-- — não dá pra agrupar com segurança) e fica só com a mais recente.

create or replace function dashboard_ranking_veiculos(p_inicio date, p_fim date)
  returns table (marca text, modelo text, total bigint, valor_total numeric)
  language sql security invoker stable set search_path = public
  as $$
  with aprovadas as (
    select
      *,
      case
        when veiculo_placa is not null and trim(veiculo_placa) <> ''
          then upper(trim(veiculo_placa)) || '::' || lower(trim(cliente_nome))
        else id::text
      end as chave_dedup
    from ordens_servico
    where tipo = 'venda'
      and status = 'aprovada'
      and data_venda >= p_inicio
      and data_venda < p_fim
  ),
  dedup as (
    select distinct on (chave_dedup) *
    from aprovadas
    order by chave_dedup, created_at desc
  )
  select
    max(veiculo_marca) as marca,
    max(veiculo_modelo) as modelo,
    count(*) as total,
    coalesce(sum(valor_total - desconto), 0) as valor_total
  from dedup
  group by lower(trim(veiculo_marca)), lower(trim(veiculo_modelo))
  order by total desc, valor_total desc
$$;

create or replace function dashboard_ticket_medio_unidade(p_inicio date, p_fim date)
  returns table (unidade_id uuid, unidade_nome text, total_vendas bigint, valor_total numeric, ticket_medio numeric)
  language sql security invoker stable set search_path = public
  as $$
  with aprovadas as (
    select
      o.*,
      case
        when o.veiculo_placa is not null and trim(o.veiculo_placa) <> ''
          then upper(trim(o.veiculo_placa)) || '::' || lower(trim(o.cliente_nome))
        else o.id::text
      end as chave_dedup
    from ordens_servico o
    where o.tipo = 'venda'
      and o.status = 'aprovada'
      and o.data_venda >= p_inicio
      and o.data_venda < p_fim
  ),
  dedup as (
    select distinct on (chave_dedup) *
    from aprovadas
    order by chave_dedup, created_at desc
  )
  select
    d.unidade_id,
    u.nome,
    count(*) as total_vendas,
    coalesce(sum(d.valor_total - d.desconto), 0) as valor_total,
    coalesce(sum(d.valor_total - d.desconto), 0) / count(*) as ticket_medio
  from dedup d
  join unidades u on u.id = d.unidade_id
  group by d.unidade_id, u.nome
  order by ticket_medio desc
$$;
