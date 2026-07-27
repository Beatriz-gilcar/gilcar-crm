-- Rotina do Dia da Mato Alto (loja de motos), no mesmo molde da Cachamorra
-- (migration 20260730000000). "destaque" marca os pontos batidos — os
-- horários que não podem passar em branco.
insert into rotina_itens (unidade_id, ordem, hora, tarefa, destaque)
select u.id, x.ordem, x.hora, x.tarefa, x.destaque
from unidades u
cross join (values
  (0,  '08:00', 'Todos baterem ponto', true),
  (1,  '08:00', 'Retirar as grades', false),
  (2,  '08:00', 'Acender as luzes', false),
  (3,  '08:00', 'Limpar a frente da loja', false),
  (4,  '08:00', 'Puxar as motos', false),
  (5,  '08:00', 'Ligar TV, computadores, máquina de cartão', false),
  (6,  '08:15', 'Passar o café', false),
  (7,  '08:20', 'Arrumar a sala, varrer, passar pano, arrumar as mesas, cheirinho', false),
  (8,  '08:30', 'Tirar o lixo', false),
  (9,  '08:40', 'Oração', false),
  (10, '08:50', 'Tomar café / mini reunião', false),
  (11, '09:00', 'Limpar a bagunça do café, pia, balcão', false),
  (12, '09:00', 'Organizar o pátio', false),
  (13, '09:00', 'Postagens', false),
  (14, '09:30', 'Dar início aos Tratos e Combinados', false),
  (15, '10:00', 'Marketplace', false),
  (16, '12:00', 'Todos baterem o ponto', true),
  (17, '13:00', 'Todos baterem o ponto', true),
  (18, '14:00', 'Ligar as motos, conferir combustíveis, pneus', false),
  (19, '14:30', 'Ligações em conjunto', false),
  (20, '15:00', 'Monitorar o andamento de manutenção e documentação das motos vendidas', false),
  (21, '16:00', 'Blitz nos Tratos e Combinados', false),
  (22, '17:20', 'Fechar as planilhas', false),
  (23, '17:40', 'Guardar as motos', false),
  (24, '17:55', 'Colocar as grades', false),
  (25, '18:00', 'Desligar TV, computadores, máquina de cartão, apagar as luzes', false),
  (26, '18:00', 'Todos baterem o ponto', true)
) as x(ordem, hora, tarefa, destaque)
where u.nome = 'Mato Alto';
