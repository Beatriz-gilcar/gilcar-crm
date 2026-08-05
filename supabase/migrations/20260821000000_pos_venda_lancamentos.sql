-- Lançamentos diários de despesas de pós-venda (peças, chaveiro, reembolsos
-- etc.) que a Luciana hoje manda por WhatsApp pro financeiro — um valor por
-- item, com o fornecedor a pagar, pra somar o total do dia e por fornecedor.

create table pos_venda_lancamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  veiculo_placa text,
  descricao text not null,
  fornecedor text not null,
  valor numeric(12,2) not null,
  observacao text,
  criado_por uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index pos_venda_lancamentos_data_idx on pos_venda_lancamentos (data);
create index pos_venda_lancamentos_fornecedor_idx on pos_venda_lancamentos (fornecedor);

alter table pos_venda_lancamentos enable row level security;

-- Mesma regra de acesso da tabela pos_venda: qualquer autenticado lê, só
-- quem edita pós-venda (Luciana + gerência/admin) lança e exclui.
create policy "pos_venda_lancamentos: leitura para qualquer autenticado"
  on pos_venda_lancamentos for select
  to authenticated
  using (true);

create policy "pos_venda_lancamentos: só editores inserem"
  on pos_venda_lancamentos for insert
  to authenticated
  with check (pode_editar_pos_venda());

create policy "pos_venda_lancamentos: só editores excluem"
  on pos_venda_lancamentos for delete
  to authenticated
  using (pode_editar_pos_venda());
