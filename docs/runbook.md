# Runbook operacional

Referência rápida do dia a dia. Para o procedimento completo de deploy, ver `docs/deployment.md`;
para incidentes, ver `docs/incident-response.md`; para rollback, `docs/rollback.md`; para
backup/restore, `docs/backup-restore.md`.

## Verificação de saúde (uso diário)

```bash
curl -s https://v0.panzza.com.br/api/health
curl -s https://v0.panzza.com.br/api/health/ready
curl -s https://v0.panzza.com.br/api/health/database
curl -s https://v0.panzza.com.br/api/version
pm2 status v0-farmar-web v0-farmar-worker
```

Leitura esperada de `/api/health/ready`:

```json
{"status":"ready","checks":{"database":"ok","queue":"ok"},"queue":{"pending":0,"running":0,"deadLetter":0,"oldestPendingMs":0},"timestamp":"..."}
```

`status: "degraded"` (HTTP 503) indica banco ou fila inacessível — ver `docs/incident-response.md`.

## Start / stop / restart

```bash
pm2 start ecosystem.config.cjs        # primeira subida (idempotente: ignora se já rodando)
pm2 stop v0-farmar-web                # parar só o web
pm2 stop v0-farmar-worker             # parar só o worker
pm2 restart v0-farmar-web             # reinício completo (downtime breve)
pm2 reload v0-farmar-web              # reinício sem downtime (após build)
pm2 delete v0-farmar-web v0-farmar-worker  # remove a definição (só quando necessário)
```

Nunca `pm2 kill` — mata o daemon inteiro, afetando **todos** os outros projetos rodando sob o mesmo
usuário PM2 no host.

## Logs

```bash
pm2 logs v0-farmar-web --lines 200
pm2 logs v0-farmar-worker --lines 200
tail -f "/home/panza/v0 farmar/logs/web-error.log"
tail -f "/home/panza/v0 farmar/logs/worker-error.log"
sudo tail -f /var/log/nginx/v0.panzza.com.br.access.log
sudo tail -f /var/log/nginx/v0.panzza.com.br.error.log
```

Logs da aplicação são JSON estruturado, sanitizados (sem segredos, tokens, `DATABASE_URL`, cookies).

## Operações comuns da fila

- **Ver estado da fila**: página `/sistema` (RBAC `system:read`, owner/admin) ou
  `GET /api/metrics` (autenticado).
- **Reconciliar uma conta**: `/jobs` → "Reconciliar conta" ou botão em `/contas`.
- **Drenar manualmente**: `/jobs` → "Processar fila agora" (útil se o worker estiver parado
  temporariamente).
- **Job em `dead_letter`**: abrir `/jobs/[id]`, ler o erro sanitizado e o histórico de execuções,
  corrigir a causa raiz, depois "Reprocessar" (reinicia com `attempts = 0`).
- **Manutenção/retenção**: `/jobs` → "Manutenção" (poda `job_runs` e jobs terminais antigos; nunca
  toca em dead-letter nem em dados de negócio).

## Importação / exportação / relatórios

- **Importar**: `/importacoes` — sempre `dry-run` primeiro, revisar o relatório, depois `commit`.
- **Exportar**: `/exportacoes` — CSV autorizado por entidade e por permissão de leitura.
- **Relatórios/simulador**: `/relatorios` — capacidade, saldo, receita, lucro, margem, cenários.

## Backup e monitoramento (systemd timers)

```bash
systemctl status v0-farmar-backup.timer v0-farmar-monitor.timer
systemctl list-timers v0-farmar-backup.timer v0-farmar-monitor.timer
journalctl -u v0-farmar-backup.service -n 50
journalctl -u v0-farmar-monitor.service -n 50
corepack pnpm@9.15.9 db:backup     # execução manual do backup
corepack pnpm@9.15.9 ops:monitor   # execução manual do monitor
```

A página `/sistema` mostra o status do último backup, idade, disco, heartbeat do worker, fila e
dead-letter em um só lugar. Detalhes completos em `docs/backup-restore.md` e
`docs/incident-response.md`.

## Verificação de banco

```bash
sudo -u postgres psql -p 5433 -d criarov0 -c "\dt public.*"
sudo -u postgres psql -p 5433 -d criarov0 -c "select * from drizzle.__drizzle_migrations order by created_at;"
corepack pnpm@9.15.9 db:check
```

## Checklist de saúde considerada normal

- `pm2 status`: `v0-farmar-web` e `v0-farmar-worker` `online`, `restarts` estável (não crescendo).
- Memória: web ~150–200MB, worker ~80–140MB (variação normal sob carga leve).
- `/api/health/ready`: `200`, `database: ok`, `queue: ok`.
- Logs de erro: sem repetição do mesmo erro em janelas curtas.
- `nginx -t`: sempre válido antes de qualquer reload.
- `v0-farmar-backup.timer`/`v0-farmar-monitor.timer`: `active (waiting)`, próxima execução visível
  em `systemctl list-timers`.
- `/sistema`: backup com idade menor que ~26h e status `ok`; worker com heartbeat recente; sem
  jobs presos ou dead-letter acumulado; disco fora da faixa crítica.
