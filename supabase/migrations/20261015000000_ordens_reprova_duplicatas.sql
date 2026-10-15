-- Quando uma OS é aprovada, reprova automaticamente as outras OS pendentes
-- da mesma venda (mesma placa + cliente — mesmo critério de
-- dedupOrdensPorPlacaCliente em src/lib/ordens.ts, usado em /despesas e
-- /pagamentos pra não contar a mesma venda duas vezes). Isso ataca a causa
-- dos duplicados na raiz, em vez de só filtrar nos relatórios: duplo clique
-- no form, ou reenvio da ordem sem reprovar a anterior, não deixa mais
-- pendente solta na lista.
--
-- Reprova (não apaga) — fica com motivo_reprovacao explicando, pra manter
-- rastro. Sem placa não casa com nada (null = sem match em SQL), igual o
-- critério de JS: "sem placa não dá pra agrupar com segurança".

create function reprovar_duplicatas_os()
  returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if new.status = 'aprovada' and old.status is distinct from 'aprovada' then
    update ordens_servico
    set status = 'reprovada',
        aprovado_por = new.aprovado_por,
        aprovado_em = new.aprovado_em,
        motivo_reprovacao = 'Duplicata — outra ordem desta venda (mesma placa e cliente) foi aprovada automaticamente'
    where id <> new.id
      and tipo = new.tipo
      and status = 'pendente'
      and new.veiculo_placa is not null
      and trim(new.veiculo_placa) <> ''
      and upper(trim(veiculo_placa)) = upper(trim(new.veiculo_placa))
      and lower(trim(cliente_nome)) = lower(trim(new.cliente_nome));
  end if;
  return new;
end;
$$;

create trigger ordens_servico_reprovar_duplicatas
  after update on ordens_servico
  for each row execute function reprovar_duplicatas_os();
