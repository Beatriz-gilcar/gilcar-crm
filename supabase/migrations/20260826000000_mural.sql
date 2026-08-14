-- Mural de dúvidas e sugestões: qualquer um posta, qualquer um vê e responde
-- (mural aberto, não é suporte 1 a 1). Gerência/admin recebe aviso dentro do
-- sistema quando chega post novo, no mesmo molde do AbastecimentoAlertWidget.

create table mural_posts (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references profiles(id),
  tipo text not null check (tipo in ('duvida', 'sugestao')),
  titulo text not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create table mural_respostas (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references mural_posts(id) on delete cascade,
  autor_id uuid not null references profiles(id),
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index mural_posts_created_at_idx on mural_posts (created_at desc);
create index mural_respostas_post_id_idx on mural_respostas (post_id);

alter table mural_posts enable row level security;
alter table mural_respostas enable row level security;

create policy "mural_posts: leitura para qualquer autenticado"
  on mural_posts for select
  to authenticated
  using (true);

create policy "mural_posts: autor cria o proprio"
  on mural_posts for insert
  to authenticated
  with check (autor_id = auth.uid());

create policy "mural_posts: autor ou admin exclui"
  on mural_posts for delete
  to authenticated
  using (autor_id = auth.uid() or is_admin());

create policy "mural_respostas: leitura para qualquer autenticado"
  on mural_respostas for select
  to authenticated
  using (true);

create policy "mural_respostas: autor cria a propria"
  on mural_respostas for insert
  to authenticated
  with check (autor_id = auth.uid());

create policy "mural_respostas: autor ou admin exclui"
  on mural_respostas for delete
  to authenticated
  using (autor_id = auth.uid() or is_admin());
