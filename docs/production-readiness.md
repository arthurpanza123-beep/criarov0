# Prontidão para produção

Preparação e publicação real. Estado atual: **publicado** em `https://v0.panzza.com.br`, servido
por PM2 (`v0-farmar-web` + `v0-farmar-worker`) atrás de Nginx com TLS (Let's Encrypt). Detalhes
operacionais completos em `docs/deployment.md`, `docs/rollback.md`, `docs/runbook.md`,
`docs/backup-restore.md` e `docs/incident-response.md`.

## Configuração de ambiente

`.env.local` (nunca versionado). Chaves usadas:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão do app com `criarov0`. |
| `TEST_DATABASE_URL` | `criarov0_test` (testes/integração/E2E). |
| `BETTER_AUTH_SECRET` | Segredo do Better Auth. |
| `BETTER_AUTH_URL` / `APP_URL` | Origem confiável / base URL. |
| `INITIAL_OWNER_*` | Bootstrap do owner (remover após 1º acesso). |
| `APP_COMMIT` | Commit exibido em `/api/version`. Resolvido automaticamente via `git rev-parse
  HEAD` em `ecosystem.config.cjs` — **nunca precisa ser definido manualmente** em produção; a
  variável só é um fallback caso o `.git` não esteja disponível. |
| `LOG_LEVEL` | Nível mínimo de log (`debug|info|warn|error`, padrão `info`). |
| `WORKER_POLL_INTERVAL_MS` | Intervalo de polling do worker (padrão 2000). |
| `BACKUP_DIR` / `BACKUP_RETENTION_*` / `PG_BIN_DIR` | Configuração do backup automático (ver
  `docs/backup-restore.md`), todas com defaults sensatos. |
| `MONITOR_WEB_URL` | URL usada pelo monitor para checar o processo web (padrão
  `http://127.0.0.1:3200/api/health`). |

`.env.example` documenta as chaves sem valores reais.

## Migrations

- Geração: `db:generate` (a partir do schema). Migrations versionadas em `lib/db/migrations`.
- Aplicação **sempre** em `criarov0_test` primeiro → rodar toda a suíte → depois `criarov0`.
- Nunca usar `drizzle-kit push`. Nunca `DROP` destrutivo. Migrations são aditivas.
- Verificação de consistência: `db:check`.

## Seed / bootstrap

- `db:seed` — settings não sensíveis, idempotente.
- `auth:bootstrap-owner` — cria owner idempotente (senha nunca impressa).

## Worker / execução

- `pnpm worker` (`node --conditions=react-server --import tsx scripts/worker.ts`).
- **Graceful shutdown**: `SIGTERM`/`SIGINT` param a reivindicação, terminam o job atual e fecham o
  pool antes de sair.
- **Recuperação após restart**: jobs `pending`/`scheduled` persistem; `running` órfãos são
  reclamados após `timeout_ms`. Idempotência evita duplicação.

## Limites de conexão

Um único pool por processo (`max: 5`). Com web + worker = ~10 conexões. Dimensionar
`max_connections` do PostgreSQL considerando os demais projetos do cluster compartilhado.

## Política de logs

JSON estruturado em stdout/stderr, com sanitização de dados sensíveis. Encaminhar para o coletor de
logs do host (journald/arquivo) no deploy. Nunca logar segredos, tokens, cookies, senhas ou
`DATABASE_URL`.

## Política de retenção

O job `maintenance` remove `job_runs` e jobs terminais (`completed`/`cancelled`) além de N dias
(padrão 30). Dead-letter é preservado para auditoria. Activities e ledger não são podados
automaticamente.

## Backup e restore

Procedimento completo, com checksum e validação de restore, em `docs/backup-restore.md`.

## Segurança

- Headers de segurança (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, CSP `frame-ancestors 'none'`), `poweredByHeader: false` em `next.config.mjs`.
  HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains`) é aplicado no Nginx
  (`/etc/nginx/sites-available/v0.panzza.com.br`), junto com TLS via Let's Encrypt/Certbot.
- Toda mutation valida sessão + permissão (RBAC) + Zod no servidor; operações sensíveis são
  transacionais e auditadas; erros retornam sem stack trace.
- Rate limiting do Better Auth em login/troca de senha/criação de usuário.
- Cache-Control `no-store`/`private` nas rotas de API sensíveis.
- Exportação CSV neutraliza formula injection (campos iniciados com `=`, `+`, `-`, `@`, tab ou CR
  recebem prefixo de apóstrofo antes de abrir em planilhas).

## Checklist de deploy

1. `git pull` na branch de release; confirmar `.env.local` (segredos).
2. `corepack pnpm@9.15.9 install --frozen-lockfile`.
3. Backup do banco principal com checksum (`docs/backup-restore.md`) antes de qualquer migration.
4. Aplicar migrations em `criarov0_test`, rodar suíte completa (`typecheck`, `lint`, `test`,
   `test:integration`, `test:e2e`), depois `criarov0` (`db:migrate`).
5. `corepack pnpm@9.15.9 build`.
6. `db:check` limpo.
7. `pm2 delete v0-farmar-web v0-farmar-worker && pm2 start ecosystem.config.cjs` (garante que
   `APP_COMMIT` seja recalculado; `pm2 reload` isolado não relê a config).
8. `pm2 save`.
9. Verificar `/api/health`, `/api/health/ready`, `/api/version` via `https://v0.panzza.com.br` —
   comparar `git rev-parse HEAD` com o campo `commit` do `/api/version`.
10. Rodar `corepack pnpm@9.15.9 ops:monitor` manualmente e confirmar `severity: "ok"`.
11. Confirmar owner e troca de senha inicial; remover `INITIAL_OWNER_*` do ambiente após confirmação.
12. Procedimento completo (incluindo Nginx/TLS) em `docs/deployment.md`.

## Checklist de rollback

Procedimento completo em `docs/rollback.md`. Resumo:

1. Manter o dump lógico anterior e o commit anterior à mão.
2. Reverter o código para o commit anterior e `build`.
3. Migrations são aditivas: geralmente **não** exigem downgrade. Se uma migration precisar ser
   revertida, criar uma nova migration compensatória versionada (nunca `DROP` manual em produção).
4. `pm2 restart v0-farmar-web v0-farmar-worker`. Validar health checks.
5. Se necessário, restaurar o dump em banco isolado e validar antes de qualquer troca no principal.

## Feedback de formulário e monitoramento

- Formulários prioritários (login, alterar-senha, usuários, contas, campanhas, indicações,
  clientes, pedidos, créditos, importações, jobs, configurações) têm feedback inline: erro geral,
  erro por campo, estado de carregamento, foco automático no primeiro campo inválido, toast de
  sucesso/erro e limpeza de campos sensíveis (senha) após falha. Implementação em
  `components/admin/action-form.tsx`, `components/admin/form-feedback.tsx`,
  `lib/admin/form-state.ts`.
- Monitoramento operacional automático (`v0-farmar-monitor.timer`, a cada 5 min): web, worker
  (heartbeat), readiness, backup, fila, dead-letter, jobs presos, disco. Notificação interna criada
  apenas em transição de estado. Detalhes em `docs/incident-response.md`.

## Limitações reais

- Reconciliação e relatórios são sob demanda (sem agendamento cron embutido; pode-se enfileirar via
  `run_at` futuro).
- Importação assíncrona carrega o CSV no payload do job (adequado a volumes dentro dos limites).
- Sem CDN/WAF externo; TLS e headers de segurança aplicados diretamente no Nginx da VPS.
- Backup automatizado é diário (não incremental/contínuo); RPO máximo de ~24h em caso de perda
  total do volume de dados entre execuções.
- Sem recuperação de senha por e-mail nem login social (fora do escopo desta fase).
