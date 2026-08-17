-- Painel RH de Holerites (enviar arquivo, ver status de todo mundo) fica
-- restrito só à Beatriz — não a qualquer admin (ex.: Junior continua vendo
-- a própria aba "Holerites" normal, mas não o painel de gestão).
-- Mesmo padrão de assina_ordem_servico (flag por pessoa, não por cargo).

alter table profiles add column gerencia_holerites boolean not null default false;

update profiles
set gerencia_holerites = true
where id = (select id from auth.users where email = 'klemjr92@gmail.com');

create function pode_gerenciar_holerites()
  returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and gerencia_holerites = true
  );
$$;

-- Troca is_admin() por pode_gerenciar_holerites() nas policies/trigger
-- específicas de holerite — o resto do app continua sem mudança.

drop policy if exists "holerites: colaborador ve o proprio, admin ve tudo" on holerites;
create policy "holerites: colaborador ve o proprio, gerencia de holerites ve tudo"
  on holerites for select
  to authenticated
  using (colaborador_id = auth.uid() or pode_gerenciar_holerites());

drop policy if exists "holerites: so admin envia" on holerites;
create policy "holerites: so quem gerencia holerites envia"
  on holerites for insert
  to authenticated
  with check (pode_gerenciar_holerites());

drop policy if exists "holerites: admin ou o proprio colaborador atualiza" on holerites;
create policy "holerites: gerencia de holerites ou o proprio colaborador atualiza"
  on holerites for update
  to authenticated
  using (pode_gerenciar_holerites() or colaborador_id = auth.uid())
  with check (pode_gerenciar_holerites() or colaborador_id = auth.uid());

create or replace function prevent_holerite_tampering()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if pode_gerenciar_holerites() then
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

drop policy if exists "holerite_eventos: colaborador ve os do proprio, admin ve tudo" on holerite_eventos;
create policy "holerite_eventos: colaborador ve os do proprio, gerencia de holerites ve tudo"
  on holerite_eventos for select
  to authenticated
  using (
    pode_gerenciar_holerites()
    or exists (select 1 from holerites h where h.id = holerite_eventos.holerite_id and h.colaborador_id = auth.uid())
  );

drop policy if exists "holerite_eventos: qualquer um com acesso ao holerite insere evento" on holerite_eventos;
create policy "holerite_eventos: qualquer um com acesso ao holerite insere evento"
  on holerite_eventos for insert
  to authenticated
  with check (
    pode_gerenciar_holerites()
    or exists (select 1 from holerites h where h.id = holerite_eventos.holerite_id and h.colaborador_id = auth.uid())
  );

drop policy if exists "holerites storage: colaborador baixa o proprio, admin baixa tudo" on storage.objects;
create policy "holerites storage: colaborador baixa o proprio, gerencia de holerites baixa tudo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'holerites'
    and (pode_gerenciar_holerites() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists "holerites storage: so admin sobe arquivo" on storage.objects;
create policy "holerites storage: so quem gerencia holerites sobe arquivo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'holerites' and pode_gerenciar_holerites());

drop policy if exists "holerites storage: so admin substitui/apaga" on storage.objects;
create policy "holerites storage: so quem gerencia holerites substitui"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'holerites' and pode_gerenciar_holerites());

drop policy if exists "holerites storage: so admin apaga" on storage.objects;
create policy "holerites storage: so quem gerencia holerites apaga"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'holerites' and pode_gerenciar_holerites());
