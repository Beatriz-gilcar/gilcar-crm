-- Campos do documento de Ordem de Serviço (réplica fiel do formulário antigo).
-- Faltavam no sistema; entram como colunas nulas na ordens_servico:
--   origem_cliente  -> "ORIGEM DO CLIENTE" (Carteira, Marketplace, ...)
--   numero_venda    -> "Nº VENDA" (numeração do documento, texto livre)
--   retorno         -> "RETORNO"
--   cliente_cep     -> "CEP" (antes o CEP era só usado pra buscar endereço)
--   cliente_numero  -> "NÚMERO" do endereço
--   veiculo_km      -> "KM" do veículo (texto, ex.: "41.285")
--   manutencao      -> seção "MANUTENÇÃO — PÓS-VENDA"
-- "Alienado a" reaproveita a coluna `financeira`; "Valor do veículo" reaproveita
-- `valor_total` — não precisam de coluna nova.

alter table ordens_servico
  add column if not exists origem_cliente text,
  add column if not exists numero_venda text,
  add column if not exists retorno text,
  add column if not exists cliente_cep text,
  add column if not exists cliente_numero text,
  add column if not exists veiculo_km text,
  add column if not exists manutencao text;
