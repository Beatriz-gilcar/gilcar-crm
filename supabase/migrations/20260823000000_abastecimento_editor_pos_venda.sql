-- Quem define o dia de abastecimento é a Luciana (pos_venda), não o admin —
-- corrige a permissão que tinha ficado ao contrário. Reaproveita
-- pode_editar_pos_venda() (gerência + cargo pos_venda), a mesma função já
-- usada pra tabela pos_venda e pos_venda_lancamentos.

drop policy "abastecimento_config: só admin insere" on abastecimento_config;
drop policy "abastecimento_config: só admin atualiza" on abastecimento_config;
drop policy "abastecimento_config: só admin exclui" on abastecimento_config;

create policy "abastecimento_config: só editores inserem"
  on abastecimento_config for insert
  to authenticated
  with check (pode_editar_pos_venda());

create policy "abastecimento_config: só editores atualizam"
  on abastecimento_config for update
  to authenticated
  using (pode_editar_pos_venda())
  with check (pode_editar_pos_venda());

create policy "abastecimento_config: só editores excluem"
  on abastecimento_config for delete
  to authenticated
  using (pode_editar_pos_venda());
