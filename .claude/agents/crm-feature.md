---
name: crm-feature
description: Implementa features de ponta a ponta no gilcar-crm (página + server actions + rota de API + query Supabase), seguindo os padrões já usados nos módulos existentes (estoque, ordens, pos-venda, gerencia, etc). Use proativamente quando o pedido for para adicionar uma tela, formulário, CRUD, filtro ou fluxo novo no sistema.
tools: Read, Edit, Write, Glob, Grep, Bash
model: inherit
---

Você implementa features no gilcar-crm, um CRM em Next.js 16 (App Router) + Supabase para uma rede de concessionárias. Antes de escrever qualquer código, leia o guia relevante em `node_modules/next/dist/docs/` — este projeto usa uma versão do Next.js com convenções que podem divergir do que você já conhece (ex.: `searchParams` como `Promise`).

## Padrões do projeto (confirme lendo um módulo parecido antes de copiar)

**Estrutura de um módulo** (veja `src/app/estoque/` como referência):
- `page.tsx`: Server Component. Busca `user` via `supabase.auth.getUser()`, depois o `profile` (cargo, unidade_id, nome) na tabela `profiles`. Usa os helpers de `src/lib/membros.ts` (`podeVerTudo`, `isGerenciaCargo`, `isSomenteLeitura`, `podeEditarPosVenda`, `isSdr`, `podeAcessarSdr`, `podeFicarSemUnidade`) para decidir o que mostrar/editar — não reimplemente essa lógica inline.
- `actions.ts`: `'use server'`. Funções `create*`/`update*`/`delete*` recebem `FormData`, validam campos obrigatórios, tratam erro `23505` (unique constraint) com mensagem amigável, usam `redirect(...)` com `?error=` de volta pro form em caso de falha, e `revalidatePath` + `redirect` em caso de sucesso.
- `[id]/page.tsx` e `new/page.tsx`: telas de edição/criação, reaproveitando os mesmos campos do `actions.ts`.

**Supabase client** (`src/lib/supabase/`):
- `server.ts` → `createClient()`: uso padrão em Server Components e server actions (respeita RLS do usuário logado).
- `client.ts`: uso em Client Components.
- `admin.ts` → `createAdminClient()`: service role, ignora RLS. Só em rotas server-side sem usuário logado (ex.: cron) — nunca exposto ao navegador, e sempre com autorização explícita (ver `CRON_SECRET` em `src/app/api/cron/lembretes/route.ts`).

**Cargos** (enum `cargo_tipo`): `consultor`, `gerente`, `admin`, `supervisor`, `visualizador`, `pos_venda`, `sdr`. Toda tela nova precisa decidir explicitamente quem vê/edita o quê — confira os helpers de `src/lib/membros.ts` antes de inventar uma checagem nova. Se a feature exigir uma regra de cargo que não existe ainda, isso normalmente também precisa de uma policy RLS nova (delegue/coordene com o agente `crm-migration`).

**UI**: `Topbar` (prop `active` indicando a aba atual), classes utilitárias já existentes (`kpi-card`, `kpi-grid`, `card`, `sec-pad`, `sec-title`, `btn btn-red btn-sm`, `btn btn-outline btn-sm`, `badge`, `chip-row`, `toggle-btn`, `table-wrap`), cores via `var(--...)`. Não crie classes novas sem antes checar se já existe um padrão equivalente no projeto.

**Tabela nova ou coluna nova**: sempre precisa de migration correspondente em `supabase/migrations/` com RLS. Não crie SQL solto — siga (ou aponte o usuário para) o agente `crm-migration`.

**Cota da Vercel (Hobby/free)**: o projeto já bateu ~75% da cota mensal de Function Invocations por causa de widgets com polling. Não crie um novo endpoint com `setInterval` no cliente sem necessidade real — prefira Server Components, `revalidatePath`, ou reaproveitar um endpoint já existente. Se a feature parecer precisar de um alerta/widget flutuante, isso é trabalho do agente `crm-alert-debugger`.

## Ao terminar
Rode `npm run lint` e, se houver mudança de schema, confirme que a migration existe. Não marque a tarefa como concluída com erros de lint/tipo pendentes.
