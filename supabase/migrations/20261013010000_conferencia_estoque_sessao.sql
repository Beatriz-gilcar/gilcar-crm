-- Conferência física de estoque (contagem de pátio). A tabela de itens
-- (estoque_contagem_itens) já existia em produção, criada direto no banco
-- fora do processo normal, junto com a função pode_financeiro() e a coluna
-- profiles.acesso_financeiro (flag por pessoa — hoje só o Emerson Batista,
-- gerente do financeiro, que já faz essa conferência pelo Autocerto). Esta
-- migration formaliza o que já existe (mesmo nome, mesmo comportamento, sem
-- quebrar o acesso dele) e acrescenta a tabela de sessão que faltava —
-- contagem_id era só um uuid solto, sem tabela "mãe".

alter table profiles add column if not exists acesso_financeiro boolean not null default false;

create or replace function pode_financeiro()
  returns boolean language sql stable security definer as $$
  select coalesce(
    (select cargo = 'admin' or acesso_financeiro = true from profiles where id = auth.uid()),
    false
  )
$$;

-- Sessão de contagem: uma por unidade/data. Enquanto fechada_em for null,
-- está "em andamento".
create table estoque_contagens (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidades(id),
  aberta_por uuid not null references profiles(id),
  aberta_em timestamptz not null default now(),
  fechada_por uuid references profiles(id),
  fechada_em timestamptz
);

create index estoque_contagens_unidade_id_idx on estoque_contagens (unidade_id);

alter table estoque_contagens enable row level security;

create policy "estoque_contagens: financeiro/admin veem/mexem"
  on estoque_contagens for all
  to authenticated
  using (pode_financeiro());

-- Amarra a tabela de itens (já existente) na sessão.
alter table estoque_contagem_itens
  add constraint estoque_contagem_itens_contagem_id_fkey
  foreign key (contagem_id) references estoque_contagens(id) on delete cascade;

-- Reafirma a policy já existente (mesmo texto/condição de hoje), só pra
-- ficar registrada em migration.
drop policy if exists "estoque_contagem_itens: financeiro/admin" on estoque_contagem_itens;
create policy "estoque_contagem_itens: financeiro/admin"
  on estoque_contagem_itens for all
  to authenticated
  using (pode_financeiro());
