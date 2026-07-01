# Dashboard e CRUDs (Fase 5)

Fase que conecta o dashboard e os CRUDs administrativos ao PostgreSQL real, na branch
`feat/dashboard-cruds`. Nenhuma tabela nova foi criada: a Fase 5 usa o schema das Fases 3 e 4.

## Rotas e páginas

Todas as páginas do painel ficam no grupo `app/(dashboard)/`, protegido por `layout.tsx`
(`getCurrentUser` + redirecionamentos) e servido de forma dinâmica (`dynamic = "force-dynamic"`).

| Rota | Página | Recurso RBAC | Descrição |
| --- | --- | --- | --- |
| `/` | `page.tsx` | `dashboard` | Métricas reais agregadas do banco. |
| `/contas` | `contas/page.tsx` | `managedAccounts` | Contas gerenciadas + reconciliação. |
| `/campanhas` | `campanhas/page.tsx` | `campaigns` | Campanhas. |
| `/indicacoes` | `indicacoes/page.tsx` | `referrals` | Indicações e transições. |
| `/clientes` | `clientes/page.tsx` | `customers` | Clientes. |
| `/pedidos` | `pedidos/page.tsx` | `orders` | Pedidos, transições e lucro. |
| `/creditos` | `creditos/page.tsx` | `creditLedger` | Extrato e lançamentos de crédito. |
| `/atividades` | `atividades/page.tsx` | `activities` | Auditoria (metadata sanitizada). |
| `/notificacoes` | `notificacoes/page.tsx` | `dashboard` | Notificações internas. |
| `/configuracoes` | `configuracoes/page.tsx` | `settings` | Configurações editáveis. |
| `/usuarios` | `app/usuarios/page.tsx` | owner-only | Administração de usuários (Fase 4). |

O layout monta a sidebar/navegação filtrando itens por `can(role, resource, "read")`, exibe o
badge de notificações não lidas (`notificationsService.unreadCount()`) na sidebar e no header, e
oferece logout. `app/(dashboard)/error.tsx` é um limite de erro que evita 500 cru e não expõe
stack trace quando um papel acessa diretamente uma página sem permissão.

## Camadas

```
UI (Server Component)
  -> Server Action (guardedAction / requirePermission)
    -> validação Zod (lib/admin/form-schemas.ts)
      -> service (lib/services/*)
        -> repository / query Drizzle (lib/repositories/*, lib/db)
          -> PostgreSQL
  -> recordAdminActivity (audit)
  -> revalidatePath
```

### Repositories (`lib/repositories/`)

Fábricas `createXRepository(db)` + singleton padrão para: `managed-accounts`, `campaigns`,
`referrals`, `customers`, `orders`, `credit-ledger`, `activities`, `notifications`, `settings`.
Encapsulam persistência, ordenação controlada e paginação limitada (`normalizePagination`, 1..100).
Não importam React e não fazem autorização.

### Services (`lib/services/`)

- `dashboard-service.ts`: `getDashboardMetrics({ range, from, to })` agrega contas, campanhas,
  indicações, clientes, pedidos, ledger confirmado e atividades recentes. As datas do período são
  ligadas via `gte`/`lte` do Drizzle (tipagem correta de timestamp).
- `managed-accounts-service.ts`, `campaigns-service.ts`, `referrals-service.ts`,
  `customers-service.ts`, `orders-service.ts`: list/find/create/update/archive/restore + transições.
- `credit-ledger-service.ts`: `list`, `create`, `confirm`, `cancel`,
  `calculateConfirmedLedgerBalance`, `reconcile`.
- `activity-log-service.ts`: `activitiesService.list` com join do ator.
- `notifications-service.ts`: `list`, `unreadCount`, `create`, `markRead`, `markAllRead`.
- `settings-service.ts`: `list`, `get`, `upsert`, `updateEditable` + `editableSettings`
  (validação Zod por chave) + `isEditableSettingKey`.

### Server Actions

Cada `actions.ts` expõe Server Actions ligadas a `<form action>` (progressive enhancement).

- `contas`: create, update, updateStatus, archive, restore, **reconcile**.
- `campanhas`: create, update, archive, restore.
- `indicacoes`: create, update, transition, approve, archive, restore.
- `clientes`: create, update, archive, restore.
- `pedidos`: create, update, transition, archive, restore.
- `creditos`: create, confirm, cancel.
- `notificacoes`: markRead, markAllRead.
- `configuracoes`: updateSetting.

## Fluxo padrão de mutation

`lib/admin/server-action.ts` separa:

- `runGuardedAction(resource, action, paths, op)`: executa `requirePermission` → `op(actorId)` →
  `revalidatePath` e retorna um `ActionResult` seguro (mapeia `AuthGuardError` para
  "Sessão expirada."/"Acesso negado.", `ZodError` para `fieldErrors`, e demais erros para a
  mensagem, sem stack trace). É a unidade testada em `tests/unit/server-action.test.ts`.
- `guardedAction(...)`: wrapper que descarta o resultado e resolve `void`, exigido pelo tipo de
  `<form action>` no React 19 / Next 16.

Toda mutation valida sessão + permissão + entrada no servidor. Botões ocultos não são mecanismo de
segurança: a autorização acontece no servidor mesmo que o formulário seja enviado diretamente.

## Matriz de permissões (mutations)

| Recurso | owner | admin | operator | viewer |
| --- | --- | --- | --- | --- |
| dashboard | full | read | read | read |
| managedAccounts | full | full | read, update | read |
| campaigns | full | full | read | read |
| referrals | full | full | read, create, update | read |
| customers | full | full | read | read |
| orders | full | full | read, update | read |
| creditLedger | full | read, create | read | read |
| activities | full | read | read, create | read |
| settings | full | read, update | — | read |
| users | full | — | — | — |

