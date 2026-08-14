-- Responder no Mural passa a ser só do admin (Junior/Beatriz) — qualquer um
-- publica dúvida/sugestão, mas só o admin responde oficialmente.

drop policy if exists "mural_respostas: autor cria a propria" on mural_respostas;

create policy "mural_respostas: so admin responde"
  on mural_respostas for insert
  to authenticated
  with check (autor_id = auth.uid() and is_admin());
