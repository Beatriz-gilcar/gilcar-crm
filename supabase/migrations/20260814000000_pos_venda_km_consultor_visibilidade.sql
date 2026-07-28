-- Três ajustes no Pós-venda:
-- 1) Guarda o KM da ordem de venda, pra Luciana ver sem precisar da OS.
-- 2) Guarda o consultor da venda, pra dar pra filtrar visibilidade por dono.
-- 3) Visibilidade igual ao resto do sistema: consultor vê só o próprio,
--    gerente/supervisor só da própria unidade, admin/visualizador/pos_venda
--    veem tudo.

alter table pos_venda add column veiculo_km text;
alter table pos_venda add column consultor_id uuid references profiles(id);

drop policy "pos_venda: leitura para qualquer autenticado" on pos_venda;

create policy "pos_venda: consultor ve o proprio, gerencia a unidade, admin/pos_venda tudo"
  on pos_venda for select
  to authenticated
  using (
    is_admin()
    or is_visualizador()
    or get_my_cargo() = 'pos_venda'
    or (get_my_cargo() in ('gerente', 'supervisor') and unidade_id = get_my_unidade())
    or consultor_id = auth.uid()
  );

drop policy "pos_venda_itens: leitura para qualquer autenticado" on pos_venda_itens;

create policy "pos_venda_itens: segue a visibilidade do pos_venda"
  on pos_venda_itens for select
  to authenticated
  using (
    exists (
      select 1 from pos_venda p
      where p.id = pos_venda_itens.pos_venda_id
        and (
          is_admin()
          or is_visualizador()
          or get_my_cargo() = 'pos_venda'
          or (get_my_cargo() in ('gerente', 'supervisor') and p.unidade_id = get_my_unidade())
          or p.consultor_id = auth.uid()
        )
    )
  );
