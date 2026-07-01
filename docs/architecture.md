# Arquitetura

## Stack atual

- Next.js 16 com App Router.
- React 19.
- TypeScript estrito.
- PostgreSQL 17 local na VPS.
- Drizzle ORM com migrations SQL versionadas.
- Driver `postgres`/postgres.js.
- Zod para contratos de domínio.
- Vitest para testes unitários e de integração.
- Tailwind CSS 4.
- shadcn/base-ui parcial para componentes.
- ESLint com `eslint-config-next`.

## Estrutura

- `app/`: páginas, layouts e route handlers.
- `app/api/health/route.ts`: health principal sem dependência frágil de banco.
- `app/api/health/database/route.ts`: health específico de banco com `SELECT 1`.
- `components/`: componentes visuais preservados do frontend v0.
- `lib/db/client.ts`: cliente Drizzle/postgres.js lazy e seguro para Next.js.
- `lib/db/schema/`: schema PostgreSQL separado por tabela.
- `lib/db/migrations/`: migrations SQL versionadas.
- `lib/db/seed.ts`: seed idempotente de settings não sensíveis.
- `lib/repositories/`: acesso a dados com queries Drizzle parametrizadas.
- `lib/services/`: regras de negócio puras ou coordenadoras.
- `lib/types/`: tipos de domínio compartilhados.
- `lib/validators/`: schemas Zod.
- `tests/unit/`: testes unitários.
- `tests/integration/`: testes contra `criarov0_test`.
- `docs/`: documentação técnica.

## PostgreSQL e Drizzle

O projeto usa o cluster PostgreSQL 17 local na porta 5433, sem alterar configurações globais. Existem dois bancos exclusivos:

- `criarov0`: banco principal.
- `criarov0_test`: banco exclusivo de integração.

A role da aplicação é `criarov0_app`, sem superuser, sem `createdb` e sem `createrole`. Credenciais ficam somente em `.env.local`, que não deve ser versionado.

O schema Drizzle é centralizado em `lib/db/schema/index.ts`. As migrations são geradas por `drizzle-kit generate` e aplicadas por `drizzle-kit migrate`; `drizzle-kit push` não deve ser usado em produção.

## Tabelas

```text
managed_accounts
campaigns
referrals -> campaigns
credit_ledger -> managed_accounts, campaigns?, referrals?
customers
orders -> customers
activities
notifications
settings
```

`activities.actor_user_id` é nullable nesta fase. A foreign key para usuários será adicionada na Fase 4, junto com Better Auth.

## Política de dinheiro

Valores monetários e créditos usam `numeric(14, 2)`, nunca `real`, `double precision` ou float. No TypeScript, valores vindos do driver podem ser tratados como string decimal. O cálculo de saldo confirmado segue:

`earned + adjustment + sale - spent - expired`

`adjustment` pode ser positivo ou negativo. Lançamentos pendentes ou cancelados não entram no saldo confirmado.

## Repositories e services

Repositories encapsulam persistência, paginação limitada e ordenação controlada. Eles não importam React e não implementam autorização.

Services contêm regras de negócio. Exemplo: saldo de conta deve poder ser calculado pelo ledger confirmado, não depender somente de `managed_accounts.credit_balance`.

Fluxo previsto:

`UI -> Server Action/Route Handler -> validators -> auth policy -> service -> repository -> Drizzle -> PostgreSQL`

## Fronteiras de segurança

O sistema não automatiza cadastros em plataformas externas, CAPTCHA, OTP, links de afiliado, sessões de terceiros ou navegação externa. Contas gerenciadas não armazenam senha, senha de e-mail, cookie, OTP ou token de sessão externa.

## Testes

Testes unitários não dependem de banco. Testes de integração usam exclusivamente `criarov0_test` e possuem proteção que recusa execução se `TEST_DATABASE_URL` não apontar claramente para esse banco.

## Ainda não implementado

- Better Auth.
- Login, sessão persistente e RBAC.
- Usuário owner inicial.
- CRUD público via App Router.
- Painel conectado ao banco.
- Filas reais.
- Métricas persistentes.
- PM2, Nginx, domínio e deploy definitivo.
