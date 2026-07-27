-- Módulo Pós-venda: acompanhamento dos veículos já vendidos (entrega, revisão,
-- garantia/manutenção). Cada registro nasce de uma venda aprovada (ordem_id) ou
-- é criado manualmente (cliente/veículo digitados à mão, ex.: carro vendido
-- antes do sistema). A Luciana (cargo pos_venda) edita; gerência/admin também;
-- consultores só leem.

create type pos_venda_status as enum ('aberto', 'em_andamento', 'concluido');

create table pos_venda (
  id uuid primary key default gen_random_uuid(),
  -- Vínculo opcional com a venda de origem. on delete set null: se a ordem for
  -- apagada, o registro de pós-venda continua (cliente/veículo ficam no snapshot).
  ordem_id uuid references ordens_servico(id) on delete set null,
  unidade_id uuid references unidades(id),
  cliente_nome text not null,
  veiculo_marca text not null,
  veiculo_modelo text not null,
  veiculo_placa text,
  status pos_venda_status not null default 'aberto',
  entrega_em date,
  revisao_em date,
  -- Onde o veículo está no momento (oficina/prestador de serviço).
  prestador text,
  -- Anotações livres de garantia/manutenção.
  anotacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pos_venda_ordem_id_idx on pos_venda (ordem_id);
create index pos_venda_status_idx on pos_venda (status);

-- Quem pode escrever no Pós-venda: gerência/admin e o cargo pos_venda.
create function pode_editar_pos_venda()
  returns boolean
  language sql security definer stable set search_path = public
  as $$ select coalesce(is_gerencia() or get_my_cargo() = 'pos_venda', false) $$;

alter table pos_venda enable row level security;

-- Leitura liberada para qualquer autenticado (consultores visualizam).
create policy "pos_venda: leitura para qualquer autenticado"
  on pos_venda for select
  to authenticated
  using (true);

create policy "pos_venda: só editores inserem"
  on pos_venda for insert
  to authenticated
  with check (pode_editar_pos_venda());

create policy "pos_venda: só editores editam"
  on pos_venda for update
  to authenticated
  using (pode_editar_pos_venda())
  with check (pode_editar_pos_venda());

create policy "pos_venda: só editores excluem"
  on pos_venda for delete
  to authenticated
  using (pode_editar_pos_venda());

-- O cargo pos_venda é read-only em todo o resto do sistema: escreve só na tabela
-- pos_venda. Sem isto, com uma unidade cadastrada ela conseguiria editar o
-- estoque da própria unidade (policy "is_admin() or unidade_id = get_my_unidade()")
-- e, onde o caminho é "consultor_id = auth.uid()", criar registros pra si mesma.
-- Mesma abordagem do cargo visualizador (20260723020000): negar escrita com
-- policy RESTRICTIVE, que faz AND com todas as outras. A tabela pos_venda fica
-- de fora da lista de propósito — é lá que ela precisa escrever.
do $$
declare
  t text;
  tabelas text[] := array[
    'profiles', 'clientes', 'contatos', 'atendimentos', 'lembretes', 'tratos',
    'ordens_servico', 'ordens_servico_pagamentos', 'vendas', 'vendas_protecao',
    'veiculos', 'metas', 'aprovacoes_dia', 'aprovacoes_consultor_dia',
    'checklists_gerencia', 'checklist_itens', 'unidades'
  ];
begin
  foreach t in array tabelas loop
    -- Pula tabelas que não existam neste banco, pra migration não travar.
    continue when to_regclass('public.' || t) is null;

    execute format(
      'drop policy if exists "%s: pos_venda não insere" on %I', t, t);
    execute format(
      'create policy "%s: pos_venda não insere" on %I as restrictive for insert to authenticated with check (get_my_cargo() is distinct from ''pos_venda'')',
      t, t);

    execute format(
      'drop policy if exists "%s: pos_venda não edita" on %I', t, t);
    execute format(
      'create policy "%s: pos_venda não edita" on %I as restrictive for update to authenticated using (get_my_cargo() is distinct from ''pos_venda'') with check (get_my_cargo() is distinct from ''pos_venda'')',
      t, t);

    execute format(
      'drop policy if exists "%s: pos_venda não exclui" on %I', t, t);
    execute format(
      'create policy "%s: pos_venda não exclui" on %I as restrictive for delete to authenticated using (get_my_cargo() is distinct from ''pos_venda'')',
      t, t);
  end loop;
end $$;

-- Exceção: edita o próprio perfil (trocar o próprio nome), como qualquer membro.
-- O trigger prevent_privilege_escalation já impede mexer em cargo/unidade.
drop policy if exists "profiles: pos_venda não edita" on profiles;

create policy "profiles: pos_venda não edita"
  on profiles as restrictive for update
  to authenticated
  using (id = auth.uid() or get_my_cargo() is distinct from 'pos_venda')
  with check (id = auth.uid() or get_my_cargo() is distinct from 'pos_venda');
