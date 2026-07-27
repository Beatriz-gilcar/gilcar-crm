-- Telefone da equipe, pré-requisito das notificações por WhatsApp.
--
-- Não existia em lugar nenhum: nem aqui, nem na aba Equipes do sistema antigo
-- (que tem e-mail, cargo, unidade, gerente e PIN). O antigo notificava por
-- e-mail (MailApp), por isso nunca precisou do número.
--
-- Guardado em E.164 sem símbolos — 5521999998888 — que é o formato que a
-- Cloud API exige. A normalização fica na aplicação; aqui só o check pra não
-- entrar lixo que faria a Meta recusar a mensagem em silêncio.
--
-- Fora do prevent_privilege_escalation de propósito: telefone é dado pessoal,
-- e cada um pode corrigir o próprio sem depender do admin. Diferente de cargo
-- e unidade, mudar o próprio número não dá poder nenhum a ninguém.

alter table profiles add column if not exists telefone text;

alter table profiles
  add constraint profiles_telefone_e164
    check (telefone is null or telefone ~ '^\d{12,13}$');
