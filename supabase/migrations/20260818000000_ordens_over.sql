-- "Over": quanto o consultor vendeu acima do preço estipulado. Digitado na
-- ordem (venda), metade vira comissão extra pro consultor na aprovação.
alter table ordens_servico add column if not exists over numeric(12, 2) not null default 0;
