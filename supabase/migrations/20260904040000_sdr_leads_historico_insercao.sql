-- Lançamento de SDR passa a cadastrar lead a lead (nome, telefone, motivo,
-- veículo de interesse, origem) direto em sdr_leads_historico, em vez de só
-- números agregados por dia/consultor — essa tabela deixa de ser só o
-- arquivo das planilhas antigas e passa a receber lançamento novo também.
-- Faltava a policy de insert (só select e update existiam até aqui).
create policy "sdr_leads_historico: quem acessa o sdr insere"
  on sdr_leads_historico for insert
  to authenticated
  with check (pode_sdr());
