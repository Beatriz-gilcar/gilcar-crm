-- Rastreia se a venda (lançada pro sistema/Corrida da Meta) já foi de fato
-- subida no Autocerto. As duas contagens podem divergir (consultor lança no
-- sistema antes de repassar pro Autocerto), e a gerência precisa enxergar
-- rápido quem ainda tem venda pendente de subir.
alter table vendas add column enviado_autocerto boolean not null default false;
