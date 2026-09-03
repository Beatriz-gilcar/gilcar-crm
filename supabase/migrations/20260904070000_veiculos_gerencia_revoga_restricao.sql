-- Reverte a trava de "gerência só transfere unidade" (20260903000000): na
-- prática ela impedia rotina de loja (marcar vendido/reservado, corrigir um
-- dado). Gerência (gerente/supervisor) volta a ter os mesmos poderes do
-- consultor na própria unidade — cadastra, edita, exclui — e mantém a
-- transferência pra outra unidade como poder extra dela (consultor não
-- transfere).
--
-- Se esta migration for aplicada depois de uma versão anterior deste mesmo
-- arquivo já ter rodado (a que só liberava status), roda sem problema —
-- drop trigger/function "if exists" não erra em cima do que já foi feito.
drop trigger if exists veiculos_gerencia_apenas_transferencia on veiculos;
drop function if exists prevent_veiculo_gerencia_edicao();

drop policy if exists "veiculos: cadastro restrito à própria unidade, admin livre" on veiculos;
create policy "veiculos: cadastro restrito à própria unidade, admin livre"
  on veiculos for insert
  to authenticated
  with check (is_admin() or (unidade_id = get_my_unidade() and (get_my_cargo() = 'consultor' or is_gerencia())));

drop policy if exists "veiculos: exclusão restrita à própria unidade, admin livre" on veiculos;
create policy "veiculos: exclusão restrita à própria unidade, admin livre"
  on veiculos for delete
  to authenticated
  using (is_admin() or (unidade_id = get_my_unidade() and (get_my_cargo() = 'consultor' or is_gerencia())));

-- A policy de update (20260903000000) já não precisa mudar: o using já
-- alcança veículo da própria unidade pra gerência, e o with check já
-- libera is_gerencia() sem trava de unidade — é o que hoje permite ela
-- transferir. Sem o trigger, ela também edita os outros campos livremente.
