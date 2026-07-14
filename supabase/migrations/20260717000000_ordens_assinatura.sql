-- Assinatura digital da gerência na Ordem de Serviço (pós-aprovação).

alter table ordens_servico
  add column assinatura_gerencia_data_url text,
  add column assinatura_gerencia_nome text,
  add column assinado_em timestamptz;

-- Substitui a função de trigger: além das regras já existentes (só
-- gerência aprova/reprova, ordem avaliada só editável por gerência),
-- adiciona a regra de assinatura: só em ordem já aprovada, e só pelo
-- admin ou pelo gerente responsável pela unidade daquela ordem.
create or replace function prevent_os_status_tampering()
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

  if (
    new.assinatura_gerencia_data_url is distinct from old.assinatura_gerencia_data_url
    or new.assinatura_gerencia_nome is distinct from old.assinatura_gerencia_nome
    or new.assinado_em is distinct from old.assinado_em
  ) then
    if old.status <> 'aprovada' then
      raise exception 'Só é possível assinar uma ordem aprovada';
    end if;
    if not (is_admin() or (get_my_cargo() = 'gerente' and old.unidade_id = get_my_unidade())) then
      raise exception 'Apenas a gerência responsável pela unidade pode assinar';
    end if;
  end if;

  if old.status <> 'pendente' and not is_gerencia() then
    raise exception 'Ordem já avaliada não pode mais ser editada';
  end if;

  return new;
end;
$$;
