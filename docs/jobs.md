# Fila de jobs (Fase 6)

Fila operacional interna persistente em PostgreSQL (padrão outbox). Não usa Redis nem
infraestrutura extra: o cluster PostgreSQL 17 já existente é suficiente e evita acoplamento ao
Redis compartilhado da VPS.

## Tabelas

- `jobs`: unidade de trabalho. Colunas principais: `type`, `status`, `priority`, `payload` (jsonb),
  `result` (jsonb), `error` (texto sanitizado), `attempts`, `max_attempts`, `timeout_ms`, `run_at`,
  `locked_at`, `locked_by`, `idempotency_key` (único), `created_by`, `started_at`, `finished_at`.
  Checks: `attempts >= 0`, `max_attempts >= 1`, `timeout_ms >= 1000`.
- `job_runs`: histórico por execução (`attempt`, `status`, `started_at`, `finished_at`,
  `duration_ms`, `error`, `logs`).
- Migration additiva `0002_organic_kate_bishop.sql`.

## Estados

`pending → running → completed` no caminho feliz. Em falha: `running → pending` (reagendado com
backoff) até esgotar tentativas, então `dead_letter`. `scheduled` para jobs futuros (`run_at` no
futuro). `cancelled` para cancelamento seguro.

```
pending/scheduled ─claim→ running ─ok→ completed
                                   └erro→ pending (backoff) … → dead_letter (esgotado)
pending/scheduled/failed/dead_letter ─cancel→ cancelled
failed/dead_letter/cancelled/completed ─retry→ pending (attempts=0)
```

## Garantias

- **Idempotência**: `enqueue` com `idempotencyKey` faz dedup (retorna o job existente em conflito).
- **Lock concorrente**: `claimNextJob` usa `SELECT … FOR UPDATE SKIP LOCKED` dentro de transação,
  então dois workers nunca pegam o mesmo job. `attempts` é incrementado no claim.
- **Retry com backoff**: exponencial determinístico `base * 2^(attempt-1)` com teto (padrão base 2s,
  teto 5min) — `computeBackoffMs`.
- **Timeout**: cada execução corre com `Promise.race` contra `timeout_ms`; timeout conta como falha.
- **Dead-letter**: ao atingir `max_attempts`, o job vai para `dead_letter` (preservado para auditoria).
- **Reivindicação de travados**: jobs presos em `running` além do `timeout_ms` (worker morto) são
  reclamados automaticamente.
- **Cancelamento seguro**: só cancela jobs não-executando/não-concluídos; jobs em execução não são
  interrompidos à força.
- **Prioridade e agendamento**: `priority` (maior primeiro) e `run_at`.
- **Logs por execução e histórico**: `job_runs` + logs estruturados com correlation id.

## Tipos de job (handlers)

`lib/jobs/handlers.ts`:

- `reconcile_account` — reconcilia o saldo de uma conta (relatório + notificação em divergência).
- `generate_notification` — cria uma notificação interna.
- `import_entities` — processa uma importação (CSV no payload), transacional.
- `export_report` — gera um snapshot do simulador/relatório.
- `maintenance` — poda segura de `job_runs` e jobs terminais antigos (retenção); nunca toca em dados
  de negócio nem em dead-letter.

Nenhum handler acessa serviços externos ou cria contas externas.

## Serviço

`lib/services/jobs-service.ts`: `enqueue`, `claim`, `complete`, `fail`, `cancel`, `retry`,
`recordRun`, `list`, `get`, `listRuns`, `stats`, `queueHealth`, `pruneOldJobs`, `computeBackoffMs`.

## Worker

`lib/jobs/worker.ts`:

- `runQueueOnce(workerId, max)` — processa até N jobs prontos e retorna a quantidade (usado por testes
  e pela ação "Processar fila agora").
- `runWorker({ workerId, pollIntervalMs })` — loop contínuo com **graceful shutdown** em
  `SIGTERM`/`SIGINT` (para de reivindicar, termina o job atual e sai). Sleep interrompível.

Execução:

```bash
corepack pnpm@9.15.9 worker
# = node --conditions=react-server --import tsx scripts/worker.ts
```

A flag `--conditions=react-server` faz o pacote `server-only` resolver para no-op no worker (os
serviços de negócio são `server-only`). `WORKER_POLL_INTERVAL_MS` ajusta o intervalo de polling.

## UI

- `/jobs`: fila com métricas por estado, filtros (status/tipo), paginação, enfileirar (reconciliar
  conta, manutenção, relatório), "Processar fila agora" e ações de reprocessar/cancelar (RBAC
  `jobs:manage`).
- `/jobs/[id]`: detalhes, cronologia, payload/resultado sanitizados e histórico de execuções.

## Permissões

`jobs` — owner/admin: full; operator/viewer: `read`. Enfileirar exige `jobs:create` (owner/admin);
reprocessar/cancelar/processar exige `jobs:manage` (owner/admin).

## Recuperação após restart

Jobs `pending`/`scheduled` continuam na tabela e são reivindicados quando o worker sobe. Jobs
`running` órfãos (worker morto) são reclamados após o timeout. Nada é perdido em restart.

## Testes que comprovam as garantias

`tests/integration/operations.test.ts` (somente `criarov0_test`):

- Idempotência: mesma `idempotencyKey` retorna o job existente, nunca duplica.
- Concorrência: dois workers reivindicando simultaneamente nunca pegam o mesmo job (`SKIP LOCKED`).
- Retry + backoff: reagenda com `runAt` futuro até esgotar `maxAttempts`, então `dead_letter`.
- Stale lock reclaim: job com `lockedAt` expirado (worker crashado) é reivindicado por outro worker
  quando `attempts < maxAttempts`; **não** é reivindicado se as tentativas já se esgotaram.
- Timeout real: `runClaimedJob` com `timeoutMs` curto grava `job_runs.status = "timeout"` e leva o
  job a `dead_letter` quando as tentativas se esgotam.
- Cancelamento: cancela jobs pendentes, recusa cancelar jobs em execução.
- Execução completa: roda um job de notificação do início ao fim e confirma o efeito (notificação
  criada) e o registro em `job_runs`.
