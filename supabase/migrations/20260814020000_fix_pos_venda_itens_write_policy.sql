-- A policy de escrita do pos_venda_itens ("só editores escrevem") não existe
-- no banco de produção -- só a de leitura está ativa. Sem ela, RLS bloqueia
-- silenciosamente qualquer INSERT/UPDATE/DELETE (0 linhas afetadas, sem erro),
-- o que impedia a Luciana de marcar itens como feitos.
drop policy if exists "pos_venda_itens: só editores escrevem" on pos_venda_itens;

create policy "pos_venda_itens: só editores escrevem"
  on pos_venda_itens for all to authenticated
  using (pode_editar_pos_venda())
  with check (pode_editar_pos_venda());
