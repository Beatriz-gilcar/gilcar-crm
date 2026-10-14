-- Treinamento deixa de ser um checklist fixo (ETAPAS_TREINAMENTO) e passa a
-- ser um mini-LMS: módulos com conteúdo + quiz de múltipla escolha, tudo
-- editável pelo admin em /treinamento/admin. A tabela antiga
-- treinamento_progresso (presença de linha = etapa feita) não tem dado real
-- ainda (subiu minutos atrás) — dropamos e recriamos com o nome novo.
drop table if exists treinamento_progresso cascade;

-- ============ Conteúdo (módulos, perguntas, opções) ============

create table treinamento_modulos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text not null default '',
  posicao int not null default 0,
  ativo boolean not null default true,
  criado_por uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index treinamento_modulos_posicao_idx on treinamento_modulos (posicao);

alter table treinamento_modulos enable row level security;

create policy "treinamento_modulos: autenticados leem módulos ativos"
  on treinamento_modulos for select to authenticated using (ativo = true);

create policy "treinamento_modulos: gerência lê todos (inclusive inativos)"
  on treinamento_modulos for select to authenticated using (is_gerencia());

create policy "treinamento_modulos: visualizador lê todos"
  on treinamento_modulos for select to authenticated using (is_visualizador());

-- Conteúdo é só do admin — gerência aprova quiz, não escreve matéria.
create policy "treinamento_modulos: admin insere"
  on treinamento_modulos for insert to authenticated with check (is_admin());

create policy "treinamento_modulos: admin edita"
  on treinamento_modulos for update to authenticated using (is_admin()) with check (is_admin());

create policy "treinamento_modulos: admin exclui"
  on treinamento_modulos for delete to authenticated using (is_admin());

create table treinamento_perguntas (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references treinamento_modulos(id) on delete cascade,
  texto text not null,
  posicao int not null default 0
);

create index treinamento_perguntas_modulo_id_idx on treinamento_perguntas (modulo_id);

alter table treinamento_perguntas enable row level security;

-- Pergunta não carrega resposta — pode ficar aberta pra qualquer
-- autenticado, sem precisar de view (diferente de treinamento_opcoes).
create policy "treinamento_perguntas: autenticados leem"
  on treinamento_perguntas for select to authenticated using (true);

create policy "treinamento_perguntas: admin insere"
  on treinamento_perguntas for insert to authenticated with check (is_admin());

create policy "treinamento_perguntas: admin edita"
  on treinamento_perguntas for update to authenticated using (is_admin()) with check (is_admin());

create policy "treinamento_perguntas: admin exclui"
  on treinamento_perguntas for delete to authenticated using (is_admin());

create table treinamento_opcoes (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references treinamento_perguntas(id) on delete cascade,
  texto text not null,
  correta boolean not null default false,
  posicao int not null default 0
);

create index treinamento_opcoes_pergunta_id_idx on treinamento_opcoes (pergunta_id);

alter table treinamento_opcoes enable row level security;

-- SEM policy de select pra "authenticated" genérico. Esta tabela tem a
-- coluna `correta` — se o consultor tivesse select aqui, uma query direta
-- no REST (anon key + JWT do próprio localStorage, sem passar pelo
-- Next.js) devolveria `correta` igual, porque RLS é por linha, não por
-- coluna. Quem pode ver a resposta certa é só quem decide a aprovação.
create policy "treinamento_opcoes: gerência lê (inclusive a resposta certa)"
  on treinamento_opcoes for select to authenticated using (is_gerencia());

create policy "treinamento_opcoes: visualizador lê"
  on treinamento_opcoes for select to authenticated using (is_visualizador());

create policy "treinamento_opcoes: admin insere"
  on treinamento_opcoes for insert to authenticated with check (is_admin());

create policy "treinamento_opcoes: admin edita"
  on treinamento_opcoes for update to authenticated using (is_admin()) with check (is_admin());

create policy "treinamento_opcoes: admin exclui"
  on treinamento_opcoes for delete to authenticated using (is_admin());

-- View que o consultor usa pra TIRAR o quiz: mesmas linhas de
-- treinamento_opcoes, sem a coluna `correta`. Funciona porque a view é
-- dona de quem roda esta migration (postgres, via SQL Editor do
-- Supabase) — que também é dona de treinamento_opcoes e por isso ignora
-- a RLS dela ao montar a view. GRANT, não policy: view não tem CREATE
-- POLICY (RLS é só de tabela). NÃO marcar `security_invoker = true`
-- aqui — o default do Postgres 15+ já é false (avalia como a dona), que
-- é o que faz isso funcionar; invoker=true avaliaria como o consultor
-- chamando, que não tem select na tabela base, e a view voltaria vazia.
create view treinamento_opcoes_quiz as
  select id, pergunta_id, texto, posicao
  from treinamento_opcoes;

