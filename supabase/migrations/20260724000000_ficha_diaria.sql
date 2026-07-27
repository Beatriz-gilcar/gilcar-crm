-- Módulo Ficha: a tela de trabalho diária do consultor, que é o coração do
-- sistema antigo (aba FICHA) e não tinha equivalente aqui.
--
-- Contexto de como chegamos nisto:
--
-- * O módulo Tratos foi construído sobre código morto. salvarTrato/getTratos
--   existem no .gs mas a interface antiga nunca os chama (0 ocorrências no
--   Html), não há aba de Tratos, e a tabela nasceu e ficou com 0 registros.
--   "tratos e combinados" é o subtítulo do logo, não um módulo.
--
-- * O módulo Leads também não existia no antigo, mas era — sem ninguém notar —
--   o único ponto de entrada de atendimento. Ao removê-lo, o lançamento de
--   atendimento parou de existir e o Status do Dia ficou sem alimentação. A
--   Ficha é a entrada correta, e é o que conserta isso.

-- No antigo o consultor digita o nome do cliente na Ficha; não existe cadastro
-- de lead pra vincular. O not null aqui era herança do módulo Leads, e é o que
-- impedia a Ficha de gravar. Os campos cliente_nome/celular/veiculo_interesse
-- já existem na tabela e cobrem o caso.
alter table atendimentos alter column cliente_id drop not null;

create type ficha_status as enum ('pendente', 'enviado', 'aprovado');

-- Espelha a aba Fichas_diarias: os totais consolidados do dia + o status que o
-- gerente aprova. Uma linha por consultor por dia (o antigo dava appendRow e
-- duplicava se registrasse duas vezes; aqui o unique + upsert evita isso).
create table fichas_diarias (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references profiles(id),
  unidade_id uuid not null references unidades(id),
  data date not null default current_date,
  presenciais integer not null default 0,
  digitais integer not null default 0,
  fechamentos integer not null default 0,
  agendamentos integer not null default 0,
  status ficha_status not null default 'pendente',
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consultor_id, data)
);

create index fichas_diarias_data_idx on fichas_diarias (data);
create index fichas_diarias_unidade_id_idx on fichas_diarias (unidade_id);

-- Espelha a aba Atividades. As metas (Feed 1, Reels 1, Stories 2, Status 2,
-- TikTok 1, Marketplace 5, OLX 1, Avaliações 1, Ligações 10) são constantes
-- fixas no Html antigo, não vêm da planilha de Metas — por isso ficam no
-- código, em src/lib/atividades.ts, e não numa tabela de configuração.
create table atividades_dia (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references profiles(id),
  unidade_id uuid not null references unidades(id),
  data date not null default current_date,
  feed integer not null default 0,
  reels integer not null default 0,
  stories integer not null default 0,
  wa_status integer not null default 0,
  tiktok integer not null default 0,
  marketplace integer not null default 0,
  olx integer not null default 0,
  avaliacoes integer not null default 0,
  ligacoes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consultor_id, data)
);

create index atividades_dia_data_idx on atividades_dia (data);

alter table fichas_diarias enable row level security;
alter table atividades_dia enable row level security;

create policy "fichas_diarias: consultor vê as próprias, gerência vê tudo"
  on fichas_diarias for select
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());

create policy "fichas_diarias: consultor registra pra si, gerência pra qualquer um"
  on fichas_diarias for insert
  to authenticated
  with check (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "fichas_diarias: consultor edita as próprias, gerência edita tudo"
  on fichas_diarias for update
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());

create policy "fichas_diarias: apenas gerência exclui"
  on fichas_diarias for delete
  to authenticated
  using (is_gerencia());

create policy "atividades_dia: consultor vê as próprias, gerência vê tudo"
  on atividades_dia for select
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());

create policy "atividades_dia: consultor registra pra si, gerência pra qualquer um"
  on atividades_dia for insert
  to authenticated
  with check (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "atividades_dia: consultor edita as próprias, gerência edita tudo"
  on atividades_dia for update
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());

create policy "atividades_dia: apenas gerência exclui"
  on atividades_dia for delete
  to authenticated
  using (is_gerencia());

-- O visualizador (CEO) segue a mesma regra das outras tabelas: lê tudo, não
-- escreve nada. Mesmo desenho da migration 20260723020000 — permissiva pra
-- leitura, restritiva pra escrita.
do $$
declare
  t text;
begin
  foreach t in array array['fichas_diarias', 'atividades_dia'] loop
    execute format(
      'create policy "%s: visualizador lê tudo" on %I for select to authenticated using (is_visualizador())', t, t);
    execute format(
      'create policy "%s: visualizador não insere" on %I as restrictive for insert to authenticated with check (not is_visualizador())', t, t);
    execute format(
      'create policy "%s: visualizador não edita" on %I as restrictive for update to authenticated using (not is_visualizador()) with check (not is_visualizador())', t, t);
    execute format(
      'create policy "%s: visualizador não exclui" on %I as restrictive for delete to authenticated using (not is_visualizador())', t, t);
  end loop;
end $$;

-- Trava do dia aprovado, mesma ideia da que já existe para atendimentos:
-- consultor não registra ficha em dia já fechado pela gerência.
--
-- Função separada de propósito: check_dia_aprovado() lê new.data_atendimento,
-- que só existe em atendimentos. Aqui a coluna é `data`, então reaproveitar
-- aquele trigger estouraria em runtime no primeiro registro.
create function check_dia_aprovado_ficha()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare
  v_status text;
begin
  if is_gerencia() then
    return new;
  end if;

  select status into v_status
    from aprovacoes_dia
    where unidade_id = new.unidade_id and data = new.data;

  if v_status = 'aprovado' then
    raise exception 'O dia % já foi aprovado para esta unidade. Não é possível registrar a ficha.', new.data;
  end if;

  return new;
end;
$$;

create trigger fichas_diarias_check_dia_aprovado
  before insert or update on fichas_diarias
  for each row execute function check_dia_aprovado_ficha();

-- Tratos sai: nunca foi usado no antigo e a tabela está vazia.
drop table if exists tratos;
drop type if exists trato_status;
