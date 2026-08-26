-- A policy "ordens_servico: financeiro vê vendas com boleto" (20260904020000)
-- consultava ordens_servico_pagamentos direto numa subquery — e a policy
-- dessa tabela ("segue a visibilidade da ordem") consulta ordens_servico de
-- volta. Cada uma reavalia a RLS da outra: círculo infinito
-- ("infinite recursion detected in policy for relation").
--
-- Corrige envolvendo a checagem numa função security definer, que consulta
-- ordens_servico_pagamentos ignorando a RLS dela — mesmo truque que
-- is_admin()/is_gerencia() já usam pra ler profiles sem reacionar a RLS de
-- profiles.
create or replace function ordem_tem_boleto(p_ordem_id uuid)
  returns boolean
  language sql security definer stable set search_path = public
  as $$
    select exists (
      select 1 from ordens_servico_pagamentos p
      where p.ordem_id = p_ordem_id and p.forma = 'boleto'
    )
  $$;

drop policy if exists "ordens_servico: financeiro vê vendas com boleto" on ordens_servico;
create policy "ordens_servico: financeiro vê vendas com boleto"
  on ordens_servico for select
  to authenticated
  using (is_financeiro() and ordem_tem_boleto(id));
