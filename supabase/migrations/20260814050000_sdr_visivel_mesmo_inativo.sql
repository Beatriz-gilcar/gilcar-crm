-- A lista de consultor do lançamento de SDR precisava mostrar o Lucas mesmo
-- desativado (compromissos já marcados antes de sair). Só tirar o filtro de
-- "ativo" trouxe de volta TODO mundo inativo, inclusive cadastros antigos
-- (Luis Scari, Taynara) que já têm um cadastro novo ativo — duplicata visual.
-- Flag específica resolve sem mexer no resto: só quem for marcado aqui
-- aparece mesmo inativo.
alter table profiles add column if not exists visivel_sdr_mesmo_inativo boolean not null default false;
