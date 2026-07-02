# Operações (runbook)

Runbook operacional do painel. Assume PostgreSQL 17 na porta 5433, bancos `criarov0` (principal) e
`criarov0_test` (testes). Credenciais só em `.env.local` (nunca versionar/imprimir).

## Processos

- **Web app**: PM2 `v0-farmar-web` (`node_modules/next/dist/bin/next start -p 3200`), porta interna
  `3200`, exposta publicamente via Nginx em `https://v0.panzza.com.br`.
- **Worker da fila**: PM2 `v0-farmar-worker` (`node --conditions=react-server --import tsx
  scripts/worker.ts`) — processa jobs (backoff, timeout, dead-letter), com graceful shutdown em
  `SIGTERM`/`SIGINT`. Uma instância é suficiente; múltiplas instâncias são seguras (lock concorrente
  via `FOR UPDATE SKIP LOCKED`).

Ambos definidos em `ecosystem.config.cjs` na raiz do projeto, rodando sob o daemon PM2 do usuário
`panza` (compartilhado com outros projetos do host; nunca reiniciar o daemon inteiro).

```bash
pm2 status v0-farmar-web v0-farmar-worker
pm2 logs v0-farmar-web --lines 100
pm2 logs v0-farmar-worker --lines 100
pm2 reload v0-farmar-web       # reload sem downtime (após novo build)
pm2 restart v0-farmar-worker   # restart do worker
```

> Sem worker rodando, jobs ficam `pending`. A UI oferece "Processar fila agora" (owner/admin) para
> drenar sob demanda.

## Comandos

```bash
source /home/panza/.nvm/nvm.sh
corepack pnpm@9.15.9 typecheck
corepack pnpm@9.15.9 lint
corepack pnpm@9.15.9 test
corepack pnpm@9.15.9 test:integration   # somente criarov0_test
corepack pnpm@9.15.9 test:e2e            # Playwright, somente criarov0_test
corepack pnpm@9.15.9 build
corepack pnpm@9.15.9 db:check
corepack pnpm@9.15.9 db:generate         # gera migration a partir do schema
corepack pnpm@9.15.9 db:migrate          # aplica migrations (usa DRIZZLE_DATABASE_URL ?? DATABASE_URL)
corepack pnpm@9.15.9 db:seed             # settings não sensíveis, idempotente
corepack pnpm@9.15.9 auth:bootstrap-owner
corepack pnpm@9.15.9 worker
```

## Health checks

- `GET /api/health` — liveness.
- `GET /api/health/database` — conectividade do banco.
- `GET /api/health/ready` — readiness (banco + fila), 200/503.
- `GET /api/version` — versão/commit.
- `GET /api/metrics` — métricas da fila (owner/admin).
- Página `/sistema` — saúde consolidada (owner/admin).

## Operações comuns

- **Reconciliar uma conta**: `/jobs` → "Reconciliar conta" (enfileira `reconcile_account`) ou o
  botão de reconciliação em `/contas`. Divergências geram relatório (activity) + notificação; nunca
  há autocorreção no banco principal.
- **Manutenção da fila**: `/jobs` → "Manutenção" (poda `job_runs` e jobs terminais antigos).
- **Importar**: `/importacoes` — dry-run primeiro, depois commit.
- **Exportar**: `/exportacoes` — CSV autorizado por entidade.
- **Relatórios/simulador**: `/relatorios` — capacidade, saldo, receita, lucro, margem, cenários.

## Troubleshooting

- **Jobs presos em `pending`**: verifique se o worker está rodando (`pnpm worker`). Sem worker, use
  "Processar fila agora".
- **Jobs em `running` que não terminam**: são reclamados automaticamente após `timeout_ms`.
- **`dead_letter`**: inspecione `/jobs/[id]` (erro sanitizado + histórico), corrija a causa e use
  "Reprocessar" (reinicia com `attempts=0`).
- **Readiness 503**: cheque banco (`/api/health/database`) e a fila (dead-letter alto / pendente
  antigo em `/sistema`).
- **Divergência de saldo**: rode reconciliação; o relatório mostra persistido vs calculado. Ajustes
  são manuais via ledger (lançamento `adjustment`), nunca automáticos.

## Conexões com o banco

O app reutiliza um único pool (`max: 5`) por processo (web e worker), evitando esgotar o cluster
compartilhado. Não crie clientes por request.

## Regras de segurança operacional

- Nunca use `pkill -f` (mata processos de outros projetos na VPS). Encerre apenas o PID específico
  ou use `pm2 restart/reload <nome>` pelo nome exato do processo.
- Não reinicie PostgreSQL, Nginx, Redis ou serviços de outros projetos. Para Nginx, use
  `nginx -t` seguido de `systemctl reload nginx` (reload, nunca `restart`), o que não afeta sites
  já ativos.
- Testes que modificam dados usam exclusivamente `criarov0_test` (guarda explícita).

## Domínio e HTTPS

- Domínio público: `https://v0.panzza.com.br` (DNS já apontado para a VPS).
- Nginx: `/etc/nginx/sites-available/v0.panzza.com.br` (proxy para `127.0.0.1:3200`).
- TLS: certificado Let's Encrypt via Certbot, renovação automática (`certbot renew` agendado pelo
  sistema). Validade e detalhes em `docs/deployment.md`.
- HSTS ativo (`Strict-Transport-Security: max-age=63072000; includeSubDomains`).
