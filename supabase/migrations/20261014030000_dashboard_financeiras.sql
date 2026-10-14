-- Qual financeira é mais usada e o valor médio financiado por ela. Mesmo
-- padrão de dashboard_ticket_medio_unidade: fonte é ordens_servico (venda
-- aprovada), com o mesmo dedup de placa+cliente de
-- dashboard_ranking_dedup_ordens.sql (a mesma duplicata de OS afeta aqui
-- também). "Faturamento" aqui é o valor FINANCIADO (valor_financiado) — o
-- que realmente passa pela financeira, não o valor total da venda (que
-- inclui entrada/troca, irrelevante pro banco).

create or replace function dashboard_financeiras(p_inicio date, p_fim date)
  returns table (financeira text, total bigint, valor_total numeric, valor_medio numeric)
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
      and financeira is not null
      and trim(financeira) <> ''
      and valor_financiado > 0
      and data_venda >= p_inicio
      and data_venda < p_fim
  ),
  dedup as (
    select distinct on (chave_dedup) *
    from aprovadas
    order by chave_dedup, created_at desc
  )
  select
    financeira,
    count(*) as total,
    coalesce(sum(valor_financiado), 0) as valor_total,
    coalesce(sum(valor_financiado), 0) / count(*) as valor_medio
  from dedup
  group by financeira
  order by total desc
$$;
