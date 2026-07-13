-- Schema inicial do CRM: unidades, perfis, clientes (leads), contatos,
-- atendimentos, categorias e lembretes/obrigações.

create extension if not exists "pgcrypto";

-- ── Tipos ────────────────────────────────────────────────────────────────

create type cargo_tipo as enum ('consultor', 'gerente', 'admin');
create type contato_tipo as enum ('celular', 'whatsapp', 'email', 'outro');
create type atendimento_tipo as enum ('digital', 'presencial', 'compra', 'venda');

-- ── Unidades ─────────────────────────────────────────────────────────────

create table unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

insert into unidades (nome) values
  ('Cachamorra'), ('Mato Alto'), ('Santa Cruz'), ('Recreio');

alter table unidades enable row level security;

create policy "unidades: leitura para autenticados"
  on unidades for select
  to authenticated
  using (true);

-- ── Perfis (estende auth.users) ─────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cargo cargo_tipo not null default 'consultor',
  unidade_id uuid references unidades(id),
  created_at timestamptz not null default now()
);

-- Funções auxiliares (security definer para evitar recursão de RLS ao
-- consultar a própria tabela profiles dentro de outras policies).

create function get_my_cargo()
  returns cargo_tipo
  language sql security definer stable set search_path = public
  as $$ select cargo from profiles where id = auth.uid() $$;

create function get_my_unidade()
  returns uuid
  language sql security definer stable set search_path = public
  as $$ select unidade_id from profiles where id = auth.uid() $$;

create function is_gerencia()
  returns boolean
  language sql security definer stable set search_path = public
  as $$ select coalesce(get_my_cargo() in ('gerente', 'admin'), false) $$;

-- Cria o profile automaticamente quando um usuário se cadastra no Supabase Auth.
create function handle_new_user()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  insert into profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Impede que um consultor se autopromova a gerente/admin ou troque de
-- unidade sem passar por um admin.
create function prevent_privilege_escalation()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if (new.cargo is distinct from old.cargo or new.unidade_id is distinct from old.unidade_id)
     and get_my_cargo() is distinct from 'admin' then
    raise exception 'Apenas admin pode alterar cargo ou unidade de um perfil';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_privilege_escalation
  before update on profiles
  for each row execute function prevent_privilege_escalation();

alter table profiles enable row level security;

create policy "profiles: usuário vê o próprio perfil, gerência vê todos"
  on profiles for select
  to authenticated
  using (id = auth.uid() or is_gerencia());

create policy "profiles: usuário edita o próprio perfil, gerência edita todos"
  on profiles for update
  to authenticated
  using (id = auth.uid() or is_gerencia());

-- ── Clientes (leads) ─────────────────────────────────────────────────────

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  observacoes text,
  unidade_id uuid not null references unidades(id),
  consultor_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clientes_consultor_id_idx on clientes (consultor_id);
create index clientes_unidade_id_idx on clientes (unidade_id);

alter table clientes enable row level security;

create policy "clientes: consultor vê os próprios na sua unidade, gerência vê tudo"
  on clientes for select
  to authenticated
  using (
    is_gerencia()
    or (consultor_id = auth.uid() and unidade_id = get_my_unidade())
  );

create policy "clientes: consultor cadastra para si na sua unidade, gerência para qualquer um"
  on clientes for insert
  to authenticated
  with check (
    is_gerencia()
    or (consultor_id = auth.uid() and unidade_id = get_my_unidade())
  );

create policy "clientes: consultor edita os próprios na sua unidade, gerência edita tudo"
  on clientes for update
  to authenticated
  using (
    is_gerencia()
    or (consultor_id = auth.uid() and unidade_id = get_my_unidade())
  );

create policy "clientes: apenas gerência exclui"
  on clientes for delete
  to authenticated
  using (is_gerencia());

-- ── Contatos (meios de contato do lead) ─────────────────────────────────

create table contatos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo contato_tipo not null,
  valor text not null,
  principal boolean not null default false,
  created_at timestamptz not null default now()
);

create index contatos_cliente_id_idx on contatos (cliente_id);

alter table contatos enable row level security;

create policy "contatos: segue a visibilidade do cliente"
  on contatos for all
  to authenticated
  using (
    exists (
      select 1 from clientes c
      where c.id = contatos.cliente_id
        and (is_gerencia() or (c.consultor_id = auth.uid() and c.unidade_id = get_my_unidade()))
    )
  )
  with check (
    exists (
      select 1 from clientes c
      where c.id = contatos.cliente_id
        and (is_gerencia() or (c.consultor_id = auth.uid() and c.unidade_id = get_my_unidade()))
    )
  );

-- ── Atendimentos ─────────────────────────────────────────────────────────

create table atendimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  consultor_id uuid not null references profiles(id),
  tipo atendimento_tipo not null,
  descricao text,
  data_atendimento timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index atendimentos_cliente_id_idx on atendimentos (cliente_id);
create index atendimentos_consultor_id_idx on atendimentos (consultor_id);

alter table atendimentos enable row level security;

create policy "atendimentos: segue a visibilidade do cliente"
  on atendimentos for all
  to authenticated
  using (
    exists (
      select 1 from clientes c
      where c.id = atendimentos.cliente_id
        and (is_gerencia() or (c.consultor_id = auth.uid() and c.unidade_id = get_my_unidade()))
    )
  )
  with check (
    exists (
      select 1 from clientes c
      where c.id = atendimentos.cliente_id
        and (is_gerencia() or (c.consultor_id = auth.uid() and c.unidade_id = get_my_unidade()))
    )
  );

-- ── Categorias (para lembretes/obrigações) ──────────────────────────────

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text,
  created_at timestamptz not null default now()
);

alter table categorias enable row level security;

create policy "categorias: leitura para autenticados"
  on categorias for select
  to authenticated
  using (true);

create policy "categorias: apenas gerência gerencia"
  on categorias for all
  to authenticated
  using (is_gerencia())
  with check (is_gerencia());

-- ── Lembretes / obrigações ───────────────────────────────────────────────

create table lembretes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  categoria_id uuid references categorias(id),
  consultor_id uuid not null references profiles(id),
  titulo text not null,
  descricao text,
  data_vencimento timestamptz,
  concluido boolean not null default false,
  concluido_em timestamptz,
  created_at timestamptz not null default now()
);

create index lembretes_cliente_id_idx on lembretes (cliente_id);
create index lembretes_consultor_id_idx on lembretes (consultor_id);
create index lembretes_categoria_id_idx on lembretes (categoria_id);

alter table lembretes enable row level security;

create policy "lembretes: consultor vê os próprios, gerência vê tudo"
  on lembretes for select
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());

create policy "lembretes: consultor cadastra para si, gerência para qualquer um"
  on lembretes for insert
  to authenticated
  with check (is_gerencia() or consultor_id = auth.uid());

create policy "lembretes: consultor edita os próprios, gerência edita tudo"
  on lembretes for update
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());

create policy "lembretes: consultor exclui os próprios, gerência exclui tudo"
  on lembretes for delete
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());
