-- Libera a flag de assinatura extra de Ordem de Serviço pro José Santos.
update profiles
set assina_ordem_servico = true
where id = (select id from auth.users where email = 'josesantos.gilcar@gmail.com');
