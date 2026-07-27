-- Cargos Supervisor e Visualizador, que existiam no sistema antigo e ficaram de
-- fora da migração.
--
-- Isolado num migration só seu de propósito: o Postgres não permite usar um
-- valor de enum recém-criado dentro da mesma transação que o adicionou, e as
-- migrations seguintes referenciam os dois valores em corpos de função.

alter type cargo_tipo add value if not exists 'supervisor';

alter type cargo_tipo add value if not exists 'visualizador';
