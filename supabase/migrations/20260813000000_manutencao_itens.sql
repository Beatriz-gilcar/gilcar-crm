-- Manutenção vira lista de tópicos (não mais um textarea só). O consultor
-- lança cada serviço como um item na Ordem de Serviço (mesmo padrão da lista
-- de Troca); quando a venda é aprovada, cada item vira uma linha em
-- pos_venda_itens, que a Luciana marca como feito e diz o local. Ela também
-- pode adicionar item novo direto no Pós-venda.

create table ordens_servico_manutencao_itens (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references ordens_servico(id) on delete cascade,
  descricao text not null,
  posicao integer not null default 0,
  created_at timestamptz not null default now()
);

create index ordens_servico_manutencao_itens_ordem_id_idx on ordens_servico_manutencao_itens (ordem_id);

alter table ordens_servico_manutencao_itens enable row level security;

-- Mesma visibilidade da ordem (igual ordens_servico_pagamentos/trocas).
create policy "ordens_servico_manutencao_itens: segue a visibilidade da ordem"
  on ordens_servico_manutencao_itens for all
  to authenticated
  using (
    exists (
      select 1 from ordens_servico o
      where o.id = ordens_servico_manutencao_itens.ordem_id
        and (is_gerencia() or (o.consultor_id = auth.uid() and o.unidade_id = get_my_unidade()))
    )
  )
  with check (
    exists (
      select 1 from ordens_servico o
      where o.id = ordens_servico_manutencao_itens.ordem_id
        and (is_gerencia() or (o.consultor_id = auth.uid() and o.unidade_id = get_my_unidade()))
        and (o.status = 'pendente' or is_gerencia())
    )
  );

create table pos_venda_itens (
  id uuid primary key default gen_random_uuid(),
  pos_venda_id uuid not null references pos_venda(id) on delete cascade,
  descricao text not null,
  feito boolean not null default false,
  local text,
  criado_por uuid references profiles(id),
  posicao integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pos_venda_itens_pos_venda_id_idx on pos_venda_itens (pos_venda_id);

alter table pos_venda_itens enable row level security;

-- Leitura liberada, igual pos_venda. Escrita só pra quem edita Pós-venda —
-- hoje só o cargo pos_venda (Luciana), espelhando pode_editar_pos_venda().
create policy "pos_venda_itens: leitura para qualquer autenticado"
  on pos_venda_itens for select
  to authenticated
  using (true);

create policy "pos_venda_itens: só editores escrevem"
  on pos_venda_itens for all
  to authenticated
  using (pode_editar_pos_venda())
  with check (pode_editar_pos_venda());
