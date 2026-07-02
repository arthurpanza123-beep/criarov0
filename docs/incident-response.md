# Resposta a incidentes

Guia de diagnóstico e ação para os cenários de falha mais prováveis. Todos os comandos assumem
acesso à VPS. Ver também `docs/runbook.md` (operação normal) e `docs/rollback.md` (reversão).

## 1. Readiness reporta `degraded` (HTTP 503)

```bash
curl -s https://v0.panzza.com.br/api/health/ready
```

- Se `checks.database != "ok"`: ver seção 2 (banco indisponível).
- Se `checks.queue != "ok"`: ver seção 3 (fila com problema).

## 2. Banco de dados indisponível

Sintomas: `/api/health/database` falha, `/api/health/ready` reporta `database: "error"`, páginas do
painel retornam erro genérico (sem stack trace).

```bash
sudo pg_lsclusters                                    # cluster 17 deve estar "online" na porta 5433
sudo systemctl status postgresql
sudo -u postgres psql -p 5433 -d criarov0 -c "select 1;"
pm2 logs v0-farmar-web --lines 100 | grep -i error
```

- Se o cluster PostgreSQL 17 está fora: **não reiniciar o serviço sem avaliar impacto** — o cluster é
  compartilhado com outros projetos do host (cluster 16 também roda nele). Escalar antes de agir.
- Se o cluster está online mas a aplicação não conecta: verificar `DATABASE_URL` em `.env.local`
  (existência das chaves, não o valor) e se a role `criarov0_app` ainda existe/tem permissão.
- Nunca usar `DROP`/`TRUNCATE` para "resolver" um erro de dados sem entender a causa raiz primeiro.

## 3. Fila parada ou acumulando (`pending` alto, `oldestPendingMs` alto)

```bash
curl -s https://v0.panzza.com.br/api/health/ready   # ver campo queue
pm2 status v0-farmar-worker
pm2 logs v0-farmar-worker --lines 200
```

- Se `v0-farmar-worker` não está `online`: `pm2 restart v0-farmar-worker`.
- Se está `online` mas não processa: checar logs por erro de conexão ao banco ou exceção não
  tratada no handler; usar "Processar fila agora" na UI (`/jobs`) como paliativo imediato enquanto
  investiga.
- Se há muitos jobs em `dead_letter`: abrir `/jobs` filtrando por `dead_letter`, inspecionar
  `/jobs/[id]` para o erro sanitizado, corrigir a causa raiz antes de reprocessar em massa.

## 4. Job travado em `running` (worker crashado no meio da execução)

Mecanismo automático: `claimNextJob` reivindica jobs em `running` cujo `lockedAt` excedeu
`timeout_ms`, desde que `attempts < maxAttempts` (comprovado por teste de integração — stale lock
reclaim). Normalmente não requer intervenção manual; se persistir:

```bash
sudo -u postgres psql -p 5433 -d criarov0 -c "select id, type, status, attempts, max_attempts, locked_at, locked_by from jobs where status='running' order by locked_at;"
```

Se um job estiver preso além do esperado com `attempts >= max_attempts` (não reclamável
automaticamente), tratar como `dead_letter` manual: investigar, depois usar "Reprocessar" na UI.

## 5. Deploy com falha (build ou testes não passam)

- **Não** aplicar o build/commit em produção. Ficar na versão anterior (PM2 continua rodando o
  processo antigo até um `reload`/`restart` explícito).
- Corrigir a causa, rodar `typecheck`, `lint`, `test`, `test:integration`, `build`, `db:check`
  localmente até todos passarem antes de tentar de novo.
- Se uma migration já foi aplicada e o código está incompatível: **não** fazer rollback de schema
  às pressas. Migrations aditivas geralmente não quebram o código anterior; validar antes de agir.

## 6. Nginx com erro de configuração

```bash
sudo nginx -t
```

- Se inválido: **não** recarregar. Corrigir o arquivo específico (`v0.panzza.com.br`), rodar
  `nginx -t` novamente até válido, só então `systemctl reload nginx`.
- Nunca `systemctl restart nginx` (interrompe todos os sites do host brevemente); `reload` é
  suficiente e não tem downtime perceptível para os outros domínios.

## 7. Certificado TLS expirando/expirado

```bash
sudo certbot certificates | grep -A4 v0.panzza.com.br
sudo certbot renew --dry-run
```

Renovação é automática via Certbot; se falhar, renovar manualmente:

```bash
sudo certbot renew --cert-name v0.panzza.com.br
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Suspeita de segredo exposto (log, commit, resposta de API)

- Não imprimir o valor do segredo em nenhuma ferramenta/relatório; referenciar só pelo nome da
  variável.
- Se vazou em log: os logs são sanitizados por padrão (`sanitizeLogValue`); se algo escapou disso,
  é um bug — reportar e corrigir a sanitização antes de reabrir o serviço publicamente, se o vazamento
  for severo.
- Se vazou em commit: **não** fazer `git push --force` sem alinhar com o time; girar
  (rotate) o segredo imediatamente (`BETTER_AUTH_SECRET`, senha do banco, etc.) independentemente do
  que for feito no histórico do Git.

## Critério geral de "produção segura"

Produção é considerada segura quando: `pm2 status` mostra os dois processos `online` com restarts
estáveis, `/api/health/ready` retorna `200`/`ready`, `nginx -t` é válido, o certificado TLS não está
expirado, e não há erros repetidos nos logs das últimas execuções.
