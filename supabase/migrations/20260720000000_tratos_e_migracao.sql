-- Módulo Tratos: compromissos/negociações combinadas com o cliente,
-- conceito próprio do negócio (dá nome ao app), separado de Lembretes.

create type trato_status as enum ('pendente', 'cumprido', 'nao_cumprido');

create table tratos (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references profiles(id),
  unidade_id uuid not null references unidades(id),
  cliente_nome text not null,
  celular text,
  veiculo text,
  combinado text not null,
  data date not null default current_date,
  prazo date,
  status trato_status not null default 'pendente',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tratos_consultor_id_idx on tratos (consultor_id);
create index tratos_unidade_id_idx on tratos (unidade_id);
create index tratos_prazo_idx on tratos (prazo);

alter table tratos enable row level security;

create policy "tratos: consultor vê os próprios na sua unidade, gerência vê tudo"
  on tratos for select
  to authenticated
  using (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "tratos: consultor cadastra pra si na sua unidade, gerência pra qualquer um"
  on tratos for insert
  to authenticated
  with check (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "tratos: consultor edita os próprios, gerência edita tudo"
  on tratos for update
  to authenticated
  using (is_gerencia() or (consultor_id = auth.uid() and unidade_id = get_my_unidade()));

create policy "tratos: apenas gerência exclui"
  on tratos for delete
  to authenticated
  using (is_gerencia());

-- ── Rastreio de migração ────────────────────────────────────────────────
-- Usado pelo script de importação da planilha antiga (scripts/migrar-dados.ts)
-- pra garantir que rodar o script de novo não duplica nada: cada linha
-- de origem gera uma "chave" estável, e o script pula o que já existe aqui.

create table migracao_importados (
  chave text primary key,
  tabela text not null,
  registro_id uuid,
  created_at timestamptz not null default now()
);

alter table migracao_importados enable row level security;

create policy "migracao_importados: apenas admin"
  on migracao_importados for all
  to authenticated
  using (is_admin())
  with check (is_admin());
