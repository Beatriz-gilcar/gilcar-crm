-- Controle de vencimento/pagamento por boleto. Fica nas próprias linhas de
-- ordens_servico_pagamentos (não numa tabela nova) porque o boleto já é uma
-- linha ali (forma = 'boleto') — só precisa de mais dois dados quando for
-- esse o caso. Outras formas de pagamento deixam essas colunas em branco.
alter table ordens_servico_pagamentos add column if not exists vencimento date;
alter table ordens_servico_pagamentos add column if not exists pago boolean not null default false;
alter table ordens_servico_pagamentos add column if not exists pago_em date;
