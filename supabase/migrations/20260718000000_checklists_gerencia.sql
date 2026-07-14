-- Módulo Gerência: checklist de cobrança (diário/semanal/mensal).

create type checklist_tipo as enum ('diario', 'semanal', 'mensal');

create table checklists_gerencia (
  id uuid primary key default gen_random_uuid(),
  tipo checklist_tipo not null,
  avaliado_id uuid not null references profiles(id),
  avaliador_id uuid not null references profiles(id),
  unidade_id uuid not null references unidades(id),
  data date not null default current_date,
  percentual_sim numeric(5, 2) not null,
  created_at timestamptz not null default now()
);

create index checklists_gerencia_avaliado_id_idx on checklists_gerencia (avaliado_id);
create index checklists_gerencia_tipo_idx on checklists_gerencia (tipo);
create index checklists_gerencia_data_idx on checklists_gerencia (data);

create table checklist_itens (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists_gerencia(id) on delete cascade,
  ordem integer not null,
  pergunta text not null,
  resposta boolean not null,
  observacao text,
  created_at timestamptz not null default now()
);

create index checklist_itens_checklist_id_idx on checklist_itens (checklist_id);

alter table checklists_gerencia enable row level security;
alter table checklist_itens enable row level security;

-- Admin vê tudo; gerente só vê os checklists em que ele é o avaliado
-- (não vê a avaliação de outro gerente/unidade).
create policy "checklists_gerencia: admin vê tudo, gerente vê os próprios"
  on checklists_gerencia for select
  to authenticated
  using (is_admin() or avaliado_id = auth.uid());

-- Só gerência preenche; gerente só preenche pra si mesmo, admin preenche
-- pra qualquer gerente.
create policy "checklists_gerencia: gerência preenche, gerente só pra si"
  on checklists_gerencia for insert
  to authenticated
  with check (
    is_gerencia()
    and avaliador_id = auth.uid()
    and (is_admin() or avaliado_id = auth.uid())
  );

create policy "checklist_itens: segue a visibilidade do checklist"
  on checklist_itens for all
  to authenticated
  using (
    exists (
      select 1 from checklists_gerencia c
      where c.id = checklist_itens.checklist_id
        and (is_admin() or c.avaliado_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from checklists_gerencia c
      where c.id = checklist_itens.checklist_id
        and (is_admin() or c.avaliado_id = auth.uid())
    )
  );
