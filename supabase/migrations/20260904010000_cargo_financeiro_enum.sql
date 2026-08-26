-- Novo cargo Financeiro: só cuida dos boletos das vendas (vencimento e status
-- de pagamento). Enum em migration própria — Postgres não deixa usar um valor
-- de enum recém-criado na mesma transação que o adicionou, e o próximo
-- migration (20260904020000) referencia 'financeiro' dentro das policies.
alter type cargo_tipo add value if not exists 'financeiro';
