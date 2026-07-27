-- Troca com múltiplos veículos: antes a Ordem de Serviço guardava uma única
-- troca em colunas na própria ordens_servico (troca_marca, troca_valor_liquido,
-- ...). Agora a troca vira uma lista (0..N veículos), em tabela filha, espelhando
-- ordens_servico_pagamentos. As colunas antigas de troca ficam na ordens_servico
-- por retrocompatibilidade (registros antigos), mas o formulário novo grava aqui.

create table ordens_servico_trocas (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references ordens_servico(id) on delete cascade,
  marca text,
  modelo text,
  ano text,
  placa text,
  valor_avaliado numeric(12, 2) not null default 0,
  divida numeric(12, 2) not null default 0,
  -- valor_liquido = valor_avaliado - divida (o que a troca abate do total).
  valor_liquido numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index ordens_servico_trocas_ordem_id_idx on ordens_servico_trocas (ordem_id);

alter table ordens_servico_trocas enable row level security;

-- Segue a visibilidade/escrita da ordem-mãe, igual ordens_servico_pagamentos:
-- só quem enxerga a ordem mexe na troca, e só enquanto ela está pendente
-- (ou gerência).
create policy "ordens_servico_trocas: segue a visibilidade da ordem"
  on ordens_servico_trocas for all
  to authenticated
  using (
    exists (
      select 1 from ordens_servico o
      where o.id = ordens_servico_trocas.ordem_id
        and (is_gerencia() or (o.consultor_id = auth.uid() and o.unidade_id = get_my_unidade()))
    )
  )
  with check (
    exists (
      select 1 from ordens_servico o
      where o.id = ordens_servico_trocas.ordem_id
        and (is_gerencia() or (o.consultor_id = auth.uid() and o.unidade_id = get_my_unidade()))
        and (o.status = 'pendente' or is_gerencia())
    )
  );

-- Visualizador (CEO) lê tudo, como nas demais tabelas.
create policy "ordens_servico_trocas: visualizador lê tudo"
  on ordens_servico_trocas for select
  to authenticated
  using (is_visualizador());
