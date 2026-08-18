-- Faltava a policy de UPDATE em pos_venda_lancamentos — só dava pra criar
-- ou excluir, sem corrigir um lançamento errado (a Luciana só conseguia
-- apagar e relançar). Mesma regra de quem já insere/exclui.

create policy "pos_venda_lancamentos: só editores atualizam"
  on pos_venda_lancamentos for update
  to authenticated
  using (pode_editar_pos_venda())
  with check (pode_editar_pos_venda());
