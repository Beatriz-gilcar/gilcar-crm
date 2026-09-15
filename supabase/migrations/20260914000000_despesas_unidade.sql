-- Lançamento manual de despesa por unidade, pra comparar com a receita de
-- ordens_servico e ter uma noção de lucro por loja. Fica invisível pra
-- qualquer um além do Junior (gestor, pediu a tela) e da Beatriz (mantém o
-- sistema, precisa entrar pra testar/dar suporte) — não é "todo admin", é
-- essas duas pessoas especificamente (mesmo padrão de gerencia_holerites em
-- 20260831000000: flag por pessoa, não por cargo).

alter table profiles add column ve_despesas boolean not null default false;

update profiles
set ve_despesas = true
where id in (select id from auth.users where email in ('klemjr92@gmail.com', 'nsnhbrum@gmail.com'));

create function pode_ver_despesas()
  returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and ve_despesas = true
  );
$$;

create table despesas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid references unidades(id), -- null = despesa geral/empresa
  categoria text not null check (categoria in (
    'aluguel', 'folha', 'agua_luz', 'internet_telefone', 'manutencao', 'marketing', 'fornecedor', 'outros'
  )),
  descricao text,
  valor numeric(12, 2) not null check (valor >= 0),
  competencia date not null, -- sempre dia 1 do mês, como holerites.mes_referencia
  criado_por uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index despesas_competencia_idx on despesas (competencia);
create index despesas_unidade_id_idx on despesas (unidade_id);

alter table despesas enable row level security;

create policy "despesas: só quem vê despesas enxerga"
  on despesas for select
  to authenticated
  using (pode_ver_despesas());

create policy "despesas: só quem vê despesas lança"
  on despesas for insert
  to authenticated
  with check (pode_ver_despesas());

create policy "despesas: só quem vê despesas edita"
  on despesas for update
  to authenticated
  using (pode_ver_despesas())
  with check (pode_ver_despesas());

create policy "despesas: só quem vê despesas exclui"
  on despesas for delete
  to authenticated
  using (pode_ver_despesas());
