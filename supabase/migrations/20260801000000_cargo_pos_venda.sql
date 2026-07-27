-- Cargo Pós-venda (Luciana): edita o módulo de Pós-venda e lê o Estoque; não
-- escreve em mais nada. Fica isolado num migration próprio de propósito — o
-- Postgres não deixa usar um valor de enum recém-criado na mesma transação que
-- o adicionou, e o migration seguinte (20260801010000_pos_venda) referencia
-- 'pos_venda' dentro de policies.

alter type cargo_tipo add value if not exists 'pos_venda';
