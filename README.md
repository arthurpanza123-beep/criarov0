# v0 Farm Console (criarov0)

Painel administrativo de gestão de contas gerenciadas, campanhas de indicação, clientes, pedidos,
créditos e operações internas (fila de jobs, importação/exportação, relatórios), com autenticação,
RBAC e observabilidade.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript estrito.
- PostgreSQL 17 + Drizzle ORM (migrations SQL versionadas).
- Better Auth 1.6.23 (e-mail/senha, RBAC, sem cadastro público).
- Fila de jobs própria em PostgreSQL (sem Redis).
- Vitest (unit/integração) + Playwright (E2E).
- Tailwind CSS 4.

Detalhes completos em `docs/architecture.md`.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| `docs/architecture.md` | Stack, estrutura de pastas, camadas, fronteiras de segurança. |
| `docs/database.md` | Bancos, migrations, comandos, verificação. |
| `docs/authentication.md` | Better Auth, RBAC, bootstrap do owner. |
| `docs/dashboard-and-cruds.md` | Páginas, services, regras financeiras, RBAC por recurso. |
| `docs/jobs.md` | Fila de jobs: estados, garantias, worker. |
| `docs/import-export.md` | Importação/exportação CSV, limites, segurança. |
| `docs/observability.md` | Logs, correlation id, health/readiness/metrics. |
| `docs/operations.md` | Runbook: comandos, troubleshooting. |
| `docs/production-readiness.md` | Ambiente, migrations, segurança, checklist de deploy/rollback. |
| `docs/deployment.md` | Deploy real: PM2, Nginx, domínio, HTTPS. |
| `docs/rollback.md` | Procedimento de rollback de código, migration e infraestrutura. |
| `docs/runbook.md` | Operação diária: start/stop/restart, verificação de saúde. |
| `docs/backup-restore.md` | Backup lógico, checksum, restore validado. |
| `docs/incident-response.md` | Resposta a incidentes: fila parada, banco indisponível, deploy com falha. |

`CONTINUAR_AMANHA.md` é o handoff canônico com o estado real mais recente do projeto.

## Ambiente local

```bash
source /home/panza/.nvm/nvm.sh
cd "/home/panza/v0 farmar"
corepack pnpm@9.15.9 install --frozen-lockfile
corepack pnpm@9.15.9 dev
```

Requer `.env.local` preenchido (ver `.env.example`). Nunca versionar `.env.local`.

## Comandos principais

```bash
corepack pnpm@9.15.9 typecheck
corepack pnpm@9.15.9 lint
corepack pnpm@9.15.9 test              # unitários
corepack pnpm@9.15.9 test:integration  # somente criarov0_test
corepack pnpm@9.15.9 test:e2e          # Playwright
corepack pnpm@9.15.9 build
corepack pnpm@9.15.9 db:check
corepack pnpm@9.15.9 worker            # worker da fila
corepack pnpm@9.15.9 db:backup         # backup manual do banco principal
corepack pnpm@9.15.9 ops:monitor       # execução manual do monitor operacional
```

## Produção

Servido via PM2 (`v0-farmar-web` + `v0-farmar-worker`, porta interna `3200`) atrás de Nginx com
TLS (Let's Encrypt) em `https://v0.panzza.com.br`. `APP_COMMIT` é resolvido automaticamente
(`git rev-parse HEAD`) e exposto em `/api/version` e nos logs de inicialização — nunca hardcoded.
Backup automático diário (systemd timer, `pg_dump` + checksum SHA-256 + retenção) e monitoramento
operacional (systemd timer a cada 5 min: web, worker, readiness, backup, fila, dead-letter, disco)
com notificação interna deduplicada por incidente. Detalhes em `docs/deployment.md`,
`docs/backup-restore.md` e `docs/operations.md`.

## Origem

Repositório inicialmente gerado por [v0](https://v0.app); a partir da Fase 3 o projeto evoluiu para
uma base própria com PostgreSQL, autenticação real, CRUDs conectados ao banco e operação em produção.