grant select on treinamento_opcoes_quiz to authenticated;

-- ============ Progresso (submissão → aprovação) ============

create table treinamento_progresso (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references profiles(id),
  modulo_id uuid not null references treinamento_modulos(id) on delete cascade,
  enviado_em timestamptz,
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  unique (consultor_id, modulo_id)
);

create index treinamento_progresso_modulo_id_idx on treinamento_progresso (modulo_id);

alter table treinamento_progresso enable row level security;

create policy "treinamento_progresso: dono vê a própria"
  on treinamento_progresso for select to authenticated using (consultor_id = auth.uid());

create policy "treinamento_progresso: gerência lê tudo"
  on treinamento_progresso for select to authenticated using (is_gerencia());

create policy "treinamento_progresso: visualizador lê tudo"
  on treinamento_progresso for select to authenticated using (is_visualizador());

-- Consultor cria a própria linha ao enviar o quiz pela 1ª vez. with check
-- trava aprovado_por/aprovado_em nulos — ele NUNCA se autoaprova com um
-- insert direto no REST.
create policy "treinamento_progresso: consultor envia módulo (insert)"
  on treinamento_progresso for insert to authenticated
  with check (
    consultor_id = auth.uid()
    and aprovado_por is null
    and aprovado_em is null
    and enviado_em is not null
  );

-- Reenvio (devolvido ou refazer): só numa linha ainda não aprovada (using
-- trava isso), e o resultado continua sem aprovação (with check trava
-- isso) — o consultor não "reenvia" pra se desaprovar nem pra se aprovar.
create policy "treinamento_progresso: consultor reenvia módulo (update)"
  on treinamento_progresso for update to authenticated
  using (consultor_id = auth.uid() and aprovado_em is null)
  with check (
    consultor_id = auth.uid()
    and aprovado_por is null
    and aprovado_em is null
    and enviado_em is not null
  );

-- Só gerência aprova ou devolve pra refazer. is_gerencia() não restringe
-- por unidade — isso é feito em código de aplicação
-- (src/app/treinamento/actions.ts), mesmo padrão do resto do projeto.
create policy "treinamento_progresso: gerência aprova/devolve"
  on treinamento_progresso for update to authenticated
  using (is_gerencia())
  with check (is_gerencia());

-- ============ Respostas (o que o consultor marcou em cada pergunta) ============

create table treinamento_respostas (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references profiles(id),
  modulo_id uuid not null references treinamento_modulos(id) on delete cascade,
  pergunta_id uuid not null references treinamento_perguntas(id) on delete cascade,
  opcao_id uuid not null references treinamento_opcoes(id) on delete cascade,
  respondido_em timestamptz not null default now(),
  unique (consultor_id, pergunta_id)
);

create index treinamento_respostas_consultor_modulo_idx on treinamento_respostas (consultor_id, modulo_id);

alter table treinamento_respostas enable row level security;

create policy "treinamento_respostas: dono vê as próprias"
  on treinamento_respostas for select to authenticated using (consultor_id = auth.uid());

create policy "treinamento_respostas: gerência lê tudo"
  on treinamento_respostas for select to authenticated using (is_gerencia());

create policy "treinamento_respostas: visualizador lê tudo"
  on treinamento_respostas for select to authenticated using (is_visualizador());

-- Reenvio é feito como delete+insert pela action (nunca update) — por
-- isso não existe policy de update aqui. Trava extra (not exists
-- aprovado_em): o consultor não troca respostas de um módulo já aprovado.
create policy "treinamento_respostas: consultor responde o próprio módulo (insert)"
  on treinamento_respostas for insert to authenticated
  with check (
    consultor_id = auth.uid()
    and not exists (
      select 1 from treinamento_progresso pg
      where pg.consultor_id = treinamento_respostas.consultor_id
        and pg.modulo_id = treinamento_respostas.modulo_id
        and pg.aprovado_em is not null
    )
  );

create policy "treinamento_respostas: consultor reenvia (delete) o próprio módulo"
  on treinamento_respostas for delete to authenticated
  using (
    consultor_id = auth.uid()
    and not exists (
      select 1 from treinamento_progresso pg
      where pg.consultor_id = treinamento_respostas.consultor_id
        and pg.modulo_id = treinamento_respostas.modulo_id
        and pg.aprovado_em is not null
    )
  );
