-- Lançamentos de pós-venda ficaram com a policy antiga de "leitura para
-- qualquer autenticado" (herdada do create table) e nunca foram restritos
-- como a tabela pos_venda já foi em 20260814000000 — resultado: consultor
-- via os valores lançados pela Luciana, que não devia. Aqui é mais estrito
-- que o pos_venda normal (que também deixa gerência/supervisor da unidade
-- verem): só quem lança (Luciana, cargo pos_venda) e admin.

drop policy "pos_venda_lancamentos: leitura para qualquer autenticado" on pos_venda_lancamentos;

create policy "pos_venda_lancamentos: só pos_venda e admin leem"
  on pos_venda_lancamentos for select
  to authenticated
  using (get_my_cargo() = 'pos_venda' or is_admin());
