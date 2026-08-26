-- Novo cargo Social Media (Pedro Fábio): só precisa ver o Estoque pra apoiar
-- o conteúdo/divulgação dos veículos. Enum em migration própria — Postgres
-- não deixa usar um valor de enum recém-criado na mesma transação que o
-- adicionou, e o próximo migration (20260903020000) referencia
-- 'social_media' dentro das policies.
alter type cargo_tipo add value if not exists 'social_media';
