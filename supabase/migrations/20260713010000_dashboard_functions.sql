-- Funções de agregação para o dashboard. Todas são security invoker: a RLS
-- das tabelas base (clientes, atendimentos) continua se aplicando a quem
-- chama, então um consultor só vê a própria linha nesses rankings.

-- Agrupa pela unidade do CONSULTOR (profiles.unidade_id), não pela unidade
-- de cada lead — senão um consultor (ou gerência/admin) com leads em mais
-- de uma unidade aparece fragmentado em várias linhas com o total dividido.
create or replace function dashboard_leads_por_consultor()
returns table (consultor_id uuid, consultor_nome text, unidade_nome text, total bigint)
language sql security invoker stable set search_path = public
as $$
  select c.consultor_id, p.nome, u.nome, count(*)
  from clientes c
  join profiles p on p.id = c.consultor_id
  left join unidades u on u.id = p.unidade_id
  group by c.consultor_id, p.nome, u.nome
  order by count(*) desc
$$;

create or replace function dashboard_leads_por_unidade()
returns table (unidade_id uuid, unidade_nome text, total bigint)
language sql security invoker stable set search_path = public
as $$
  select c.unidade_id, u.nome, count(*)
  from clientes c
  join unidades u on u.id = c.unidade_id
  group by c.unidade_id, u.nome
  order by count(*) desc
$$;

create or replace function dashboard_atendimentos_por_consultor()
returns table (consultor_id uuid, consultor_nome text, total bigint)
language sql security invoker stable set search_path = public
as $$
  select a.consultor_id, p.nome, count(*)
  from atendimentos a
  join profiles p on p.id = a.consultor_id
  group by a.consultor_id, p.nome
  order by count(*) desc
$$;
