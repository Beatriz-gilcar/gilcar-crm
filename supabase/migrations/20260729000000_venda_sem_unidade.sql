-- Venda pode não ter loja.
--
-- Quem tem unidade "Todas" (Junior, Gilmar) vende sem estar preso a uma loja.
-- No sistema antigo essas vendas caem num balde chamado "Todas" (gs:1794),
-- que não é loja nenhuma — é por isso que a Corrida da Meta mostra
-- "GILMAR ROCHA — TODAS · 3". Aqui não existe esse balde: unidade_id aponta
-- pra `unidades`, e lá só tem loja de verdade.
--
-- Com o not null de pé, essas vendas simplesmente não entravam. Sem loja elas
-- contam no total da empresa e ficam de fora do progresso das lojas — que é
-- exatamente o que o antigo faz.
--
-- Pra venda nova isso não muda nada: o formulário já exige a unidade e, quando
-- quem lança é gerência, mostra o seletor de loja (metas/new/page.tsx:81) —
-- é ali que o Junior direciona a venda pra loja que precisa da meta.

alter table vendas alter column unidade_id drop not null;
