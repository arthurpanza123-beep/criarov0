# Continuar Amanhã

Handoff canônico. Este documento descreve o **estado real e verificado** do projeto, não intenção
ou trabalho planejado. Datas/evidências correspondem à auditoria e certificação mais recentes.

## Estado atual

O projeto está **em produção real**, publicado em `https://v0.panzza.com.br`, com PostgreSQL,
autenticação, RBAC, dashboard/CRUDs, fila de jobs, worker, importação/exportação, observabilidade,
PM2, Nginx e TLS — todos funcionando e verificados nesta auditoria.

Fases incorporadas na base atual:

- Fase 3: PostgreSQL + Drizzle.
- Fase 4: Better Auth, RBAC, login, sessão.
- Fase 5: dashboard e CRUDs conectados ao PostgreSQL real.
- Fase 6: fila de jobs (idempotência, retry/backoff, timeout, dead-letter, stale lock reclaim,
  cancelamento, graceful shutdown), worker, importação/exportação CSV, simulador/relatórios,
  observabilidade (`/api/health*`, `/api/version`, `/api/metrics`, `/sistema`).
- Correção de segurança: mitigação de CSV/formula injection na exportação (`lib/admin/csv.ts`).
- Certificação de produção: migration aplicada no banco principal, backup com checksum e restore
  validado, testes de stale lock e timeout adicionados, PM2 (web + worker), Nginx, domínio e TLS
  configurados e verificados via smoke test público.

## Branch e commits

- Branch de trabalho: `feat/operations-readiness`.
- Commits anteriores na base: `22726b4` (Fase 3), `e86dc13`/`feat: add secure authentication and
  rbac` (Fase 4), `47656c9`/`feat: connect dashboard and cruds to postgres` (Fase 5).
- Nesta fase, a Fase 6 completa (jobs, worker, import/export, observabilidade) e a correção de CSV
  injection estavam implementadas no working tree mas **não commitadas** ao início desta auditoria.
  Ver o commit final desta fase abaixo (após a certificação) e o relatório entregue nesta sessão
  para o hash exato e a lista de arquivos.

## Banco usado

- Cluster PostgreSQL: 17, porta `5433`.
- Banco principal: `criarov0`.
- Banco de teste: `criarov0_test`.
- Role da aplicação: `criarov0_app`.
- Credenciais somente em `.env.local` (nunca versionado).

## Migrations

- `lib/db/migrations/0000_stiff_firebird.sql`
- `lib/db/migrations/0001_cuddly_ultimo.sql`
- `lib/db/migrations/0002_organic_kate_bishop.sql` (jobs, job_runs, import_batches — aditiva)

**Estado real confirmado**: ambos os bancos (`criarov0` e `criarov0_test`) têm 17 tabelas públicas e
3/3 migrations aplicadas. `criarov0` tem 168 constraints e 54 índices em `public`.

## Backup mais recente com checksum

- Arquivo: `backups/criarov0-pre-migration-0002-20260702-152049.dump` (não versionado no Git).
- Tamanho: 38750 bytes.
- SHA-256: `0f614550d7027cf062264f884235b3a762d277ab1c0a21f5e8d324a67902083d`.
- Restore validado em banco temporário `criarov0_restore_check` (14 tabelas — estado pré-migration
  0002 —, contagem de `user` idêntica ao original), depois removido.
- Procedimento completo em `docs/backup-restore.md`.

## Fila e worker

- Tabelas `jobs`/`job_runs`, serviço `lib/services/jobs-service.ts`, worker `lib/jobs/worker.ts`.
- Garantias comprovadas por teste (`tests/integration/operations.test.ts`): idempotência,
  concorrência (`FOR UPDATE SKIP LOCKED`), retry com backoff exponencial, dead-letter, **stale lock
  reclaim** (2 testes novos), **timeout real de execução** (1 teste novo), cancelamento seguro,
  graceful shutdown (`SIGTERM`/`SIGINT`, no código).
