-- Status do Dia passa a ler a ficha, fechando o ciclo consultor → gerente.
--
-- Antes: "enviados" contava quem tinha lançado ao menos um atendimento no dia.
-- Isso confundia duas coisas diferentes — lançar atendimento é trabalho em
-- andamento; enviar a ficha é o consultor dizendo "meu dia está fechado, pode
-- conferir". O gerente não tinha como distinguir um do outro.
--
-- Agora: "enviados" conta as fichas com status enviado/aprovado, igual ao
-- sistema antigo, onde o gerente via a lista de fichas Pendente / Enviado para
-- Aprovação / Aprovado e aprovava por ali.
--
-- Duas correções que vêm junto:
--
-- 1. Supervisor entra na conta. As funções filtravam cargo = 'consultor', mas
--    no antigo o supervisor contava como consultor para o total da unidade
--    (gs:1550) — tem meta e lança atendimento como qualquer um.
--
-- 2. Membro inativo sai da conta. A coluna `ativo` não existia quando estas
--    funções foram escritas; sem isto, um desativado continuaria no
--    denominador e a unidade nunca fecharia 100%.

-- aprovacoes_consultor_dia era a aprovação individual do consultor no dia.
-- fichas_diarias.status agora cobre exatamente isso, com um estado a mais
-- (enviado) que a tabela não tinha. Manter as duas seria ter duas fontes de
-- verdade que podem divergir. Tabela está vazia (0 registros), então sai.
drop table if exists aprovacoes_consultor_dia;

-- drop antes do create: as duas mudam o tipo de retorno, e o Postgres não
-- permite trocar isso com create or replace.
drop function if exists status_dia_unidades(date);
drop function if exists status_dia_detalhe(date, uuid);

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
    where cargo in ('consultor', 'supervisor') and ativo
    group by unidade_id
  ) tc on tc.unidade_id = u.id
  left join (
    select f.unidade_id, count(*) as enviados
    from fichas_diarias f
    where f.data = p_data and f.status in ('enviado', 'aprovado')
    group by f.unidade_id
  ) en on en.unidade_id = u.id
  left join aprovacoes_dia ad on ad.unidade_id = u.id and ad.data = p_data
  order by u.nome
$$;

create function status_dia_detalhe(p_data date, p_unidade_id uuid)
  returns table (
    consultor_id uuid,
    consultor_nome text,
    enviados bigint,
    presenciais integer,
    digitais integer,
    fechamentos integer,
    ficha_status text
  )
  language sql security invoker stable set search_path = public
  as $$
  select
    p.id,
    p.nome,
    coalesce(a.enviados, 0),
    coalesce(f.presenciais, 0),
    coalesce(f.digitais, 0),
    coalesce(f.fechamentos, 0),
    -- sem_ficha = lançou ou não atendimento, mas não registrou o dia ainda
    coalesce(f.status::text, 'sem_ficha')
  from profiles p
  left join (
    select consultor_id, count(*) as enviados
    from atendimentos
    where data_atendimento::date = p_data
    group by consultor_id
  ) a on a.consultor_id = p.id
  left join fichas_diarias f on f.consultor_id = p.id and f.data = p_data
  where p.cargo in ('consultor', 'supervisor')
    and p.unidade_id = p_unidade_id
    and p.ativo
  order by p.nome
$$;
