# Banco de Dados

## Bancos e role

- Cluster: PostgreSQL 17 local.
- Porta: `5433`.
- Banco principal: `criarov0`.
- Banco de teste: `criarov0_test`.
- Role da aplicação: `criarov0_app`.

Credenciais ficam somente em `.env.local`. Não versionar `.env.local` nem imprimir `DATABASE_URL`.

## Comandos

```bash
cd "/home/panza/v0 farmar"
corepack pnpm@9.15.9 db:generate
corepack pnpm@9.15.9 db:migrate
corepack pnpm@9.15.9 db:seed
corepack pnpm@9.15.9 db:check
corepack pnpm@9.15.9 test:integration
```

Para aplicar migration no banco de teste:

```bash
set -a
source .env.local
set +a
DRIZZLE_DATABASE_URL="$TEST_DATABASE_URL" corepack pnpm@9.15.9 db:migrate
```

## Nova migration

1. Alterar arquivos em `lib/db/schema/`.
2. Rodar `corepack pnpm@9.15.9 db:generate`.
3. Revisar o SQL gerado em `lib/db/migrations/`.
4. Aplicar primeiro em `criarov0_test`.
5. Rodar `corepack pnpm@9.15.9 test:integration`.
6. Aplicar em `criarov0`.

Não usar `drizzle-kit push` em produção.

## Seed

O seed atual é idempotente e insere apenas settings não sensíveis:

- `app.currency`
- `app.locale`
- `app.timezone`
- `app.defaultMonthlyLimit`
- `app.schemaVersion`

Ele pode ser executado mais de uma vez sem duplicar registros:

```bash
corepack pnpm@9.15.9 db:seed
corepack pnpm@9.15.9 db:seed
```

## Auth

Better Auth 1.6.23 usa o adapter oficial Drizzle e adiciona a migration:

- `lib/db/migrations/0001_cuddly_ultimo.sql`

Tabelas adicionadas:

- `user`
- `session`
- `account`
- `verification`
- `rate_limit`

Colunas principais em `user`:

- `id uuid primary key`
- `name`
- `email unique`
- `email_verified`
- `image`
- `role`
- `banned`
- `ban_reason`
- `ban_expires`
- `must_change_password`
- `created_at`
- `updated_at`

Relações:

- `session.user_id -> user.id ON DELETE CASCADE`
- `account.user_id -> user.id ON DELETE CASCADE`
- `activities.actor_user_id -> user.id ON DELETE SET NULL`

O banco principal e o banco de teste possuem 14 tabelas públicas após a Fase 4.

## Fase 5

A Fase 5 (dashboard e CRUDs) **não alterou o schema**: nenhuma tabela nova e nenhuma migration nova
foram necessárias. As 14 tabelas públicas continuam as mesmas. Os testes de integração da Fase 5
(`tests/integration/crud.test.ts`) usam exclusivamente `criarov0_test`, com guarda destrutiva que
recusa executar se `TEST_DATABASE_URL` não apontar para `criarov0_test`.

## Fase 6

A Fase 6 adiciona **3 tabelas** (agora **17 públicas**) via a migration aditiva
`lib/db/migrations/0002_organic_kate_bishop.sql` (somente `CREATE TYPE`/`CREATE TABLE`/
`ADD CONSTRAINT`/`CREATE INDEX`; nenhum `DROP`):

- `jobs` — fila operacional (tipo, status, prioridade, payload, tentativas, backoff, timeout,
  agendamento, lock, idempotency key única, autor).
- `job_runs` — histórico por execução (tentativa, status, duração, erro sanitizado, logs).
- `import_batches` — histórico de importações (entidade, modo dry-run/commit, contagens, relatório).

Enums novos: `job_type`, `job_status`, `job_run_status`, `import_entity`, `import_status`.

Protocolo de migration aplicado: gerada com `db:generate`, revisada, aplicada em `criarov0_test`,
suíte executada, backup do principal com checksum, depois aplicada em `criarov0`. Nunca
`drizzle-kit push`; nunca `DROP` destrutivo. Testes de integração da Fase 6
(`tests/integration/operations.test.ts`) e E2E usam exclusivamente `criarov0_test`.

**Estado real confirmado**: `criarov0` (principal) e `criarov0_test` têm ambos 17 tabelas públicas e
3/3 migrations aplicadas (`drizzle.__drizzle_migrations`). O principal tem 168 constraints e 54
índices em `public`.

Bootstrap do owner:

```bash
corepack pnpm@9.15.9 auth:bootstrap-owner
```

O script é idempotente, cria somente quando ainda não existe owner, usa API server-side do Better Auth para criar credencial e não imprime senha. Após criar o owner em produção, as variáveis `INITIAL_OWNER_*` podem ser removidas do ambiente.

## Verificação

Verificar tabelas:

```bash
sudo -u postgres psql -p 5433 -d criarov0 -c "\\dt"
```

Verificar índices:

```bash
sudo -u postgres psql -p 5433 -d criarov0 -c "\\di"
```

Verificar migrations aplicadas:

```bash
sudo -u postgres psql -p 5433 -d criarov0 -c "select * from drizzle.__drizzle_migrations order by created_at"
```

## Rollback seguro

Não executar `DROP DATABASE`, `DROP SCHEMA`, `DROP TABLE` ou comandos destrutivos sem plano explícito e backup.

Rollback seguro deve ser feito por nova migration versionada que reverta a alteração de forma controlada. Antes de aplicar no banco principal, testar em `criarov0_test`.
