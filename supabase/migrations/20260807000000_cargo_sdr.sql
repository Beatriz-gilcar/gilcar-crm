-- Cargo SDR: equipe que recebe os leads e distribui aos consultores. Lança os
-- números por consultor/dia; a gerente de SDR (flag valida_sdr) valida; só o
-- admin (Junior) vê o consolidado. Enum num migration próprio — o Postgres não
-- deixa usar um valor de enum recém-criado na mesma transação que o adicionou,
-- e o migration seguinte (20260807010000) referencia 'sdr' dentro das policies.

alter type cargo_tipo add value if not exists 'sdr';
