# Observabilidade (Fase 6)

## Logs estruturados

`lib/observability/logger.ts` — logger JSON sem dependências, com níveis `debug|info|warn|error`
(`LOG_LEVEL` controla o mínimo, padrão `info`). Cada linha inclui `level`, `time` (ISO), `message`
e contexto. `logger.child({...})` cria loggers com bindings (ex.: `workerId`, `jobId`,
`correlationId`).

### Sanitização

`sanitizeLogValue` redige recursivamente:

- Chaves sensíveis (`password/senha`, `secret`, `token`, `cookie`, `session`, `authorization`,
  `credential`, `api key`, `hash`, `database_url`, `connection_string`, `dsn`) → `"[redacted]"`.
- Strings com connection strings (`scheme://user:pass@host/db`) → `"[redacted-connection]"`.

`safeErrorMessage` (`lib/observability/errors.ts`) retorna a mensagem do erro **sem stack trace** e
com connection strings redigidas; fallback genérico.

## Correlation ID

`lib/observability/correlation.ts` — `newCorrelationId()` e `correlationIdFromHeaders()` (header
`x-correlation-id`). Cada execução de job recebe um correlation id propagado nos logs.

## Versão e commit

`lib/observability/version.ts` — `versionInfo()` retorna `{ name, version, commit, node, env }`.
`commit` vem de `APP_COMMIT`/`GIT_COMMIT` (definir no deploy), senão `"unknown"`.

## Endpoints

| Rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /api/health` | público | Liveness (status/serviço/versão). |
| `GET /api/health/database` | público | Conectividade do banco (`select 1`). |
| `GET /api/health/ready` | público | Readiness: banco + fila; 200 `ready` / 503 `degraded`. |
| `GET /api/version` | público | Versão + commit + node + env. |
| `GET /api/metrics` | `system:read` (owner/admin) | Versão + saúde da fila (contagens). |

Rotas de saúde/versão são públicas via `proxy.ts` (prefixos `/api/health`, `/api/version`).
`/api/metrics` é protegida (sessão + permissão) e responde 401/403 em JSON, com
`Cache-Control: no-store, private`.

## Página de saúde

`/sistema` (RBAC `system:read` = owner/admin): status do banco, saúde da fila (pendentes,
executando, falhas, dead-letter, pendente mais antigo), versão/commit/ambiente/node e ponteiros
operacionais. Owner-only para gestão (`system:manage`).

## Não exposto

`DATABASE_URL`, segredos, cookies, tokens, senhas, headers completos e stack traces **nunca** são
expostos ao usuário nem gravados em logs/activities (activities também são sanitizadas em escrita).
