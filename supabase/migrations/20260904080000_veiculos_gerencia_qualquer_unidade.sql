-- Gerência (gerente/supervisor) passa a cadastrar, editar e excluir veículo
-- de QUALQUER unidade, não só a própria — mesmo alcance do admin. Consultor
-- continua restrito à própria unidade nos três casos.
--
-- is_gerencia() já inclui admin (get_my_cargo() in ('gerente', 'supervisor',
-- 'admin')), então basta ela sem a trava de unidade_id = get_my_unidade().

drop policy if exists "veiculos: cadastro restrito à própria unidade, admin livre" on veiculos;
create policy "veiculos: cadastro restrito à própria unidade, gerência livre"
  on veiculos for insert
  to authenticated
  with check (is_gerencia() or (unidade_id = get_my_unidade() and get_my_cargo() = 'consultor'));

drop policy if exists "veiculos: edição restrita à própria unidade, admin livre, gerência transfere" on veiculos;
create policy "veiculos: edição restrita à própria unidade, gerência livre"
  on veiculos for update
  to authenticated
  using (is_gerencia() or (unidade_id = get_my_unidade() and get_my_cargo() = 'consultor'))
  with check (is_gerencia() or (unidade_id = get_my_unidade() and get_my_cargo() = 'consultor'));

drop policy if exists "veiculos: exclusão restrita à própria unidade, admin livre" on veiculos;
create policy "veiculos: exclusão restrita à própria unidade, gerência livre"
  on veiculos for delete
  to authenticated
  using (is_gerencia() or (unidade_id = get_my_unidade() and get_my_cargo() = 'consultor'));
