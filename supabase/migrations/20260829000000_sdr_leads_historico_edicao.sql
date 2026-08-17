-- Telefone deixa de ser só-admin: quem acessa o SDR precisa dele pra
-- contatar o cliente (é o ponto do histórico). Libera leitura pra
-- pode_sdr() e adiciona update do status de comparecimento.

drop policy if exists "sdr_leads_historico: so admin le direto" on sdr_leads_historico;

create policy "sdr_leads_historico: quem acessa o sdr le tudo"
  on sdr_leads_historico for select
  to authenticated
  using (pode_sdr());

create policy "sdr_leads_historico: quem acessa o sdr atualiza"
  on sdr_leads_historico for update
  to authenticated
  using (pode_sdr())
  with check (pode_sdr());