- Detalhes em `docs/jobs.md`.

## Importação/exportação

- Dry-run, commit transacional, dedup, rollback em falha — comprovados por teste.
- **CSV/formula injection mitigada** nesta fase: `neutralizeFormula` em `lib/admin/csv.ts` prefixa
  apóstrofo em campos iniciados com `=`, `+`, `-`, `@`, tab ou CR, com teste unitário cobrindo o
  caso. Antes desta correção, a exportação estava vulnerável a formula injection ao abrir em
  planilhas.
- Detalhes em `docs/import-export.md`.

## Observabilidade

- `/api/health`, `/api/health/database`, `/api/health/ready`, `/api/version`, `/api/metrics`,
  página `/sistema`.
- Logs JSON estruturados, sanitizados (segredos/tokens/connection strings redigidos, comprovado por
  teste).
- Readiness testada e verificada em produção: `200`, `database: ok`, `queue: ok`.

## Infraestrutura de produção

- **PM2**: `v0-farmar-web` (porta interna `3200`) e `v0-farmar-worker`, ambos `online`, sob o
  daemon PM2 já existente do usuário `panza` (compartilhado com outros ~15 processos de outros
  projetos — nenhum foi afetado). Definição em `ecosystem.config.cjs`.
- **Nginx**: site `v0.panzza.com.br` em `/etc/nginx/sites-available`, proxy para
  `127.0.0.1:3200`. `nginx -t` válido globalmente.
- **Domínio**: `v0.panzza.com.br`, DNS já apontado para o IP público da VPS antes desta fase.
- **TLS**: certificado Let's Encrypt via Certbot, válido até 2026-09-30, renovação automática
  configurada. HSTS ativo.
- Detalhes completos em `docs/deployment.md`.

## Testes (última execução completa)

```text
typecheck        0 erros
lint              0 avisos
test (unit)      55 passed (6 arquivos) — inclui teste de neutralização de CSV injection
test:integration 58 passed (4 arquivos) — inclui stale lock reclaim (2) e timeout real (1)
build            ok (16 rotas)
db:check         ok
test:e2e         3 passed (Playwright)
```

Todos usam exclusivamente `criarov0_test` para integração/E2E (guarda destrutiva no código impede
uso acidental do banco principal).

## Smoke test de produção (última execução)

Via `https://v0.panzza.com.br`: `/api/health` 200, `/api/health/ready` 200 (`ready`, banco e fila
ok), `/api/health/database` 200, `/api/version` 200, `/login` 200, `/` 307 (dashboard protegido,
correto), `/api/metrics` 307 (protegido sem sessão, correto), headers de segurança presentes
(`X-Frame-Options`, `X-Content-Type-Options`, CSP, HSTS).

## Pendências reais (não bloqueiam produção atual)

- Backup automático agendado (cron/systemd timer) **não configurado** — hoje o backup é manual
  (procedimento em `docs/backup-restore.md`). Recomendado antes da próxima migration.
- `APP_COMMIT`/`GIT_COMMIT` não definidos no ambiente de produção (`/api/version` mostra
  `commit: "unknown"`); definir no processo de deploy para rastreabilidade.
- Feedback inline de erros por formulário ainda não implementado (Server Actions com progressive
  enhancement).
- Sem agendamento cron embutido para reconciliação/relatórios (jobs podem ser agendados via `run_at`
  futuro, mas não há daemon de cron).
- Recuperação de senha por e-mail e login social não implementados (fora do escopo atual).

## Próximo passo exato

1. Revisar o diff final (código + docs) antes do commit.
2. Comitar Fase 6 + correção de CSV injection + documentação desta fase, seguindo o padrão de
   mensagens de commit do projeto.
3. Decidir sobre publicar a branch/merge para `main` no remoto (ver relatório final para o estado
   exato de autenticação do remoto no momento da auditoria).
4. Configurar backup automático agendado (pendência listada acima).
