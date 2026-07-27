-- Placa deixa de ser única.
--
-- A planilha antiga tem 3 placas repetidas, e ao olhar caso a caso elas não
-- são todas do mesmo tipo:
--
--   TTE8G65  duas linhas idênticas em todos os campos, gravadas com 1 segundo
--            de diferença — clique duplo. Essa some na importação.
--
--   RKS8F75  "FACTOR 150" em Mato Alto vs "FACTOR" em Santa Cruz, manutenções
--            diferentes.
--   HTQ8I21  Journey Automático/Cinza/Cachamorra vs Manual/Prata/Santa Cruz.
--            Um Journey não é automático e manual ao mesmo tempo.
--
-- Os dois últimos são veículos diferentes com placa digitada errada num deles
-- (confirmado com o Junior). Com o unique de pé, importar os dois é impossível
-- e o estoque perderia um carro de verdade — o que é pior do que conviver com
-- uma placa repetida até alguém corrigir na tela.
--
-- O índice continua, sem unique: a placa é campo de busca.

alter table veiculos drop constraint if exists veiculos_placa_key;

create index if not exists veiculos_placa_idx on veiculos (placa);
