-- Conserta o lançamento de atendimento pela Ficha.
--
-- A migration anterior tornou atendimentos.cliente_id opcional, mas deixou de
-- pé a policy que amarrava a permissão à existência do cliente:
--
--   using (exists (select 1 from clientes c where c.id = atendimentos.cliente_id ...))
--
-- Com cliente_id nulo o exists() dá falso e a policy nega tudo — inclusive o
-- insert. Resultado: a Ficha subiu sem conseguir gravar atendimento nenhum.
--
-- A visibilidade passa a seguir o consultor, que é o modelo do sistema antigo
-- (a aba Atendimento tem vendedor e unidade, não tem lead). Não é preciso
-- checar unidade: consultor_id = auth.uid() já significa "registro meu", e a
-- unidade do registro é a do próprio perfil.
--
-- As policies restritivas do visualizador continuam valendo por cima: elas são
-- separadas e fazem AND com estas.

drop policy if exists "atendimentos: segue a visibilidade do cliente" on atendimentos;

create policy "atendimentos: consultor vê os próprios, gerência vê tudo"
  on atendimentos for select
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());

create policy "atendimentos: consultor lança pra si, gerência pra qualquer um"
  on atendimentos for insert
  to authenticated
  with check (is_gerencia() or consultor_id = auth.uid());

create policy "atendimentos: consultor edita os próprios, gerência edita tudo"
  on atendimentos for update
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid())
  with check (is_gerencia() or consultor_id = auth.uid());

create policy "atendimentos: consultor exclui os próprios, gerência exclui tudo"
  on atendimentos for delete
  to authenticated
  using (is_gerencia() or consultor_id = auth.uid());
