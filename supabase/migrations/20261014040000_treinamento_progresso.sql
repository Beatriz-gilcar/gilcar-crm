-- Barra de progresso do treinamento de novos consultores. Lista de etapas
-- fixa em código (ETAPAS_TREINAMENTO, src/lib/treinamento.ts) — não é
-- tabela de template, mesma decisão de ITENS_CONFERENCIA_PADRAO.
--
-- Presença de linha = etapa concluída; ausência = pendente. Quem marca é
-- SEMPRE a gerência (gerente/supervisor/admin) — consultor só lê o próprio
-- progresso. Gerente/supervisor ficam restritos à própria unidade em código
-- de aplicação (src/app/treinamento/actions.ts), não em RLS — mesmo padrão
-- já usado em ordens_servico/vendas (is_gerencia() não restringe por
-- unidade sozinho).

create table treinamento_progresso (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references profiles(id),
  etapa text not null,
  concluido_por uuid not null references profiles(id),
  concluido_em timestamptz not null default now(),
  unique (consultor_id, etapa)
);

alter table treinamento_progresso enable row level security;

-- Policies permissivas se somam com OR — cada "quem lê" é uma policy própria
-- (mesmo idioma de is_visualizador(), 20260723020000).
create policy "treinamento_progresso: dono vê a própria"
  on treinamento_progresso for select
  to authenticated
  using (consultor_id = auth.uid());

create policy "treinamento_progresso: gerência lê tudo"
  on treinamento_progresso for select
  to authenticated
  using (is_gerencia());

create policy "treinamento_progresso: visualizador lê tudo"
  on treinamento_progresso for select
  to authenticated
  using (is_visualizador());

-- Só gerência escreve. Tabela nova, sem policy de escrita antiga pra
-- fechar — não marcar/desmarcar já nega por padrão pra quem não é gerência.
create policy "treinamento_progresso: gerência marca etapa"
  on treinamento_progresso for insert
  to authenticated
  with check (is_gerencia());

create policy "treinamento_progresso: gerência atualiza etapa"
  on treinamento_progresso for update
  to authenticated
  using (is_gerencia())
  with check (is_gerencia());

create policy "treinamento_progresso: gerência desmarca etapa"
  on treinamento_progresso for delete
  to authenticated
  using (is_gerencia());
