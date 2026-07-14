-- Módulo Metas/Premiação: Corrida da Meta (vendas + proteção) e
-- Premiação Semestral.

create type venda_status as enum ('ativa', 'caida');
create type meta_tipo as enum ('vendas', 'protecao', 'premiacao_vendas');
create type meta_escopo as enum ('empresa', 'unidade', 'consultor');

create sequence vendas_numero_seq;
create sequence vendas_protecao_numero_seq;

-- ── Vendas (ledger pra Corrida da Meta) ─────────────────────────────────
-- "Caída" não remove a venda do Realizado — só marca visualmente que o
-- negócio não se concretizou. Só exclusão manual (erro de digitação)
-- tira do total.

create table vendas (
  id uuid primary key default gen_random_uuid(),
  numero_sequencial integer not null default nextval('vendas_numero_seq'),
  consultor_id uuid not null references profiles(id),
  unidade_id uuid not null references unidades(id),
  veiculo_marca text not null,
  veiculo_modelo text not null,
  veiculo_placa text,
  valor numeric(12, 2) not null,
  data date not null default current_date,
  status venda_status not null default 'ativa',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendas_consultor_id_idx on vendas (consultor_id);
create index vendas_unidade_id_idx on vendas (unidade_id);
create index vendas_data_idx on vendas (data);

create table vendas_protecao (
  id uuid primary key default gen_random_uuid(),
  numero_sequencial integer not null default nextval('vendas_protecao_numero_seq'),
  consultor_id uuid not null references profiles(id),
  unidade_id uuid not null references unidades(id),
  descricao text not null,
  valor numeric(12, 2) not null,
  data date not null default current_date,
  status venda_status not null default 'ativa',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendas_protecao_consultor_id_idx on vendas_protecao (consultor_id);
create index vendas_protecao_unidade_id_idx on vendas_protecao (unidade_id);
create index vendas_protecao_data_idx on vendas_protecao (data);

-- ── Metas ────────────────────────────────────────────────────────────
-- periodo: 'YYYY-MM' pra vendas/protecao (mensal), 'YYYY-S1'/'YYYY-S2'
-- pra premiacao_vendas (semestral).

create table metas (
  id uuid primary key default gen_random_uuid(),
  tipo meta_tipo not null,
  escopo meta_escopo not null,
  unidade_id uuid references unidades(id),
  consultor_id uuid references profiles(id),
  periodo text not null,
  valor_meta numeric(14, 2) not null,
  valor_super_meta numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index metas_empresa_uidx on metas (tipo, periodo) where escopo = 'empresa';
create unique index metas_unidade_uidx on metas (tipo, unidade_id, periodo) where escopo = 'unidade';
create unique index metas_consultor_uidx on metas (tipo, consultor_id, periodo) where escopo = 'consultor';

alter table vendas enable row level security;
alter table vendas_protecao enable row level security;
alter table metas enable row level security;

create policy "vendas: consultor vê as próprias na sua unidade, gerência vê tudo"
  on vendas for select
  to authenticated
  using (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "vendas: consultor cadastra pra si na sua unidade, gerência pra qualquer um"
  on vendas for insert
  to authenticated
  with check (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "vendas: consultor edita as próprias, gerência edita tudo"
  on vendas for update
  to authenticated
  using (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "vendas: apenas gerência exclui"
  on vendas for delete
  to authenticated
  using (is_gerencia());

create policy "vendas_protecao: consultor vê as próprias na sua unidade, gerência vê tudo"
  on vendas_protecao for select
  to authenticated
  using (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "vendas_protecao: consultor cadastra pra si na sua unidade, gerência pra qualquer um"
  on vendas_protecao for insert
  to authenticated
  with check (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "vendas_protecao: consultor edita as próprias, gerência edita tudo"
  on vendas_protecao for update
  to authenticated
  using (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "vendas_protecao: apenas gerência exclui"
  on vendas_protecao for delete
  to authenticated
  using (is_gerencia());

create policy "metas: leitura para qualquer autenticado"
  on metas for select
  to authenticated
  using (true);

create policy "metas: apenas admin gerencia"
  on metas for all
  to authenticated
  using (is_admin())
  with check (is_admin());
