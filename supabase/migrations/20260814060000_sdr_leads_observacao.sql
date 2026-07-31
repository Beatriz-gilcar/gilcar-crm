-- Campo livre pra SDR anotar por consultor/dia, tipo "trocou de consultor"
-- ou "cliente não compareceu".
alter table sdr_leads add column if not exists observacao text;
