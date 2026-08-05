-- Dia fixo de abastecimento por unidade (ex.: Mato Alto sempre quinta-feira).
-- O gerente da unidade recebe alerta dentro do sistema um dia antes e na
-- manhã do dia certo (ver /api/abastecimento-alerta).

create table abastecimento_config (
  unidade_id uuid primary key references unidades(id),
  -- 0 = domingo ... 6 = sábado, igual Date.getUTCDay() no JS.
  dia_semana smallint not null check (dia_semana between 0 and 6),
  updated_at timestamptz not null default now()
);

alter table abastecimento_config enable row level security;

create policy "abastecimento_config: leitura para qualquer autenticado"
  on abastecimento_config for select
  to authenticated
  using (true);

create policy "abastecimento_config: só admin insere"
  on abastecimento_config for insert
  to authenticated
  with check (is_admin());

create policy "abastecimento_config: só admin atualiza"
  on abastecimento_config for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "abastecimento_config: só admin exclui"
  on abastecimento_config for delete
  to authenticated
  using (is_admin());
