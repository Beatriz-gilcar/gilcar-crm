-- Detalhe individual dos leads das planilhas antigas de SDR (nome, telefone,
-- veículo de interesse etc.) — sdr_leads só guarda totais agregados por
-- dia/consultor/SDR, essa tabela guarda o lead a lead que ficou de fora.
--
-- Telefone é dado sensível (LGPD): só admin lê essa tabela pelo client
-- normal. A tela /sdr/historico busca com a service role e decide no
-- servidor quem vê o telefone — a trava de verdade é essa RLS aqui, que
-- impede select direto de quem não é admin mesmo por fora da tela.

create table sdr_leads_historico (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  consultor_id uuid not null references profiles(id),
  lancado_por uuid references profiles(id),
  unidade_id uuid references unidades(id),
  cliente_nome text not null,
  cliente_telefone text,
  motivo text,
  veiculo_interesse text,
  origem text,
  observacao text,
  data_visita date,
  visita text,
  feedback_vendedor text,
  fechou text,
  created_at timestamptz not null default now()
);

create index sdr_leads_historico_data_idx on sdr_leads_historico (data);
create index sdr_leads_historico_consultor_id_idx on sdr_leads_historico (consultor_id);
create index sdr_leads_historico_lancado_por_idx on sdr_leads_historico (lancado_por);

alter table sdr_leads_historico enable row level security;

create policy "sdr_leads_historico: so admin le direto"
  on sdr_leads_historico for select
  to authenticated
  using (is_admin());
