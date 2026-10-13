-- Conferência física de estoque (contagem de pátio). A tabela de itens
-- (estoque_contagem_itens) E a tabela de sessão (estoque_contagens) já
-- existiam em produção, criadas direto no banco fora do processo normal,
-- junto com a função pode_financeiro() e a coluna profiles.acesso_financeiro
-- (flag por pessoa — hoje só o Emerson Batista, gerente do financeiro, que
-- já faz essa conferência pelo Autocerto).
--
-- Versão anterior desta migration assumia que estoque_contagens não
-- existia e tentava criá-la com colunas diferentes (aberta_em, fechada_por,
-- fechada_em) — o "create table" colidiu com a tabela real (que tem data,
-- criado_por, concluida) e abortou a migration inteira (nada chegou a
-- aplicar). Esta versão só formaliza o que já existe de verdade, com os
-- nomes reais, sem recriar nada.

alter table profiles add column if not exists acesso_financeiro boolean not null default false;

create or replace function pode_financeiro()
  returns boolean language sql stable security definer as $$
  select coalesce(
    (select cargo = 'admin' or acesso_financeiro = true from profiles where id = auth.uid()),
    false
  )
$$;

-- Sessão de contagem: uma por unidade/data. Enquanto concluida for false,
-- está "em andamento".
create table if not exists estoque_contagens (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidades(id),
  data date not null default current_date,
  criado_por uuid references profiles(id),
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists estoque_contagens_unidade_id_idx on estoque_contagens (unidade_id);

alter table estoque_contagens enable row level security;

drop policy if exists "estoque_contagens: financeiro/admin" on estoque_contagens;
create policy "estoque_contagens: financeiro/admin"
  on estoque_contagens for all
  to authenticated
  using (pode_financeiro());

-- Amarra a tabela de itens (já existente) na sessão — já existia em
-- produção, só adiciona se faltar (ex.: ambiente novo).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'estoque_contagem_itens_contagem_id_fkey'
      and conrelid = 'estoque_contagem_itens'::regclass
  ) then
    alter table estoque_contagem_itens
      add constraint estoque_contagem_itens_contagem_id_fkey
      foreign key (contagem_id) references estoque_contagens(id) on delete cascade;
  end if;
end $$;

-- Reafirma a policy já existente (mesmo texto/condição de hoje), só pra
-- ficar registrada em migration.
drop policy if exists "estoque_contagem_itens: financeiro/admin" on estoque_contagem_itens;
create policy "estoque_contagem_itens: financeiro/admin"
  on estoque_contagem_itens for all
  to authenticated
  using (pode_financeiro());
