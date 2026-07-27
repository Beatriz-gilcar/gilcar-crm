-- Módulo Rotina do Dia: o lembrete do que cada loja faz ao longo do dia.
--
-- Existia no sistema antigo (aba "Rotina do Dia") e não tinha equivalente aqui.
-- Lá a lista das 24 tarefas é constante no código (Html:1943) e a unidade está
-- escrita na chamada — `getRotinaDia(data, 'Cachamorra')` (Html:1974) — por
-- isso só a Cachamorra tem rotina.
--
-- Aqui a lista vira tabela, uma por loja: a Cachamorra entra com as 24 dela e
-- as outras montam a sua em /rotina/editar.

create table rotina_itens (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidades(id) on delete cascade,
  ordem integer not null,
  -- text, não time: o antigo tem "8 às 18" numa das tarefas ("Vendedor em pé
  -- na vez"), que não é horário nenhum.
  hora text not null,
  tarefa text not null,
  -- O `forte:true` do antigo, que pinta a linha de vermelho: ponto, almoço,
  -- fechamento. É o que não pode passar batido.
  destaque boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rotina_itens_unidade_id_idx on rotina_itens (unidade_id);

-- A marcação aponta pro ITEM, não pro índice dele na lista.
--
-- O antigo grava ItemIdx — a posição no array. Quem inserir uma tarefa no meio
-- da lista faz todo o histórico anterior apontar pra tarefa errada, sem erro
-- nenhum aparecer. Com FK isso não acontece, e ainda ganhamos o cascade quando
-- um item é removido de vez.
create table rotina_marcacoes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references rotina_itens(id) on delete cascade,
  data date not null default current_date,
  marcado_por uuid not null references profiles(id),
  marcado_em timestamptz not null default now(),
  unique (item_id, data)
);

create index rotina_marcacoes_data_idx on rotina_marcacoes (data);

alter table rotina_itens enable row level security;
alter table rotina_marcacoes enable row level security;

-- A rotina da loja não é segredo: qualquer um lê. Só admin monta a lista.
create policy "rotina_itens: leitura para autenticados"
  on rotina_itens for select
  to authenticated
  using (true);

create policy "rotina_itens: apenas admin gerencia"
  on rotina_itens for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "rotina_marcacoes: leitura para autenticados"
  on rotina_marcacoes for select
  to authenticated
  using (true);

-- Marca quem é da loja (qualquer cargo, como no antigo) e a gerência.
-- marcado_por = auth.uid() impede marcar no nome de outro.
create policy "rotina_marcacoes: a loja marca a própria rotina"
  on rotina_marcacoes for insert
  to authenticated
  with check (
    marcado_por = auth.uid()
    and exists (
      select 1 from rotina_itens i
      where i.id = rotina_marcacoes.item_id
        and (is_gerencia() or i.unidade_id = get_my_unidade())
    )
  );

create policy "rotina_marcacoes: a loja desmarca a própria rotina"
  on rotina_marcacoes for delete
  to authenticated
  using (
    exists (
      select 1 from rotina_itens i
      where i.id = rotina_marcacoes.item_id
        and (is_gerencia() or i.unidade_id = get_my_unidade())
    )
  );

-- Visualizador (CEO): lê tudo, não escreve nada. Mesmo desenho das outras
-- tabelas (migration 20260723020000).
do $$
declare
  t text;
begin
  foreach t in array array['rotina_itens', 'rotina_marcacoes'] loop
    execute format(
      'create policy "%s: visualizador lê tudo" on %I for select to authenticated using (is_visualizador())', t, t);
    execute format(
      'create policy "%s: visualizador não insere" on %I as restrictive for insert to authenticated with check (not is_visualizador())', t, t);
    execute format(
      'create policy "%s: visualizador não edita" on %I as restrictive for update to authenticated using (not is_visualizador()) with check (not is_visualizador())', t, t);
    execute format(
      'create policy "%s: visualizador não exclui" on %I as restrictive for delete to authenticated using (not is_visualizador())', t, t);
  end loop;
end $$;

-- ── Rotina da Cachamorra ────────────────────────────────────────────────
-- As 24 tarefas do ROTINA_ITENS (Html:1943), na mesma ordem — a ordem importa
-- porque a migração das 29 marcações antigas casa por ela com o ItemIdx.
insert into rotina_itens (unidade_id, ordem, hora, tarefa, destaque)
select u.id, x.ordem, x.hora, x.tarefa, x.destaque
from unidades u
cross join (values
  (0,  '08:00',   'Todos baterem o ponto', true),
  (1,  '08:00',   'Ligar o ar condicionado', false),
  (2,  '08:00',   'Ligar os computadores e televisão', false),
  (3,  '08:00',   'Varrer e passar pano e arrumar as mesas', false),
  (4,  '08:00',   'Ligar a máquina de cartão', false),
  (5,  '08:05',   'Puxar os carros e arrumar a frente de loja', false),
  (6,  '09:00',   'Oração*', false),
  (7,  '09:05',   'Reunião de alinhamento', false),
  (8,  '09:40',   'Subir anúncios Marketplace/OLX', false),
  (9,  '8 às 18', 'Vendedor em pé na vez (o segundo atento)', false),
  (10, '10:00',   'Conferir alinhamento de estoque', false),
  (11, '11:00',   'Atualizar status (Instagram, Face, WhatsApp)', false),
  (12, '11:30',   'Conferir as vendas do dia anterior: contratos e O.S.', false),
  (13, '12:00',   'Bater ponto e almoçar', true),
  (14, '13:00',   'Retorno do almoço e saída da segunda equipe', true),
  (15, '14:00',   'Retorno do almoço da segunda equipe', true),
  (16, '14:00',   'Monitorar o andamento de manutenção e doc. dos carros vendidos', false),
  (17, '14:30',   'Blitz nas metas Tratos e Combinados', false),
  (18, '15:00',   'Mesa de ligação', false),
  (19, '16:00',   'Conferir e revisar detalhes dos carros', false),
  (20, '17:50',   'Fechar a planilha', false),
  (21, '18:00',   'Puxar os carros e puxar as grades', false),
  (22, '18:00',   'Desligar os computadores, ar condicionado, lâmpadas', false),
  (23, '18:00',   'Bater o ponto', true)
) as x(ordem, hora, tarefa, destaque)
where u.nome = 'Cachamorra';