`full` = read, create, update, archive, manage. Fonte: `lib/auth/permissions.ts` (`rbacRoles`).
`reconcile` exige `managedAccounts:manage` (owner/admin). `/usuarios` é owner-only.

## Filtros, pesquisa e paginação

- `lib/admin/search-params.ts`: leitura assíncrona de `searchParams`.
- `lib/admin/pagination.ts`: `normalizeListParams` (page/pageSize 1..100, offset, `q`, `status`,
  `type`, `accountId`, `campaignId`, `from`/`to`, `unread`) e `makePaginatedResult`.
- Listagens usam `ilike` para busca textual, filtro por status/tipo, filtro de arquivados
  (`archived`) e ordenação `desc(createdAt/occurredAt)`.
- Componentes em `components/admin/primitives.tsx`: `SearchFilter`, `DataTable`, `EmptyState`,
  `Pagination`, `StatusBadge`, `MetricCard`, `Panel`, `PageHeader`.

## Status e transições

- Indicações (`lib/admin/status.ts` → `referralTransitions`):
  `pending → invited → {accessed|registered} → {awaiting_approval|registered} → approved`, com
  `rejected`/`archived` como saídas. `approve` exige estado que permita `approved`.
- Pedidos (`orderTransitions`):
  `draft → pending_payment → paid → processing → delivered`, com `cancelled`/`refunded`.
- `owner`/`admin` (permissão `manage`) podem aplicar transições administrativas fora do fluxo padrão;
  `operator` (permissão `update`) segue apenas as transições válidas.

## Regras financeiras

- Dinheiro é `numeric(14,2)`; nunca float. Cálculo em centavos com `BigInt` (`lib/admin/money.ts`).
- Valores negativos são rejeitados, exceto lançamentos do tipo `adjustment`.
- Saldo confirmado = `earned + sale + adjustment − spent − expired`, apenas status `confirmed`
  (`calculateConfirmedLedgerBalance`).
- Lançamentos confirmados não são apagados nem editados silenciosamente. Confirmar/cancelar preserva
  a linha (histórico) alterando apenas o status.
- **Reconciliação** (`reconcile`): compara `managed_accounts.credit_balance` (persistido) com o saldo
  calculado pelo ledger confirmado, gera relatório (`{ persisted, calculated, diverged }`), registra
  a atividade `credit_balance_reconciled` e emite notificação de aviso em caso de divergência.
  **Nunca corrige automaticamente** o banco principal.

## Notificações

- Listagem com filtro lidas/não lidas (`unread=true|false`), marcar uma como lida, marcar todas.
- Badge de não lidas na sidebar e no header do `AdminShell`.
- Tipos: `info`, `success`, `warning`, `error`.

## Configurações

- Apenas chaves de aplicação são editáveis: `app.currency`, `app.locale`, `app.timezone`,
  `app.defaultMonthlyLimit`, cada uma com validação Zod própria (`editableSettings`).
- `updateEditableSetting` rejeita qualquer chave fora da whitelist, impedindo edição de segredos e
  variáveis de ambiente (ex.: `BETTER_AUTH_SECRET`, `DATABASE_URL`).
- Segredos nunca são exibidos na página.

## Atividades

- `recordAdminActivity` sanitiza o metadata na escrita via `sanitizeActivityMetadata`
  (`lib/admin/activity-metadata.ts`), removendo chaves sensíveis (password/senha, secret, token,
  cookie, session, hash, header, authorization, credential, api key). A página de atividades também
  reaplica a sanitização na exibição (defesa em profundidade) e só mostra metadata para admin/owner.

## Testes

- Unitários (`tests/unit/`): `admin.test.ts` (money, lucro, transições, normalização de e-mail/
  telefone, paginação/params, schemas de formulário, settings por chave, sanitização de metadata),
  `server-action.test.ts` (guard de mutation: sucesso+revalidate, bloqueio de permissão, sessão
  expirada, erros Zod → fieldErrors sem stack trace, erro de domínio), além de `domain.test.ts`,
  `auth.test.ts`, `health.test.ts`.
- Integração (`tests/integration/`, somente `criarov0_test`): `crud.test.ts` cobre CRUD de todos os
  recursos, arquivamento/restauração, ledger (não-negativo, exceção de ajuste, confirmar/cancelar,
  histórico preservado, saldo), reconciliação (concordância/divergência/sem autocorreção),
  métricas do dashboard, atividades (metadata sanitizada + join do ator), notificações, settings
  (persistência de editáveis + rejeição de não editáveis) e a matriz RBAC (owner/admin/operator/
  viewer + bloqueio de mutations do viewer). Guarda destrutiva explícita recusa rodar fora de
  `criarov0_test`.

## Smoke test

Servidor de produção (`next start`) subido temporariamente em porta livre, ligado a
`criarov0_test` (sem escrever no banco principal). Validou health, `/login`, redirecionamento de
todas as rotas protegidas para `/login` quando não autenticado, dashboard real e leitura de
`/contas` para owner/admin/operator/viewer, `/usuarios` owner-only e logout com revogação de sessão.

## Limitações reais

- Formulários usam progressive enhancement (Server Actions) sem exibição inline de erros de
  validação; erros são tratados no servidor sem vazar stack trace. Feedback visual inline por
  formulário é uma evolução futura.
- Reconciliação é sob demanda (por conta), registrada como atividade/notificação; não há job
  agendado.
- Sem E2E (Playwright): a validação de rotas/permissões é coberta por integração + smoke test.
- Nenhuma automação externa, navegador automatizado, OTP, CAPTCHA, e-mail externo ou afiliados.
