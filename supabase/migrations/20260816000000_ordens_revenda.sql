-- Marca se uma venda é "revenda" (comissão fixa, diferente da regra padrão
-- por valor) — quem lança a ordem escolhe isso na hora, ninguém deduz sozinho.
alter table ordens_servico add column if not exists revenda boolean not null default false;
