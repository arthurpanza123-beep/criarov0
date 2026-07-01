# Arquitetura

## Stack atual

- Next.js 16 com App Router.
- React 19.
- TypeScript estrito.
- PostgreSQL 17 local na VPS.
- Drizzle ORM com migrations SQL versionadas.
- Driver `postgres`/postgres.js.
- Better Auth 1.6.23 com adapter oficial Drizzle.
- Zod para contratos de domínio.
- Vitest para testes unitários e de integração.
- Tailwind CSS 4.
- shadcn/base-ui parcial para componentes.
- ESLint com `eslint-config-next`.

## Estrutura

- `app/`: páginas, layouts e route handlers.
- `app/api/health/route.ts`: health principal sem dependência frágil de banco.
- `app/api/health/database/route.ts`: health específico de banco com `SELECT 1`.
- `app/api/auth/[...all]/route.ts`: handler oficial Better Auth para App Router.
- `app/login/page.tsx`: login interno por e-mail e senha.
- `app/alterar-senha/page.tsx`: troca obrigatória da senha inicial.
- `app/usuarios/page.tsx`: administração básica owner-only.
- `components/`: componentes visuais preservados do frontend v0.
- `lib/auth/`: Better Auth, RBAC, guards server-side, política de usuários e validações.
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
user
session -> user
account -> user
verification
rate_limit
```

`activities.actor_user_id` é nullable e referencia `user.id` com `ON DELETE SET NULL`.

## Política de dinheiro

Valores monetários e créditos usam `numeric(14, 2)`, nunca `real`, `double precision` ou float. No TypeScript, valores vindos do driver podem ser tratados como string decimal. O cálculo de saldo confirmado segue:

`earned + adjustment + sale - spent - expired`

`adjustment` pode ser positivo ou negativo. Lançamentos pendentes ou cancelados não entram no saldo confirmado.

## Repositories e services

Repositories encapsulam persistência, paginação limitada e ordenação controlada. Eles não importam React e não implementam autorização.

Services contêm regras de negócio. Exemplo: saldo de conta deve poder ser calculado pelo ledger confirmado, não depender somente de `managed_accounts.credit_balance`.

Fluxo previsto:

`UI -> Server Action/Route Handler -> validators -> auth policy -> service -> repository -> Drizzle -> PostgreSQL`

## Autenticação e autorização

Better Auth 1.6.23 está configurado em `lib/auth/auth.ts` com:

- adapter oficial Drizzle para PostgreSQL;
- e-mail e senha habilitados;
- cadastro público desabilitado;
- plugin Admin para `role` e `banned`;
- campo adicional `must_change_password`;
- sessões persistentes em tabela;
- rate limit em banco;
- cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- trusted origins vindas de `APP_URL`/`BETTER_AUTH_URL`;
- IDs UUID gerados via `pg_catalog.gen_random_uuid()`.

Papéis implementados:

- `owner`
- `admin`
- `operator`
- `viewer`

A matriz tipada fica em `lib/auth/permissions.ts`. Guards server-side ficam em `lib/auth/session.ts`/`lib/auth/guards.ts` e expõem funções como `getCurrentSession`, `getCurrentUser`, `requireSession`, `requireRole`, `requirePermission` e `assertPermission`.

`proxy.ts` faz apenas redirecionamentos otimistas para `/login` e `/alterar-senha`. A autorização definitiva ocorre nas páginas, Route Handlers e Server Actions.

## Fronteiras de segurança

O sistema não automatiza cadastros em plataformas externas, CAPTCHA, OTP, links de afiliado, sessões de terceiros ou navegação externa. Contas gerenciadas não armazenam senha, senha de e-mail, cookie, OTP ou token de sessão externa.

## Testes

Testes unitários não dependem de banco. Testes de integração usam exclusivamente `criarov0_test` e possuem proteção que recusa execução se `TEST_DATABASE_URL` não apontar claramente para esse banco.

## Fase 5 — dashboard e CRUDs

O painel administrativo está conectado ao PostgreSQL real na branch `feat/dashboard-cruds`.
Detalhes completos (rotas, páginas, repositories, services, Server Actions, matriz de permissões,
filtros, paginação, transições, regras financeiras, ledger, reconciliação, notificações,
configurações, testes e limitações) estão em `docs/dashboard-and-cruds.md`.

Camadas adicionadas:

- `lib/admin/`: utilidades do painel — `server-action.ts` (`runGuardedAction`/`guardedAction`),
  `action-result.ts`, `form-schemas.ts` (Zod), `money.ts` (centavos em BigInt), `status.ts`
  (transições e lucro), `pagination.ts`, `search-params.ts`, `normalize.ts`, `display.ts`,
  `audit.ts` e `activity-metadata.ts` (sanitização de metadata).
- `components/admin/`: `admin-shell.tsx` (sidebar, navegação por RBAC, badge de notificações,
  logout) e `primitives.tsx` (tabela, paginação, filtros, estados vazios, badges).
- `app/(dashboard)/`: grupo protegido com dashboard, contas, campanhas, indicações, clientes,
  pedidos, créditos, atividades, notificações e configurações, cada um com `page.tsx` e
  `actions.ts` quando há mutations, além de `error.tsx` (limite de erro sem stack trace).

Nenhuma tabela nova foi criada nesta fase; nenhuma migration nova foi necessária.

## Ainda não implementado

- Feedback inline de erros por formulário (Server Actions usam progressive enhancement).
- Job agendado de reconciliação (hoje é sob demanda).
- E2E com Playwright (coberto por integração + smoke test).
- Recuperação de senha por e-mail/SMTP.
- Login social.
- PM2, Nginx, domínio e deploy definitivo.
