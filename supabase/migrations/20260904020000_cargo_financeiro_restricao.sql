-- Cargo Financeiro: só enxerga as vendas que têm boleto entre os pagamentos,
-- e só pode mexer em vencimento/pago/pago_em desses boletos. Não escreve em
-- mais nada no sistema.

create or replace function is_financeiro()
  returns boolean
  language sql security definer stable set search_path = public
  as $$ select coalesce(get_my_cargo() = 'financeiro', false) $$;

-- Leitura: só a ordem que tem boleto, e só a linha de pagamento que é boleto
-- (uma venda pode ter split com outras formas — essas ficam de fora).
create policy "ordens_servico: financeiro vê vendas com boleto"
  on ordens_servico for select
  to authenticated
  using (
    is_financeiro() and exists (
      select 1 from ordens_servico_pagamentos p
      where p.ordem_id = ordens_servico.id and p.forma = 'boleto'
    )
  );

create policy "ordens_servico_pagamentos: financeiro vê boletos"
  on ordens_servico_pagamentos for select
  to authenticated
  using (is_financeiro() and forma = 'boleto');

-- Escrita: só update, só em linha de boleto. Cadastro/exclusão de pagamento
-- continuam de fora (nenhuma policy de insert/delete pra financeiro).
create policy "ordens_servico_pagamentos: financeiro atualiza vencimento e pagamento do boleto"
  on ordens_servico_pagamentos for update
  to authenticated
  using (is_financeiro() and forma = 'boleto')
  with check (is_financeiro() and forma = 'boleto');

-- Trava por coluna: a policy acima libera a linha inteira pro update; este
-- trigger garante que financeiro só muda vencimento/pago/pago_em, não valor
-- nem forma nem a venda de origem. Mesmo padrão de
-- prevent_veiculo_gerencia_edicao (20260903000000).
create or replace function prevent_boleto_financeiro_edicao()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if is_financeiro() then
    if new.forma is distinct from old.forma
      or new.valor is distinct from old.valor
      or new.ordem_id is distinct from old.ordem_id
    then
      raise exception 'Financeiro só pode atualizar vencimento e status de pagamento do boleto';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pagamentos_financeiro_apenas_boleto on ordens_servico_pagamentos;
create trigger pagamentos_financeiro_apenas_boleto
  before update on ordens_servico_pagamentos
  for each row execute function prevent_boleto_financeiro_edicao();

-- Read-only no resto do sistema. ordens_servico_pagamentos fica de fora da
-- lista de propósito — é lá que ele precisa escrever (nos dois campos acima).
-- Mesma abordagem dos cargos visualizador (20260723020000), pos_venda
-- (20260801010000) e social_media (20260903020000).
do $$
declare
  t text;
  tabelas text[] := array[
    'profiles', 'clientes', 'contatos', 'atendimentos', 'lembretes', 'tratos',
    'ordens_servico', 'vendas', 'vendas_protecao',
    'veiculos', 'metas', 'aprovacoes_dia', 'aprovacoes_consultor_dia',
    'checklists_gerencia', 'checklist_itens', 'unidades'
  ];
begin
  foreach t in array tabelas loop
    continue when to_regclass('public.' || t) is null;

    execute format(
      'drop policy if exists "%s: financeiro não insere" on %I', t, t);
    execute format(
      'create policy "%s: financeiro não insere" on %I as restrictive for insert to authenticated with check (get_my_cargo() is distinct from ''financeiro'')',
      t, t);

    execute format(
      'drop policy if exists "%s: financeiro não edita" on %I', t, t);
    execute format(
      'create policy "%s: financeiro não edita" on %I as restrictive for update to authenticated using (get_my_cargo() is distinct from ''financeiro'') with check (get_my_cargo() is distinct from ''financeiro'')',
      t, t);

    execute format(
      'drop policy if exists "%s: financeiro não exclui" on %I', t, t);
    execute format(
      'create policy "%s: financeiro não exclui" on %I as restrictive for delete to authenticated using (get_my_cargo() is distinct from ''financeiro'')',
      t, t);
  end loop;
end $$;

-- Exceção: edita o próprio perfil (trocar o próprio nome). O trigger
-- prevent_privilege_escalation já impede mexer em cargo/unidade.
drop policy if exists "profiles: financeiro não edita" on profiles;

create policy "profiles: financeiro não edita"
  on profiles as restrictive for update
  to authenticated
  using (id = auth.uid() or get_my_cargo() is distinct from 'financeiro')
  with check (id = auth.uid() or get_my_cargo() is distinct from 'financeiro');
