-- Pós-venda passa a ser editável SÓ pelo cargo pos_venda (Luciana). Antes
-- gerência e admin também escreviam; agora só ela. Todo o resto (consultor,
-- gerência, admin, visualizador) apenas lê — as policies de escrita da tabela
-- pos_venda usam esta função, então basta redefini-la.
create or replace function pode_editar_pos_venda()
  returns boolean
  language sql security definer stable set search_path = public
  as $$ select coalesce(get_my_cargo() = 'pos_venda', false) $$;
