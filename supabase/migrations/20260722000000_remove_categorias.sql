-- Remove o módulo Categorias: não existia no sistema antigo e não é mais
-- usado. A tabela estava vazia e o único vínculo era lembretes.categoria_id
-- (nullable, sem nenhuma linha preenchida).
--
-- Leads/clientes NÃO é removido aqui: atendimentos.cliente_id é not null e
-- sustenta o Status do Dia e o Dashboard. A aba e as rotas /leads saíram da
-- navegação, mas o schema continua de pé.

drop policy if exists "categorias: leitura para autenticados" on categorias;

drop policy if exists "categorias: apenas gerência gerencia" on categorias;

drop index if exists lembretes_categoria_id_idx;

alter table lembretes drop column if exists categoria_id;

drop table if exists categorias;