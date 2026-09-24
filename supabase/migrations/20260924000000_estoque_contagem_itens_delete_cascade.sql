-- Formaliza estoque_contagem_itens (checklist de conferência física de
-- estoque: agrupa por contagem_id, marca cada veiculo_id como conferido ou
-- não) no controle de versão. Ela já existe em produção — foi criada direto
-- no SQL Editor, sem passar por migration nem ter tela no CRM ainda — e tem
-- só 2 linhas hoje, baixo risco de mexer.
--
-- Corrige "Não foi possível remover o veículo" no Estoque: a FK de
-- veiculo_id não tinha regra de o que fazer quando o carro é apagado
-- (padrão do Postgres é travar a exclusão). Sem o carro no estoque não tem
-- o que conferir dele, então cascade é o certo — mesmo raciocínio já usado
-- em ordens_servico.veiculo_id (20260820000000), só que lá foi set null
-- porque a ordem continua fazendo sentido sem o veículo; aqui a linha de
-- contagem não faz sentido nenhum sem o veículo, por isso cascade.

alter table estoque_contagem_itens drop constraint if exists estoque_contagem_itens_veiculo_id_fkey;
alter table estoque_contagem_itens add constraint estoque_contagem_itens_veiculo_id_fkey
  foreign key (veiculo_id) references veiculos(id) on delete cascade;
