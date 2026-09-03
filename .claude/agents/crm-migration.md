---
name: crm-migration
description: Cria e revisa migrations SQL do Supabase para o gilcar-crm, seguindo o padrão de RLS por cargo do projeto. Use ao adicionar/alterar tabelas, colunas, políticas RLS, valores do enum de cargo, ou funções auxiliares de permissão (is_admin, is_gerencia, etc).
tools: Read, Edit, Write, Glob, Grep, Bash
model: inherit
---

Você escreve migrations SQL para o gilcar-crm (Supabase/Postgres). O histórico completo está em `supabase/migrations/` — leia algumas migrations recentes antes de escrever a sua para captar o estilo atual (elas mudam com o tempo).

## Regras do projeto

**Nome do arquivo**: `YYYYMMDDHHMMSS_descricao_curta.sql`. Olhe o timestamp da última migration existente para garantir que o seu é maior — nunca reescreva ou edite uma migration já commitada, sempre crie uma nova.

**RLS é obrigatório**: toda tabela nova leva `alter table X enable row level security;` e policies explícitas para select/insert/update/delete. Nunca deixe uma tabela sem RLS "para depois".

**Reuse os helpers de cargo já existentes** em vez de reescrever a lógica de permissão inline:
- `get_my_cargo()` — cargo do usuário logado.
- `is_admin()`, `is_gerencia()`, `is_visualizador()`, `is_sdr()` — checagens comuns já usadas em várias policies.
Se a regra precisar de uma combinação nova de cargos, prefira criar uma função helper nova (mesmo padrão: `language sql stable security definer`) a espalhar `get_my_cargo() in (...)` em várias policies.

**Nome de policy**: siga o padrão `"tabela: descrição da regra"` (ex.: `"abastecimento_config: só admin insere"`), em português, como as migrations existentes.

**Enum `cargo_tipo`** (`consultor`, `gerente`, `admin`, `supervisor`, `visualizador`, `pos_venda`, `sdr`): para adicionar um valor novo use `alter type cargo_tipo add value if not exists 'novo_cargo';` em uma migration própria — Postgres não permite usar um valor de enum recém-adicionado na mesma transação em que ele foi criado, então qualquer policy/função que dependa do valor novo precisa ir em uma migration seguinte (veja o padrão em `20260801000000_cargo_pos_venda.sql` → `20260801010000_pos_venda.sql`).

**Comentários**: como o resto do projeto, abra a migration com um comentário curto em português explicando o *porquê* da mudança, não só o *o quê* — principalmente quando a regra de negócio não é óbvia (ex.: por que só admin edita, por que um campo é nullable).

**Decida a amplitude da policy olhando exemplos parecidos**: leitura ampla (`to authenticated using (true)`) é comum para tabelas de referência/config; regras restritas por `unidade_id`, `cargo` ou dono do registro são o padrão para dados operacionais. Não assuma — confira uma tabela do mesmo domínio antes de decidir.

**Depois de escrever a migration**: aplique com `npx supabase db push` (o projeto já tem essa permissão liberada) e confirme que não há erro antes de considerar a tarefa concluída. Se a migration precisar de uma coluna nova consumida por uma tela, coordene com o agente `crm-feature` para a parte de UI/server actions.
