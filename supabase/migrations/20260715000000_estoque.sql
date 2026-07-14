-- Módulo de Estoque: cadastro de veículos por unidade.

create type veiculo_status as enum ('disponivel', 'reservado', 'vendido');
create type veiculo_cambio as enum ('manual', 'automatico');

create table veiculos (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  modelo text not null,
  cambio veiculo_cambio not null,
  gnv boolean not null default false,
  blindado boolean,
  cor text,
  ano text,
  placa text not null unique,
  licenciado_ate integer,
  no_site boolean not null default false,
  status veiculo_status not null default 'disponivel',
  observacao text,
  unidade_id uuid not null references unidades(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index veiculos_unidade_id_idx on veiculos (unidade_id);
create index veiculos_status_idx on veiculos (status);

alter table veiculos enable row level security;

-- Só admin tem acesso irrestrito; consultor e gerente ficam presos à própria
-- unidade para cadastrar/editar/excluir (a visualização é liberada pra
-- qualquer cargo autenticado, ver policy de select abaixo).
create function is_admin()
  returns boolean
  language sql security definer stable set search_path = public
  as $$ select coalesce(get_my_cargo() = 'admin', false) $$;

create policy "veiculos: leitura para qualquer autenticado"
  on veiculos for select
  to authenticated
  using (true);

create policy "veiculos: cadastro restrito à própria unidade, admin livre"
  on veiculos for insert
  to authenticated
  with check (is_admin() or unidade_id = get_my_unidade());

create policy "veiculos: edição restrita à própria unidade, admin livre"
  on veiculos for update
  to authenticated
  using (is_admin() or unidade_id = get_my_unidade())
  with check (is_admin() or unidade_id = get_my_unidade());

create policy "veiculos: exclusão restrita à própria unidade, admin livre"
  on veiculos for delete
  to authenticated
  using (is_admin() or unidade_id = get_my_unidade());
