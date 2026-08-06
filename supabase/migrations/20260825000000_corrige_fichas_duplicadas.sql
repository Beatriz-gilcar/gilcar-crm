-- Correção pontual: 6 fichas diárias já aprovadas ficaram com contagem
-- inflada pelos atendimentos duplicados removidos manualmente em 2026-08-06
-- (ver conversa). Desliga a trava de "dia já aprovado" só pra essa correção.

alter table fichas_diarias disable trigger fichas_diarias_check_dia_aprovado;

update fichas_diarias set presenciais = 1, digitais = 0, fechamentos = 1, agendamentos = 0, updated_at = now()
  where id = '5110cd02-164f-42b1-b71c-63502afd3e2d'; -- Fernando Costa, 2026-07-18

update fichas_diarias set presenciais = 0, digitais = 10, fechamentos = 0, agendamentos = 0, updated_at = now()
  where id = '5d461418-b3c2-472a-8b58-e9059d161efa'; -- Pedro Alexandre, 2026-07-24

update fichas_diarias set presenciais = 0, digitais = 1, fechamentos = 0, agendamentos = 0, updated_at = now()
  where id = '18c5ef2f-dbb6-45fc-a082-450157d83c42'; -- Luiz Fernando, 2026-07-28

update fichas_diarias set presenciais = 1, digitais = 2, fechamentos = 0, agendamentos = 0, updated_at = now()
  where id = '56b8e42a-a86f-477f-9c0c-1d9ab2cf3aa0'; -- Luis Scari, 2026-07-29

update fichas_diarias set presenciais = 1, digitais = 0, fechamentos = 0, agendamentos = 0, updated_at = now()
  where id = 'f09cab75-b985-4a2b-9d63-90e3307fdc91'; -- Luiz Fernando, 2026-07-29

update fichas_diarias set presenciais = 3, digitais = 6, fechamentos = 1, agendamentos = 0, updated_at = now()
  where id = 'eefec226-db56-4c9f-aae3-5327d25878e2'; -- Luis Scari, 2026-08-04

alter table fichas_diarias enable trigger fichas_diarias_check_dia_aprovado;
