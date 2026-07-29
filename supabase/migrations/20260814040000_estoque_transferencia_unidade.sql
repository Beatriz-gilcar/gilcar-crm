-- Gerência (gerente/supervisor) passa a poder transferir um veículo do
-- estoque para outra unidade, não só o admin. A trava de origem continua:
-- só mexe em veículo que já é da própria unidade (using), só o destino que
-- fica livre pra gerência (with check) — consultor continua preso à própria
-- unidade nos dois lados.
drop policy if exists "veiculos: edição restrita à própria unidade, admin livre" on veiculos;
create policy "veiculos: edição restrita à própria unidade, admin livre, gerência transfere"
  on veiculos for update
  to authenticated
  using (is_admin() or unidade_id = get_my_unidade())
  with check (is_admin() or is_gerencia() or unidade_id = get_my_unidade());
