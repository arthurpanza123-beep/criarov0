# Autenticação

## Versão e adapter

- Better Auth: `1.6.23`.
- Adapter: `better-auth/adapters/drizzle`.
- Banco: PostgreSQL via Drizzle.
- Integração Next.js: `toNextJsHandler` em `app/api/auth/[...all]/route.ts`.

## Variáveis

```text
BETTER_AUTH_SECRET
BETTER_AUTH_URL
APP_URL
INITIAL_OWNER_NAME
INITIAL_OWNER_EMAIL
INITIAL_OWNER_PASSWORD
```

Não usar valores reais em `.env.example`. `.env.local` é ignorado pelo Git.

## Fluxos

Login:

1. `/login` chama `authClient.signIn.email`.
2. Better Auth valida e cria sessão persistente em `session`.
3. Proxy e página redirecionam usuários com `mustChangePassword=true` para `/alterar-senha`.

Sessão:

- Sessões vivem 12 horas.
- Renovação controlada por `updateAge`.
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção.
- Dados sensíveis não são guardados em cookie.

Troca obrigatória:

1. Owner ou usuário criado recebe `must_change_password=true`.
2. `/alterar-senha` exige sessão.
3. A troca usa `auth.api.changePassword`.
4. Outras sessões são revogadas quando suportado.
5. `must_change_password` vira `false`.
6. Uma atividade `password_changed` é registrada sem senha, hash, cookie ou token.

Logout:

- `logoutAction` chama `auth.api.signOut`.
- A sessão é encerrada e o usuário volta para `/login`.

## Bootstrap do owner

Comando:

```bash
corepack pnpm@9.15.9 auth:bootstrap-owner
```

O script:

- valida `INITIAL_OWNER_*`;
- normaliza e-mail;
- exige senha forte com 14+ caracteres;
- recusa criar owner duplicado;
- cria via API server-side do Better Auth;
- define `role=owner`;
- define `mustChangePassword=true`;
- registra `owner_created`;
- não imprime senha nem URL de banco.

Depois da criação em produção, remova `INITIAL_OWNER_*` do ambiente.

## RBAC

Papéis:

- `owner`
- `admin`
- `operator`
- `viewer`

Matriz resumida:

- `owner`: acesso total, usuários, configurações, contas, campanhas, indicações, clientes, pedidos, ledger e atividades.
- `admin`: gerencia contas, campanhas, indicações, clientes e pedidos; cria lançamentos administrativos permitidos; visualiza ledger e atividades; não gerencia owner nem segurança crítica.
- `operator`: lê contas/campanhas, atualiza status operacionais, cria/atualiza indicações e pedidos, registra atividades; não gerencia usuários, configurações ou ajustes financeiros administrativos.
- `viewer`: somente leitura.

A matriz tipada fica em `lib/auth/permissions.ts`.

Na Fase 5, todas as páginas do painel chamam `requirePermission(resource, "read")` e todas as
mutations passam por `guardedAction`/`requirePermission` no servidor antes de tocar em qualquer
service. Consulte `docs/dashboard-and-cruds.md` para a matriz completa por recurso e ação. O grupo
`app/(dashboard)/` tem um `error.tsx` que apresenta uma mensagem limpa (sem stack trace) caso um
papel acesse diretamente uma página sem permissão.

## Guards

Helpers server-side:

- `getCurrentSession`
- `getCurrentUser`
- `requireSession`
- `requireRole`
- `requirePermission`
- `assertPermission`

Eles leem sessão no servidor, validam usuário no banco, rejeitam usuário bloqueado e não confiam em role enviada pelo frontend.

## Proxy

`proxy.ts` faz redirecionamentos rápidos:

- não autenticado em rota protegida -> `/login`;
- autenticado em `/login` -> `/`;
- `mustChangePassword=true` -> `/alterar-senha`.

Rotas públicas:

- `/login`
- `/api/auth/*`
- `/api/health`
- `/api/health/database`
- assets do Next.js

Proxy não é autorização definitiva.

## Administração de usuários

`/usuarios` é owner-only.

Funcionalidades:

- listar usuários;
- criar usuário interno;
- alterar papel;
- bloquear;
- reativar;
- forçar troca de senha.

Restrições:

- não excluir usuário nesta fase;
- não bloquear o próprio owner;
- não bloquear ou remover papel do último owner ativo;
- não aceitar papel fora da lista;
- não retornar hash de senha;
- não registrar senha em activities.

## Segurança

- Cadastro público está desabilitado.
- Login social não foi implementado.
- Recuperação de senha por e-mail ainda não foi implementada.
- SMTP não foi configurado.
- Rate limit cobre login, troca de senha e criação de usuário.
- `DATABASE_URL`, `BETTER_AUTH_SECRET`, senha, hash, cookie, token e session token não devem aparecer em logs, docs ou commits.
