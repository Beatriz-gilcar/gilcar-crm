-- Paridade do cadastro de equipe com o sistema antigo (Google Apps Script).
--
-- 1. gerente_responsavel: no antigo era a coluna 4 da aba Equipes, texto livre
--    com o nome do gerente. Não era vínculo com nenhum cadastro, então aqui
--    também é text puro e não uma FK para profiles.
--
-- 2. ativo: o antigo excluía o membro apagando a linha da planilha. Aqui não dá
--    — profiles é referenciada por 14 FKs (tratos, ordens, metas, checklists…),
--    todas sem cascade e quase todas not null, então excluir de verdade ou
--    falha ou levaria o histórico junto. Desativar preserva os registros.
--
-- 3. Supervisor entra em is_gerencia(): no antigo ele já enxergava além dos
--    próprios registros e era notificado junto com os gerentes.

alter table profiles add column if not exists gerente_responsavel text;

alter table profiles add column if not exists ativo boolean not null default true;

create index if not exists profiles_ativo_idx on profiles (ativo);

create or replace function is_gerencia()
  returns boolean
  language sql security definer stable set search_path = public
  as $$ select coalesce(get_my_cargo() in ('gerente', 'supervisor', 'admin'), false) $$;

-- A policy de update de profiles é "id = auth.uid() or is_gerencia()", ou seja,
-- cada um edita o próprio perfil. Sem isto, um membro desativado se reativaria
-- sozinho e qualquer um trocaria o próprio gerente responsável. Os dois campos
-- novos entram na mesma trava que já protegia cargo e unidade: só admin.
create or replace function prevent_privilege_escalation()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if (new.cargo is distinct from old.cargo
      or new.unidade_id is distinct from old.unidade_id
      or new.ativo is distinct from old.ativo
      or new.gerente_responsavel is distinct from old.gerente_responsavel)
     and get_my_cargo() is distinct from 'admin' then
    raise exception 'Apenas admin pode alterar cargo, unidade, gerente responsável ou situação de um perfil';
  end if;
  return new;
end;
$$;
