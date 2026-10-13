-- Continuação de 20261013000000: separado em arquivo próprio porque um novo
-- valor de enum (ALTER TYPE ... ADD VALUE) não pode ser referenciado na
-- mesma transação em que foi criado no Postgres.

-- Uma linha por transferência pendente/resolvida. status_anterior guarda o
-- que a pessoa pediu pra mudar no mesmo submit (ex.: também marcar
-- "reservado" junto com a troca de unidade) — fica em espera até o aceite,
-- que restaura esse valor.
create table veiculos_transferencias (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references veiculos(id) on delete cascade,
  unidade_origem_id uuid not null references unidades(id),
  unidade_destino_id uuid not null references unidades(id),
  status_anterior veiculo_status not null,
  status text not null default 'pendente' check (status in ('pendente', 'aceita')),
  itens_checklist jsonb not null default '[]', -- [{item, conferido}], preenchido só no aceite
  observacao text,
  criado_por uuid not null references profiles(id),
  criado_em timestamptz not null default now(),
  aceito_por uuid references profiles(id),
  aceito_em timestamptz
);

create index veiculos_transferencias_veiculo_id_idx on veiculos_transferencias (veiculo_id);

alter table veiculos_transferencias enable row level security;

-- Só quem pode aceitar é quem já vê a transferência: gerência da unidade
-- destino, ou admin (reflete podeTransferirUnidade do /estoque/[id] hoje).
create policy "veiculos_transferencias: gerência da unidade destino e admin veem/mexem"
  on veiculos_transferencias for all
  to authenticated
  using (is_admin() or (is_gerencia() and unidade_destino_id = get_my_unidade()));

-- Trava o veículo pendente: ninguém edita enquanto aguardando_conferencia,
-- EXCETO a própria transição de saída do estado (o aceite muda o status pra
-- outra coisa) — mesmo padrão de prevent_os_status_tampering e do extinto
-- prevent_veiculo_gerencia_edicao, já usados neste projeto.
create function prevent_veiculo_pendente_edicao()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if old.status = 'aguardando_conferencia' and new.status = 'aguardando_conferencia' then
    raise exception 'Veículo aguardando conferência de recebimento — não pode ser editado antes do aceite';
  end if;
  return new;
end;
$$;

create trigger veiculos_trava_pendente
  before update on veiculos
  for each row execute function prevent_veiculo_pendente_edicao();

create function prevent_veiculo_pendente_exclusao()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if old.status = 'aguardando_conferencia' then
    raise exception 'Veículo aguardando conferência de recebimento — não pode ser excluído antes do aceite';
  end if;
  return old;
end;
$$;

create trigger veiculos_trava_pendente_delete
  before delete on veiculos
  for each row execute function prevent_veiculo_pendente_exclusao();
