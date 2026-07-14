-- Atendimentos deixam de ter um "tipo" genérico (que misturava
-- presencial/digital/compra/venda) e passam a ter dois formulários
-- de verdade, cada um com seus próprios campos, igual ao sistema
-- antigo (levantamento 8.4).
--
-- Só existiam registros de teste até aqui (pré-lançamento), então
-- limpamos a tabela em vez de escrever uma migração de dados.
delete from atendimentos;

alter table atendimentos drop column tipo;
drop type atendimento_tipo;
create type atendimento_tipo as enum ('presencial', 'digital');

alter table atendimentos
  add column tipo atendimento_tipo not null,
  add column cliente_nome text,
  add column celular text,
  add column veiculo_interesse text,
  add column cv text,
  add column fechou_negocio boolean,
  add column agendou_visita boolean,
  add column origem text;

alter table atendimentos rename column descricao to observacao;

alter table atendimentos
  add constraint atendimentos_cv_check
    check (cv is null or (tipo = 'presencial' and cv in ('compra', 'venda'))),
  add constraint atendimentos_origem_check
    check (
      origem is null
      or (tipo = 'presencial' and origem in ('porta', 'ag_sdr', 'ag_proprio', 'indicacao', 'retorno'))
      or (tipo = 'digital' and origem in ('whatsapp', 'instagram', 'marketplace', 'olx', 'site', 'outro'))
    );
