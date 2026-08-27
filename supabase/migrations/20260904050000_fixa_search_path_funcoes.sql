-- Hardening: 5 funções security definer (rodam com privilégio elevado,
-- ignorando a RLS de quem chama) ficaram sem search_path fixo desde que
-- foram criadas — o padrão do resto do projeto (get_my_cargo, is_admin,
-- is_gerencia etc.) sempre fixou. Sem isso, a resolução de nomes de
-- objeto dentro da função depende do search_path de quem chama, o que é
-- o item "function_search_path_mutable" do linter do Postgres/Supabase.
-- Nenhuma dessas cria objeto dinamicamente, então o risco prático aqui é
-- baixo, mas alinhar ao padrão do projeto não custa nada.
alter function is_sdr() set search_path = public;
alter function pode_validar_sdr() set search_path = public;
alter function pode_sdr() set search_path = public;
alter function pode_assinar_ordem_extra() set search_path = public;
alter function pode_gerenciar_holerites() set search_path = public;
