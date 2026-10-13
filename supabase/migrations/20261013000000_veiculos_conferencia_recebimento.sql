-- Checklist de recebimento: transferir um veículo entre unidades já avisava
-- a gerência destino por Lembrete (20260904... / avisarTransferencia), mas
-- não travava nada — o carro entrava "disponível" na loja nova antes de
-- qualquer conferência física. Agora ele fica "aguardando_conferencia" até o
-- gerente da unidade destino (ou admin) aceitar.

-- Novo status: o carro fica aqui entre a transferência e o aceite.
alter type veiculo_status add value 'aguardando_conferencia';
