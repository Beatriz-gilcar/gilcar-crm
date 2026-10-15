-- Mais relatórios pro Dashboard: ranking de veículos por unidade, % de
-- vendas com desconto, formas de pagamento, e conversão por origem do
-- atendimento. Mesmo padrão das funções já existentes (security invoker,
-- dedup de placa+cliente onde a fonte é ordens_servico).

-- Top 5 veículos mais vendidos de CADA unidade (não só o ranking geral) —
-- fonte é "vendas" (lançamento manual da Corrida da Meta), mesmo critério
-- de dashboard_ranking_veiculos.
create or replace function dashboard_ranking_veiculos_por_unidade(p_inicio date, p_fim date)
  returns table (unidade_id uuid, unidade_nome text, marca text, modelo text, total bigint)
  language sql security invoker stable set search_path = public
  as $$
  select unidade_id, unidade_nome, marca, modelo, total
  from (
    select
      v.unidade_id,
      u.nome as unidade_nome,
      v.veiculo_marca as marca,
      v.veiculo_modelo as modelo,
      count(*) as total,
      row_number() over (partition by v.unidade_id order by count(*) desc) as rn
    from vendas v
    join unidades u on u.id = v.unidade_id
    where v.status = 'ativa'
      and v.data >= p_inicio
      and v.data < p_fim
    group by v.unidade_id, u.nome, v.veiculo_marca, v.veiculo_modelo
  ) ranked
  where rn <= 5
  order by unidade_nome, total desc
$$;

-- Percentual de vendas aprovadas que saíram com desconto. Fonte é
-- ordens_servico (tem o valor de desconto de verdade) com o mesmo dedup de
-- placa+cliente de dashboard_ranking_dedup_ordens.sql.
create or replace function dashboard_percentual_desconto(p_inicio date, p_fim date)
  returns table (total_vendas bigint, vendas_com_desconto bigint, percentual numeric)
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
    count(*) as total_vendas,
    count(*) filter (where desconto > 0) as vendas_com_desconto,
    case
      when count(*) = 0 then 0
      else round(100.0 * count(*) filter (where desconto > 0) / count(*), 1)
    end as percentual
  from dedup
$$;

-- Quantidade e valor por forma de pagamento (dinheiro, cartão
-- crédito/débito, pix, boleto, consórcio, transferência). Pega os
-- pagamentos só das ordens deduplicadas (uma venda com 2 OS aprovadas por
-- engano não pode contar o pagamento em dobro).
create or replace function dashboard_formas_pagamento(p_inicio date, p_fim date)
  returns table (forma text, total bigint, valor_total numeric)
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
    select distinct on (chave_dedup) id
    from aprovadas
    order by chave_dedup, created_at desc
  )
  select
    p.forma::text as forma,
    count(*) as total,
    coalesce(sum(p.valor), 0) as valor_total
  from ordens_servico_pagamentos p
  join dedup d on d.id = p.ordem_id
  group by p.forma
  order by total desc
$$;

-- Conversão por origem do atendimento (de onde veio + se fechou negócio).
-- Fonte é atendimentos, não ordens_servico — é o único lugar que registra
-- TODO contato (não só os que viraram OS), com o canal (origem) e se fechou.
create or replace function dashboard_origem_atendimentos(p_inicio date, p_fim date)
  returns table (tipo text, origem text, total bigint, fechados bigint, percentual numeric)
  language sql security invoker stable set search_path = public
  as $$
  select
    tipo::text as tipo,
    coalesce(origem, 'não informado') as origem,
    count(*) as total,
    count(*) filter (where fechou_negocio) as fechados,
    case
      when count(*) = 0 then 0
      else round(100.0 * count(*) filter (where fechou_negocio) / count(*), 1)
    end as percentual
  from atendimentos
  where data_atendimento >= p_inicio
    and data_atendimento < p_fim
  group by tipo, origem
  order by total desc
$$;
