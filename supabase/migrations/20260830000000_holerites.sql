-- Holerite eletrônico (v1 enxuta): admin sobe o PDF individual de cada
-- colaborador, o colaborador vê e confirma recebimento com reautenticação
-- de senha (step-up). Sem hash-chain nem comprovante em PDF ainda — isso
-- fica pra uma v2, depois de validar o fluxo básico em uso real.
--
-- Base legal (CLT art. 464 + MP 2.200-2/2001 art.10 §2º): a assinatura em
-- si não é exigida por lei quando o salário é pago por depósito, mas manter
-- um registro de ciência/aceite é boa prática defensiva — é isso que essas
-- tabelas guardam.

create table holerites (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references profiles(id),
  mes_referencia date not null,
  arquivo_path text not null,
  enviado_por uuid not null references profiles(id),
  status text not null default 'enviado' check (status in ('enviado', 'visualizado', 'assinado')),
  enviado_em timestamptz not null default now(),
  visualizado_em timestamptz,
  assinado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (colaborador_id, mes_referencia)
);

create index holerites_colaborador_id_idx on holerites (colaborador_id);
create index holerites_mes_referencia_idx on holerites (mes_referencia);

-- Log de eventos append-only: só INSERT, nunca UPDATE/DELETE (nem admin via
-- app) — é a evidência de que ninguém mexeu no histórico depois do fato.
create table holerite_eventos (
  id bigint generated always as identity primary key,
  holerite_id uuid not null references holerites(id) on delete cascade,
  tipo_evento text not null check (tipo_evento in ('enviado', 'visualizado', 'reautenticado', 'assinado')),
  ocorrido_em timestamptz not null default now(),
  ip_origem text,
  user_agent text,
  metodo_reautent text
);

create index holerite_eventos_holerite_id_idx on holerite_eventos (holerite_id);

alter table holerites enable row level security;
alter table holerite_eventos enable row level security;

create policy "holerites: colaborador ve o proprio, admin ve tudo"
  on holerites for select
  to authenticated
  using (colaborador_id = auth.uid() or is_admin());

create policy "holerites: so admin envia"
  on holerites for insert
  to authenticated
  with check (is_admin());

-- Update: admin corrige qualquer coisa; colaborador só marca visualizado
-- e assinado do PRÓPRIO holerite (trigger abaixo trava os outros campos).
create policy "holerites: admin ou o proprio colaborador atualiza"
  on holerites for update
  to authenticated
  using (is_admin() or colaborador_id = auth.uid())
  with check (is_admin() or colaborador_id = auth.uid());

create function prevent_holerite_tampering()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if is_admin() then
    return new;
  end if;

  if (
    new.colaborador_id is distinct from old.colaborador_id
    or new.mes_referencia is distinct from old.mes_referencia
    or new.arquivo_path is distinct from old.arquivo_path
    or new.enviado_por is distinct from old.enviado_por
    or new.enviado_em is distinct from old.enviado_em
  ) then
    raise exception 'Colaborador só pode marcar visualizado/assinado, não editar o holerite';
  end if;

  return new;
end;
$$;

create trigger holerites_prevent_tampering
  before update on holerites
  for each row execute function prevent_holerite_tampering();

create policy "holerite_eventos: colaborador ve os do proprio, admin ve tudo"
  on holerite_eventos for select
  to authenticated
  using (
    is_admin()
    or exists (select 1 from holerites h where h.id = holerite_eventos.holerite_id and h.colaborador_id = auth.uid())
  );

create policy "holerite_eventos: qualquer um com acesso ao holerite insere evento"
  on holerite_eventos for insert
  to authenticated
  with check (
    is_admin()
    or exists (select 1 from holerites h where h.id = holerite_eventos.holerite_id and h.colaborador_id = auth.uid())
  );

-- ── Storage: bucket privado, um PDF por colaborador/mês ────────────────────
-- Caminho: holerites/{colaborador_id}/{mes_referencia}.pdf

insert into storage.buckets (id, name, public)
values ('holerites', 'holerites', false)
on conflict (id) do nothing;

create policy "holerites storage: colaborador baixa o proprio, admin baixa tudo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'holerites'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy "holerites storage: so admin sobe arquivo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'holerites' and is_admin());

create policy "holerites storage: so admin substitui/apaga"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'holerites' and is_admin());

create policy "holerites storage: so admin apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'holerites' and is_admin());
