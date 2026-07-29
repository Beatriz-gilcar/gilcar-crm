-- Permite liberar a assinatura de Ordem de Serviço pra alguém que não é
-- gerente/supervisor/admin (ex.: José), sem dar a ele o resto do acesso de
-- gerência (metas, pós-venda, ver tudo etc.). Mesmo padrão do valida_sdr:
-- uma flag no profile, separada do cargo.
alter table profiles add column if not exists assina_ordem_servico boolean not null default false;

create or replace function pode_assinar_ordem_extra() returns boolean language sql stable security definer as $$
  select coalesce((select assina_ordem_servico from profiles where id = auth.uid()), false)
$$;

-- Visibilidade: além do próprio consultor e da gerência, quem tem a flag
-- também enxerga as ordens da própria unidade (senão não teria como achar
-- a ordem aprovada pra assinar).
drop policy if exists "ordens_servico: consultor vê as próprias na sua unidade, gerência vê tudo" on ordens_servico;
create policy "ordens_servico: consultor vê as próprias na sua unidade, gerência vê tudo"
  on ordens_servico for select
  to authenticated
  using (
    is_gerencia()
    or (consultor_id = auth.uid() and unidade_id = get_my_unidade())
    or (pode_assinar_ordem_extra() and unidade_id = get_my_unidade())
  );

drop policy if exists "ordens_servico: consultor edita as próprias na sua unidade, gerência edita tudo" on ordens_servico;
create policy "ordens_servico: consultor edita as próprias na sua unidade, gerência edita tudo"
  on ordens_servico for update
  to authenticated
  using (
    is_gerencia()
    or (consultor_id = auth.uid() and unidade_id = get_my_unidade())
    or (pode_assinar_ordem_extra() and unidade_id = get_my_unidade())
  );

-- Trigger de trava: adiciona quem tem a flag (na própria unidade) como
-- autor de assinatura válido, igual ao gerente responsável, e libera esse
-- autor também da trava geral de "ordem avaliada só edita gerência" —
-- mas só pra esse tipo de alteração (assinatura), igual já valia pro gerente.
create or replace function prevent_os_status_tampering()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
declare
  autor_assinatura boolean;
begin
  if (
    new.status is distinct from old.status
    or new.aprovado_por is distinct from old.aprovado_por
    or new.aprovado_em is distinct from old.aprovado_em
    or new.motivo_reprovacao is distinct from old.motivo_reprovacao
  ) and not is_gerencia() then
    raise exception 'Apenas gerência pode aprovar ou reprovar uma ordem de serviço';
  end if;

  autor_assinatura := is_admin()
    or (get_my_cargo() = 'gerente' and old.unidade_id = get_my_unidade())
    or (pode_assinar_ordem_extra() and old.unidade_id = get_my_unidade());

  if (
    new.assinatura_gerencia_data_url is distinct from old.assinatura_gerencia_data_url
    or new.assinatura_gerencia_nome is distinct from old.assinatura_gerencia_nome
    or new.assinado_em is distinct from old.assinado_em
  ) then
    if old.status <> 'aprovada' then
      raise exception 'Só é possível assinar uma ordem aprovada';
    end if;
    if not autor_assinatura then
      raise exception 'Apenas a gerência responsável pela unidade pode assinar';
    end if;
  end if;

  if old.status <> 'pendente' and not (is_gerencia() or autor_assinatura) then
    raise exception 'Ordem já avaliada não pode mais ser editada';
  end if;

  return new;
end;
$$;
