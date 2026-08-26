-- Cargo Social Media é read-only em todo o sistema: não escreve em nada. A
-- leitura de veiculos e unidades já é aberta pra qualquer autenticado
-- (using(true)), então não precisa de policy de select nova — só fechar
-- escrita. Mesma abordagem dos cargos visualizador (20260723020000) e
-- pos_venda (20260801010000): negar com policy RESTRICTIVE, que faz AND com
-- todas as outras, pra não depender de a pessoa ficar sem unidade cadastrada.
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
    -- Pula tabelas que não existam neste banco, pra migration não travar.
    continue when to_regclass('public.' || t) is null;

    execute format(
      'drop policy if exists "%s: social_media não insere" on %I', t, t);
    execute format(
      'create policy "%s: social_media não insere" on %I as restrictive for insert to authenticated with check (get_my_cargo() is distinct from ''social_media'')',
      t, t);

    execute format(
      'drop policy if exists "%s: social_media não edita" on %I', t, t);
    execute format(
      'create policy "%s: social_media não edita" on %I as restrictive for update to authenticated using (get_my_cargo() is distinct from ''social_media'') with check (get_my_cargo() is distinct from ''social_media'')',
      t, t);

    execute format(
      'drop policy if exists "%s: social_media não exclui" on %I', t, t);
    execute format(
      'create policy "%s: social_media não exclui" on %I as restrictive for delete to authenticated using (get_my_cargo() is distinct from ''social_media'')',
      t, t);
  end loop;
end $$;

-- Exceção: edita o próprio perfil (trocar o próprio nome), como qualquer
-- membro. O trigger prevent_privilege_escalation já impede mexer em
-- cargo/unidade.
drop policy if exists "profiles: social_media não edita" on profiles;

create policy "profiles: social_media não edita"
  on profiles as restrictive for update
  to authenticated
  using (id = auth.uid() or get_my_cargo() is distinct from 'social_media')
  with check (id = auth.uid() or get_my_cargo() is distinct from 'social_media');
