-- Cargo Visualizador: lê tudo, não escreve nada. É o acesso do CEO.
--
-- No sistema antigo isso era `body.modo-visualizador`, um CSS que escondia os
-- botões de escrita (Html:133-134). Sumia o botão da tela, mas a função do
-- servidor continuava chamável — não era uma trava, era um disfarce. Aqui a
-- regra vive no banco.
--
-- Duas decisões de desenho:
--
-- 1. A LEITURA entra como policy permissiva nova, em vez de reescrever as
--    policies existentes. Policies permissivas se somam com OR, então
--    "using (is_visualizador())" libera o visualizador sem alterar em nada o
--    que consultor, gerente e admin já enxergam.
--
-- 2. A ESCRITA é negada com policy RESTRICTIVE, que faz AND com todas as
--    outras. Isso é necessário, e não paranoia: as policies de escrita de hoje
--    não checam cargo. A do estoque é "is_admin() or unidade_id =
--    get_my_unidade()" — um visualizador com unidade cadastrada passaria. E em
--    todas as outras tabelas o ramo "consultor_id = auth.uid()" deixaria ele
--    criar registros pra si mesmo. Negar explicitamente é o que fecha.

create or replace function is_visualizador()
  returns boolean
  language sql security definer stable set search_path = public
  as $$ select coalesce(get_my_cargo() = 'visualizador', false) $$;

do $$
declare
  t text;
  tabelas text[] := array[
    'profiles', 'clientes', 'contatos', 'atendimentos', 'lembretes', 'tratos',
    'ordens_servico', 'ordens_servico_pagamentos', 'vendas', 'vendas_protecao',
    'veiculos', 'metas', 'aprovacoes_dia', 'aprovacoes_consultor_dia',
    'checklists_gerencia', 'checklist_itens', 'unidades'
  ];
begin
  foreach t in array tabelas loop
    -- Leitura liberada (soma com as policies que já existem).
    execute format(
      'drop policy if exists "%s: visualizador lê tudo" on %I', t, t);
    execute format(
      'create policy "%s: visualizador lê tudo" on %I for select to authenticated using (is_visualizador())',
      t, t);

    -- Escrita negada em qualquer caminho.
    execute format(
      'drop policy if exists "%s: visualizador não insere" on %I', t, t);
    execute format(
      'create policy "%s: visualizador não insere" on %I as restrictive for insert to authenticated with check (not is_visualizador())',
      t, t);

    execute format(
      'drop policy if exists "%s: visualizador não edita" on %I', t, t);
    execute format(
      'create policy "%s: visualizador não edita" on %I as restrictive for update to authenticated using (not is_visualizador()) with check (not is_visualizador())',
      t, t);

    execute format(
      'drop policy if exists "%s: visualizador não exclui" on %I', t, t);
    execute format(
      'create policy "%s: visualizador não exclui" on %I as restrictive for delete to authenticated using (not is_visualizador())',
      t, t);
  end loop;
end $$;

-- Exceção: o visualizador edita o próprio perfil (trocar o próprio nome), igual
-- qualquer outro membro. O trigger prevent_privilege_escalation já impede que
-- ele mexa em cargo, unidade, gerente responsável ou situação.
drop policy if exists "profiles: visualizador não edita" on profiles;

create policy "profiles: visualizador não edita"
  on profiles as restrictive for update
  to authenticated
  using (id = auth.uid() or not is_visualizador())
  with check (id = auth.uid() or not is_visualizador());
