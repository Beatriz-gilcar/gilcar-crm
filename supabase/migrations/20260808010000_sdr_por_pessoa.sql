-- Atribuição por SDR: cada SDR passa a ter a PRÓPRIA linha por consultor/dia e
-- o próprio total de leads recebidos. Assim o Junior e a Thuane veem o total de
-- cada uma (Vitória, Larissa, Andressa).

-- sdr_leads agora é único por (dia, consultor, SDR que lançou).
alter table sdr_leads drop constraint if exists sdr_leads_data_consultor_id_key;
alter table sdr_leads alter column lancado_por set not null;
alter table sdr_leads add constraint sdr_leads_data_consultor_sdr_key unique (data, consultor_id, lancado_por);

-- Leads recebidos: de "por dia" para "por dia + SDR".
drop table if exists sdr_dia;
create table sdr_dia (
  data date not null,
  sdr_id uuid not null references profiles(id),
  leads_recebidos integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (data, sdr_id)
);
alter table sdr_dia enable row level security;
create policy "sdr_dia: equipe SDR lê" on sdr_dia
  for select to authenticated using (pode_sdr());
create policy "sdr_dia: equipe SDR grava" on sdr_dia
  for insert to authenticated with check (pode_sdr());
create policy "sdr_dia: equipe SDR atualiza" on sdr_dia
  for update to authenticated using (pode_sdr()) with check (pode_sdr());
