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
