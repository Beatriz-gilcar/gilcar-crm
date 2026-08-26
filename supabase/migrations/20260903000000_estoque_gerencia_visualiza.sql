-- Gerência (gerente/supervisor) passa a só poder transferir veículo entre
-- unidades — perde edição dos demais campos, cadastro e exclusão no Estoque.
-- SDR também vira só-leitura no Estoque: a policy antiga de insert/update/
-- delete era "unidade_id = get_my_unidade()", que não checava cargo — um sdr
-- com unidade cadastrada passaria. Ficar explícito no cargo é o que fecha,
-- mesmo raciocínio do cargo visualizador (20260723020000).
--
-- Consultor mantém tudo como já era: cadastra/edita/exclui só da própria
-- unidade. Admin continua irrestrito. A leitura (select) não muda — já era
-- aberta pra qualquer autenticado, é o que deixa consultor ver o estoque de
-- outras unidades hoje.

drop policy if exists "veiculos: cadastro restrito à própria unidade, admin livre" on veiculos;
create policy "veiculos: cadastro restrito à própria unidade, admin livre"
  on veiculos for insert
  to authenticated
  with check (is_admin() or (unidade_id = get_my_unidade() and get_my_cargo() = 'consultor'));

drop policy if exists "veiculos: edição restrita à própria unidade, admin livre, gerência transfere" on veiculos;
create policy "veiculos: edição restrita à própria unidade, admin livre, gerência transfere"
  on veiculos for update
  to authenticated
  using (is_admin() or (unidade_id = get_my_unidade() and (get_my_cargo() = 'consultor' or is_gerencia())))
  with check (is_admin() or is_gerencia() or (unidade_id = get_my_unidade() and get_my_cargo() = 'consultor'));

drop policy if exists "veiculos: exclusão restrita à própria unidade, admin livre" on veiculos;
create policy "veiculos: exclusão restrita à própria unidade, admin livre"
  on veiculos for delete
  to authenticated
  using (is_admin() or (unidade_id = get_my_unidade() and get_my_cargo() = 'consultor'));

-- Trava por coluna: RLS só barra linha inteira, não campo. A policy de update
-- acima precisa deixar gerência alcançar a linha (pra poder transferir) —
-- este trigger garante que, se não for admin, a única coluna que muda de
-- fato é unidade_id. Mesmo padrão de prevent_os_status_tampering /
-- prevent_holerite_tampering.
create or replace function prevent_veiculo_gerencia_edicao()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if is_gerencia() and not is_admin() then
    if new.marca is distinct from old.marca
      or new.modelo is distinct from old.modelo
      or new.cambio is distinct from old.cambio
      or new.gnv is distinct from old.gnv
      or new.blindado is distinct from old.blindado
      or new.cor is distinct from old.cor
      or new.ano is distinct from old.ano
      or new.placa is distinct from old.placa
      or new.licenciado_ate is distinct from old.licenciado_ate
      or new.no_site is distinct from old.no_site
      or new.status is distinct from old.status
      or new.observacao is distinct from old.observacao
    then
      raise exception 'Gerência só pode transferir o veículo de unidade, não editar seus dados';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists veiculos_gerencia_apenas_transferencia on veiculos;
create trigger veiculos_gerencia_apenas_transferencia
  before update on veiculos
  for each row execute function prevent_veiculo_gerencia_edicao();
