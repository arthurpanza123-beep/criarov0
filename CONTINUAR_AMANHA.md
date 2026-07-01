# Continuar Amanhã

## Estado atual

Fase 4 — Better Auth, login, sessão persistente e RBAC implementada na branch `feat/auth-rbac`.

O painel possui autenticação interna por e-mail e senha, owner inicial, troca obrigatória da senha inicial, RBAC server-side, Proxy com redirecionamentos rápidos, logout e administração básica de usuários owner-only.

Não foram implementados login social, recuperação de senha por e-mail, SMTP, PM2, Nginx, domínio ou deploy definitivo.

## Último commit

- Commit base da Fase 3: `22726b4 feat: add postgres and drizzle persistence foundation`.
- Commit da Fase 4: `feat: add secure authentication and rbac`.

## Banco usado

- Cluster PostgreSQL: 17.
- Porta PostgreSQL: `5433`.
- Banco principal: `criarov0`.
- Banco de teste: `criarov0_test`.
- Role da aplicação: `criarov0_app`.

Credenciais ficam somente em `.env.local`. Não versionar nem imprimir `DATABASE_URL`.

## Migrations

- `lib/db/migrations/0000_stiff_firebird.sql`
- `lib/db/migrations/0001_cuddly_ultimo.sql`

## Tabelas atuais

14 tabelas públicas:

- `managed_accounts`
- `campaigns`
- `referrals`
- `credit_ledger`
- `customers`
- `orders`
- `activities`
- `notifications`
- `settings`
- `user`
- `session`
- `account`
- `verification`
- `rate_limit`

Também existe a tabela de controle do Drizzle no schema `drizzle`.

## Better Auth

- Versão: `1.6.23`.
- Adapter: `better-auth/adapters/drizzle`.
- Handler: `app/api/auth/[...all]/route.ts`.
- Cadastro público: desabilitado.
- Login social: não implementado.
- Bloqueio de usuário: campo oficial `banned` do plugin Admin.
- Campo adicional: `user.must_change_password`.

## Rotas criadas

- `/login`
- `/alterar-senha`
- `/usuarios`
- `/api/auth/[...all]`

## Owner

Owner inicial criado de forma idempotente no banco principal. O relatório e os logs mostram apenas e-mail mascarado; senha não foi exibida.

As variáveis `INITIAL_OWNER_*` podem ser removidas do ambiente de produção depois de confirmar o primeiro acesso e a troca de senha.

## Testes

Validações executadas na Fase 4:

```bash
corepack pnpm@9.15.9 typecheck
corepack pnpm@9.15.9 lint
corepack pnpm@9.15.9 test
corepack pnpm@9.15.9 test:integration
corepack pnpm@9.15.9 build
corepack pnpm@9.15.9 db:check
```

Testes unitários cobrem matriz RBAC, senha forte, papel, callback URL, último owner, autobloqueio e `mustChangePassword`.

Testes de integração usam exclusivamente `criarov0_test` e cobrem migration de auth, bootstrap idempotente, login, login incorreto, cadastro público bloqueado, sessão, logout, troca obrigatória, senha alterada, usuário bloqueado, owner criando usuário, viewer sem mutation, FK de activities e ausência de hash em resposta user-facing.

## PM2

Nenhum processo PM2 criado ou alterado.

## Nginx e domínio

Nenhum Nginx ou domínio foi configurado.

DNS informado para fase futura: `v0.panzza.com.br`.

## Próximo passo exato

Fase 5 — conectar dashboard e CRUDs ao PostgreSQL real.
