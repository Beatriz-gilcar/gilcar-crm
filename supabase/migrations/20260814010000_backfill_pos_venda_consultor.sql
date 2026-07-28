-- Backfill: pos_venda já existentes ganham consultor_id (e veiculo_km) da
-- ordem de origem, pra valerem a nova regra de visibilidade por dono.
update pos_venda p
set consultor_id = o.consultor_id,
    veiculo_km = coalesce(p.veiculo_km, o.veiculo_km)
from ordens_servico o
where p.ordem_id = o.id
  and p.consultor_id is null;
