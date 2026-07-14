-- Status do Dia / Aprovação: gerência vê quantos consultores de cada
-- unidade já enviaram atendimentos numa data, aprova individualmente
-- (checkmark informativo) ou aprova o dia inteiro (trava novos
-- atendimentos daquela unidade+data pra consultores).

create table aprovacoes_dia (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidades(id),
  data date not null,
  status text not null default 'aberto' check (status in ('aberto', 'aprovado')),
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (unidade_id, data)
);

create table aprovacoes_consultor_dia (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references profiles(id),
  data date not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado')),
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (consultor_id, data)
);

alter table aprovacoes_dia enable row level security;
alter table aprovacoes_consultor_dia enable row level security;

create policy "aprovacoes_dia: apenas gerência"
  on aprovacoes_dia for all
  to authenticated
  using (is_gerencia())
  with check (is_gerencia());

create policy "aprovacoes_consultor_dia: apenas gerência"
  on aprovacoes_consultor_dia for all
  to authenticated
  using (is_gerencia())
  with check (is_gerencia());

-- Trava: bloqueia novos atendimentos de consultores (gerência/admin
-- continuam podendo lançar) quando o dia da unidade já foi aprovado.
-- security definer porque um consultor comum não tem, e não deve ter,
-- select em aprovacoes_dia — a função precisa enxergar a trava mesmo assim.
create function check_dia_aprovado()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare
  v_unidade_id uuid;
  v_status text;
begin
  if is_gerencia() then
    return new;
  end if;

  select unidade_id into v_unidade_id from profiles where id = new.consultor_id;

  if v_unidade_id is not null then
    select status into v_status
      from aprovacoes_dia
      where unidade_id = v_unidade_id and data = new.data_atendimento::date;

    if v_status = 'aprovado' then
      raise exception 'O dia % já foi aprovado para esta unidade. Não é possível enviar novos atendimentos.', new.data_atendimento::date;
    end if;
  end if;

  return new;
end;
$$;

create trigger atendimentos_check_dia_aprovado
  before insert on atendimentos
  for each row execute function check_dia_aprovado();

-- Quantos consultores de cada unidade já enviaram atendimento na data,
-- e o status de aprovação do dia daquela unidade.
create function status_dia_unidades(p_data date)
  returns table (
    unidade_id uuid,
    unidade_nome text,
    total_consultores bigint,
    enviados bigint,
    status text
  )
  language sql security invoker stable set search_path = public
  as $$
  select
    u.id,
    u.nome,
    coalesce(tc.total, 0),
    coalesce(en.enviados, 0),
    coalesce(ad.status, 'aberto')
  from unidades u
  left join (
    select unidade_id, count(*) as total
    from profiles
    where cargo = 'consultor'
    group by unidade_id
  ) tc on tc.unidade_id = u.id
  left join (
    select p.unidade_id, count(distinct a.consultor_id) as enviados
    from atendimentos a
    join profiles p on p.id = a.consultor_id
    where a.data_atendimento::date = p_data
    group by p.unidade_id
  ) en on en.unidade_id = u.id
  left join aprovacoes_dia ad on ad.unidade_id = u.id and ad.data = p_data
  order by u.nome
$$;

-- Detalhe por unidade: cada consultor, quantos atendimentos enviou na
-- data, e se já foi aprovado individualmente.
create function status_dia_detalhe(p_data date, p_unidade_id uuid)
  returns table (
    consultor_id uuid,
    consultor_nome text,
    enviados bigint,
    aprovado boolean
  )
  language sql security invoker stable set search_path = public
  as $$
  select
    p.id,
    p.nome,
    coalesce(a.enviados, 0),
    coalesce(acd.status = 'aprovado', false)
  from profiles p
  left join (
    select consultor_id, count(*) as enviados
    from atendimentos
    where data_atendimento::date = p_data
    group by consultor_id
  ) a on a.consultor_id = p.id
  left join aprovacoes_consultor_dia acd on acd.consultor_id = p.id and acd.data = p_data
  where p.cargo = 'consultor' and p.unidade_id = p_unidade_id
  order by p.nome
$$;
