# Continuar Amanhã

## Estado atual

Fase 5 — dashboard e CRUDs conectados ao PostgreSQL real, implementada na branch
`feat/dashboard-cruds`.

O painel administrativo lê e escreve dados reais no PostgreSQL: dashboard com métricas agregadas,
CRUDs de contas gerenciadas, campanhas, indicações, clientes, pedidos e créditos, extrato e
reconciliação do ledger, página de atividades (auditoria), notificações (com badge no header) e
configurações (chaves de aplicação com validação Zod por chave). Toda mutation valida sessão,
permissão e entrada no servidor, registra activity e revalida cache. Detalhes em
`docs/dashboard-and-cruds.md`.

Fase 4 — Better Auth, login, sessão persistente e RBAC — permanece na base: autenticação interna
por e-mail e senha, owner inicial, troca obrigatória da senha inicial, RBAC server-side, Proxy com
redirecionamentos rápidos, logout e administração de usuários owner-only.

Não foram implementados login social, recuperação de senha por e-mail, SMTP, PM2, Nginx, domínio,
deploy definitivo, E2E (Playwright), automação externa, navegador automatizado, OTP, CAPTCHA ou
afiliados.

## Último commit

- Commit base da Fase 3: `22726b4 feat: add postgres and drizzle persistence foundation`.
- Commit da Fase 4: `feat: add secure authentication and rbac`.
- Commit da Fase 5: `feat: connect dashboard and cruds to postgres`.

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

## Testes da Fase 5

Executados e aprovados:

```bash
corepack pnpm@9.15.9 typecheck        # 0 erros
corepack pnpm@9.15.9 lint             # 0 avisos
corepack pnpm@9.15.9 test             # 45 testes (5 arquivos)
corepack pnpm@9.15.9 test:integration # 37 testes (3 arquivos), somente criarov0_test
corepack pnpm@9.15.9 build            # build de produção ok
corepack pnpm@9.15.9 db:check         # migrations consistentes
```

Smoke test: `next start` em porta livre ligado a `criarov0_test`, 30/30 checagens aprovadas
(health, login, proteção de rotas, dashboard real, leituras por papel, `/usuarios` owner-only,
logout). Não há script `test:e2e`.

## Próximo passo exato

Fase 6 — ainda não iniciada. Não configurar PM2, Nginx ou domínio nesta etapa.

DNS informado para fase futura: `v0.panzza.com.br`.
