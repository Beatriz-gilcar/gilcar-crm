-- Total de leads recebidos pela equipe de SDR no dia (número único da empresa,
-- não por consultor). Fica separado de sdr_leads (que é por consultor) e de
-- sdr_dia_validado (que só marca a validação).

create table sdr_dia (
  data date primary key,
  leads_recebidos integer not null default 0,
  atualizado_por uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table sdr_dia enable row level security;
create policy "sdr_dia: equipe SDR lê" on sdr_dia
  for select to authenticated using (pode_sdr());
create policy "sdr_dia: equipe SDR grava" on sdr_dia
  for insert to authenticated with check (pode_sdr());
create policy "sdr_dia: equipe SDR atualiza" on sdr_dia
  for update to authenticated using (pode_sdr()) with check (pode_sdr());
