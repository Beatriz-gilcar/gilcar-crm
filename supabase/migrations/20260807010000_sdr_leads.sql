-- Módulo SDR: lançamento diário de leads/agendamentos/comparecimentos por
-- consultor. A equipe de SDR (cargo 'sdr') lança; a gerente delas (flag
-- valida_sdr) valida o dia; só o admin (Junior) vê o consolidado.

-- Flag de quem valida os lançamentos. Fica separado do cargo pra NÃO dar à
-- gerente de SDR o acesso amplo de 'gerente' de vendas — ela é cargo 'sdr' com
-- este poder extra.
alter table profiles add column if not exists valida_sdr boolean not null default false;

-- ── Helpers de acesso (security definer: leem profiles ignorando o RLS) ─────
create or replace function is_sdr() returns boolean language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and cargo = 'sdr');
$$;

-- Quem valida: a gerente de SDR (valida_sdr) ou o admin.
create or replace function pode_validar_sdr() returns boolean language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and (valida_sdr = true or cargo = 'admin'));
$$;

-- Quem acessa o módulo: SDR, gerente de SDR ou admin.
create or replace function pode_sdr() returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and (cargo = 'sdr' or cargo = 'admin' or valida_sdr = true)
  );
$$;

-- ── Lançamento por consultor/dia ───────────────────────────────────────────
create table sdr_leads (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  consultor_id uuid not null references profiles(id),
  unidade_id uuid references unidades(id),
  leads integer not null default 0,
  agendamentos integer not null default 0,
  comparecimentos integer not null default 0,
  lancado_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data, consultor_id)
);
create index sdr_leads_data_idx on sdr_leads (data);
create index sdr_leads_unidade_idx on sdr_leads (unidade_id);

alter table sdr_leads enable row level security;
create policy "sdr_leads: equipe SDR lê" on sdr_leads
  for select to authenticated using (pode_sdr());
create policy "sdr_leads: equipe SDR lança" on sdr_leads
  for insert to authenticated with check (pode_sdr());
create policy "sdr_leads: equipe SDR edita" on sdr_leads
  for update to authenticated using (pode_sdr()) with check (pode_sdr());
create policy "sdr_leads: gerente SDR/admin excluem" on sdr_leads
  for delete to authenticated using (pode_validar_sdr());

-- ── Validação do dia pela gerente de SDR ───────────────────────────────────
create table sdr_dia_validado (
  data date primary key,
  validado_por uuid references profiles(id),
  validado_em timestamptz not null default now()
);
alter table sdr_dia_validado enable row level security;
create policy "sdr_dia_validado: equipe SDR lê" on sdr_dia_validado
  for select to authenticated using (pode_sdr());
create policy "sdr_dia_validado: gerente SDR grava" on sdr_dia_validado
  for insert to authenticated with check (pode_validar_sdr());
create policy "sdr_dia_validado: gerente SDR atualiza" on sdr_dia_validado
  for update to authenticated using (pode_validar_sdr()) with check (pode_validar_sdr());
create policy "sdr_dia_validado: gerente SDR apaga" on sdr_dia_validado
  for delete to authenticated using (pode_validar_sdr());
