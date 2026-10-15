-- Limpeza única das duplicatas que já existiam antes do trigger
-- ordens_servico_reprovar_duplicatas (migration anterior) existir — ele só
-- age em aprovações daqui pra frente, não retroativo. Mesmo critério do
-- trigger (placa + cliente). Desliga a trava de "ordem já avaliada não pode
-- mudar" só pra essa correção, mesmo padrão de
-- 20260825000000_corrige_fichas_duplicadas.sql.

alter table ordens_servico disable trigger ordens_servico_prevent_tampering;

update ordens_servico as dup
set status = 'reprovada',
    aprovado_por = ap.aprovado_por,
    aprovado_em = ap.aprovado_em,
    motivo_reprovacao = 'Duplicata — outra ordem desta venda (mesma placa e cliente) já estava aprovada'
from ordens_servico as ap
where dup.status = 'pendente'
  and ap.status = 'aprovada'
  and dup.id <> ap.id
  and dup.tipo = ap.tipo
  and dup.veiculo_placa is not null
  and trim(dup.veiculo_placa) <> ''
  and upper(trim(dup.veiculo_placa)) = upper(trim(ap.veiculo_placa))
  and lower(trim(dup.cliente_nome)) = lower(trim(ap.cliente_nome));

alter table ordens_servico enable trigger ordens_servico_prevent_tampering;
