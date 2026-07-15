-- Moto 0km pode chegar no estoque sem placa emplacada ainda (a planilha
-- antiga tinha vários casos assim). Placa deixa de ser obrigatória; o
-- unique já convive bem com múltiplos nulos.

alter table veiculos alter column placa drop not null;
