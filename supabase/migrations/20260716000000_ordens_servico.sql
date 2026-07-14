-- Módulo de Ordem de Serviço (venda/compra de veículos).

create type os_tipo as enum ('venda', 'compra');
create type os_status as enum ('pendente', 'aprovada', 'reprovada');
create type forma_pagamento as enum (
  'dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'boleto', 'consorcio', 'transferencia'
);

create table ordens_servico (
  id uuid primary key default gen_random_uuid(),
  tipo os_tipo not null,
  unidade_id uuid not null references unidades(id),
  consultor_id uuid not null references profiles(id),

  -- Dados do comprador (venda) / vendedor (compra) — a contraparte da negociação.
  cliente_nome text not null,
  cliente_cpf_cnpj text,
  cliente_rg text,
  cliente_endereco text,
  cliente_celular text,
  cliente_email text,

  -- Veículo objeto da negociação (pode vir do Estoque ou ser avulso).
  veiculo_id uuid references veiculos(id),
  veiculo_marca text not null,
  veiculo_modelo text not null,
  veiculo_ano text,
  veiculo_placa text,
  veiculo_cor text,

  valor_total numeric(12, 2) not null,
  desconto numeric(12, 2) not null default 0,

  -- Veículo dado como parte de pagamento (só em venda).
  tem_troca boolean not null default false,
  troca_marca text,
  troca_modelo text,
  troca_ano text,
  troca_placa text,
  troca_valor_avaliado numeric(12, 2),
  troca_divida numeric(12, 2),
  troca_valor_liquido numeric(12, 2),

  valor_financiado numeric(12, 2) not null default 0,
  financeira text,

  -- Snapshot do cálculo automático (recalculado a cada save pela aplicação).
  falta_receber numeric(12, 2) not null default 0,

  data_venda date not null default current_date,
  data_entrega date,

  status os_status not null default 'pendente',
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  motivo_reprovacao text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ordens_servico_troca_so_em_venda check (tipo = 'venda' or tem_troca = false)
);

create index ordens_servico_unidade_id_idx on ordens_servico (unidade_id);
create index ordens_servico_consultor_id_idx on ordens_servico (consultor_id);
create index ordens_servico_status_idx on ordens_servico (status);
create index ordens_servico_data_venda_idx on ordens_servico (data_venda);

create table ordens_servico_pagamentos (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references ordens_servico(id) on delete cascade,
  forma forma_pagamento not null,
  valor numeric(12, 2) not null check (valor > 0),
  created_at timestamptz not null default now()
);

create index ordens_servico_pagamentos_ordem_id_idx on ordens_servico_pagamentos (ordem_id);

-- Impede que consultor aprove/reprove a própria ordem ou edite uma ordem
-- já avaliada (só gerência mexe depois da decisão).
create function prevent_os_status_tampering()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if (
    new.status is distinct from old.status
    or new.aprovado_por is distinct from old.aprovado_por
    or new.aprovado_em is distinct from old.aprovado_em
    or new.motivo_reprovacao is distinct from old.motivo_reprovacao
  ) and not is_gerencia() then
    raise exception 'Apenas gerência pode aprovar ou reprovar uma ordem de serviço';
  end if;

  if old.status <> 'pendente' and not is_gerencia() then
    raise exception 'Ordem já avaliada não pode mais ser editada';
  end if;

  return new;
end;
$$;

create trigger ordens_servico_prevent_tampering
  before update on ordens_servico
  for each row execute function prevent_os_status_tampering();

alter table ordens_servico enable row level security;
alter table ordens_servico_pagamentos enable row level security;

create policy "ordens_servico: consultor vê as próprias na sua unidade, gerência vê tudo"
  on ordens_servico for select
  to authenticated
  using (
    is_gerencia()
    or (consultor_id = auth.uid() and unidade_id = get_my_unidade())
  );

create policy "ordens_servico: consultor cadastra para si na sua unidade, gerência para qualquer um"
  on ordens_servico for insert
  to authenticated
  with check (
    is_gerencia()
    or (consultor_id = auth.uid() and unidade_id = get_my_unidade())
  );

create policy "ordens_servico: consultor edita as próprias na sua unidade, gerência edita tudo"
  on ordens_servico for update
  to authenticated
  using (
    is_gerencia()
    or (consultor_id = auth.uid() and unidade_id = get_my_unidade())
  );

create policy "ordens_servico: apenas gerência exclui"
  on ordens_servico for delete
  to authenticated
  using (is_gerencia());

create policy "ordens_servico_pagamentos: segue a visibilidade da ordem"
  on ordens_servico_pagamentos for all
  to authenticated
  using (
    exists (
      select 1 from ordens_servico o
      where o.id = ordens_servico_pagamentos.ordem_id
        and (is_gerencia() or (o.consultor_id = auth.uid() and o.unidade_id = get_my_unidade()))
    )
  )
  with check (
    exists (
      select 1 from ordens_servico o
      where o.id = ordens_servico_pagamentos.ordem_id
        and (is_gerencia() or (o.consultor_id = auth.uid() and o.unidade_id = get_my_unidade()))
        and (o.status = 'pendente' or is_gerencia())
    )
  );
