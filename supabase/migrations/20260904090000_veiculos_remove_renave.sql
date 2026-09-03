-- Reverte o controle de registro Renave (20260904060000): feature removida,
-- não vai mais pra frente.
alter table veiculos drop column if exists renave_entrada_registrado;
alter table veiculos drop column if exists renave_entrada_em;
