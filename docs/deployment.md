# Deploy (estado real)

## Visão geral

| Camada | Solução | Estado |
| --- | --- | --- |
| Processo web | PM2 `v0-farmar-web` | online, porta interna `3200` |
| Processo worker | PM2 `v0-farmar-worker` | online, drena a fila continuamente |
| Reverse proxy | Nginx `v0.panzza.com.br` | ativo, `nginx -t` válido |
| TLS | Let's Encrypt via Certbot | válido, expira 2026-09-30, renovação automática |
| Domínio | `v0.panzza.com.br` | DNS já resolvendo para a VPS |
| Banco | PostgreSQL 17, porta `5433`, `criarov0` | 17 tabelas, 3/3 migrations |

## PM2

Definição em `ecosystem.config.cjs` na raiz do projeto. `APP_COMMIT` é resolvido dinamicamente via
`git rev-parse HEAD` no momento em que o PM2 carrega a config (nunca hardcoded, nunca editado à
mão) e injetado como variável de ambiente para os dois processos:

```js
// PM2 process definitions for v0-farm-console (web + queue worker).
const { execSync } = require("node:child_process")

function resolveAppCommit() {
  try {
    return execSync("git rev-parse HEAD", { cwd: __dirname, encoding: "utf-8" }).trim()
  } catch {
    return process.env.APP_COMMIT || "unknown"
  }
}

const APP_COMMIT = resolveAppCommit()

module.exports = {
  apps: [
    {
      name: "v0-farmar-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3200",
      interpreter: "/home/panza/.nvm/versions/node/v24.18.0/bin/node",
      env: { APP_COMMIT },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      out_file: "./logs/web-out.log",
      error_file: "./logs/web-error.log",
      time: true,
    },
    {
      name: "v0-farmar-worker",
      cwd: __dirname,
      script: "scripts/worker.ts",
      interpreter: "/home/panza/.nvm/versions/node/v24.18.0/bin/node",
      interpreter_args: "--conditions=react-server --import tsx",
      env: { APP_COMMIT },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      out_file: "./logs/worker-out.log",
      error_file: "./logs/worker-error.log",
      time: true,
    },
  ],
}
```

Efeito prático: sempre que o PM2 é reiniciado com a config atualizada (`pm2 delete` + `pm2 start
ecosystem.config.cjs`, ou `pm2 restart` de cada processo), `APP_COMMIT` reflete exatamente o commit
que está no checkout — validável comparando `git rev-parse HEAD` com
`curl -s https://v0.panzza.com.br/api/version`. `instrumentation.ts` (hook oficial do Next.js) e o
worker (`lib/jobs/worker.ts`) logam versão/commit na inicialização.

> `pm2 reload` **não** relê variáveis de ambiente de uma config alterada em todos os casos; o
> caminho garantido após atualizar `ecosystem.config.cjs` é `pm2 delete v0-farmar-web
> v0-farmar-worker && pm2 start ecosystem.config.cjs`.

Os dois processos rodam sob o **mesmo daemon PM2** já existente do usuário `panza`, junto com outros
~15 processos de outros projetos no mesmo host. Comandos:

```bash
pm2 start ecosystem.config.cjs   # primeira subida
pm2 status v0-farmar-web v0-farmar-worker
pm2 logs v0-farmar-web --lines 100
pm2 logs v0-farmar-worker --lines 100
pm2 reload v0-farmar-web         # reload sem downtime (após novo build, sem mudar env)
pm2 restart v0-farmar-worker
pm2 save                          # persiste a lista de processos para reboot do host
```

`ecosystem.config.cjs`, `logs/` e `backups/` **não são versionados** (ver `.gitignore`).

## Porta

`3200` (interna, `127.0.0.1`, nunca exposta diretamente). Escolhida por estar livre no host (todas
as portas em uso por outros projetos foram verificadas antes: `3000`, `3010`, `3020`, `3021`,
`3101–3108`, `3210`, `3310`).

## Nginx

Arquivo: `/etc/nginx/sites-available/v0.panzza.com.br` (symlink em `sites-enabled`).

```nginx
server {
    server_name v0.panzza.com.br;
    client_max_body_size 20m;
    access_log /var/log/nginx/v0.panzza.com.br.access.log;
    error_log /var/log/nginx/v0.panzza.com.br.error.log;

    location = /api/health {
        proxy_pass http://127.0.0.1:3200/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/v0.panzza.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/v0.panzza.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
}
server {
    if ($host = v0.panzza.com.br) { return 301 https://$host$request_uri; }
    listen 80;
    listen [::]:80;
    server_name v0.panzza.com.br;
    return 404;
}
```

Sempre validar antes de recarregar, e usar `reload` (nunca `restart`) para não afetar outros sites
já ativos no mesmo Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## TLS / domínio

- DNS de `v0.panzza.com.br` já apontava para o IP público da VPS antes desta fase.
- Certificado emitido com `certbot --nginx -d v0.panzza.com.br`, válido até 2026-09-30, renovação
  automática já agendada pelo Certbot (timer/cron do sistema).
- HSTS adicionado manualmente no bloco `server` HTTPS (`Strict-Transport-Security`).

## Backup e monitoramento automáticos

Dois `systemd timers` independentes, isolados de qualquer outro serviço do host:

- `v0-farmar-backup.timer` → `v0-farmar-backup.service`: diário às 03:15 UTC, roda
  `scripts/backup-database.ts`. Detalhes em `docs/backup-restore.md`.
- `v0-farmar-monitor.timer` → `v0-farmar-monitor.service`: a cada 5 minutos, roda
  `scripts/health-monitor.ts`. Detalhes em `docs/incident-response.md` e `docs/operations.md`.

Arquivos de unidade versionados em `systemd/` (o projeto), instalados manualmente em
`/etc/systemd/system/`:

```bash
sudo cp systemd/v0-farmar-backup.service systemd/v0-farmar-backup.timer /etc/systemd/system/
sudo cp systemd/v0-farmar-monitor.service systemd/v0-farmar-monitor.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now v0-farmar-backup.timer v0-farmar-monitor.timer
```

## Deploy de uma nova versão

```bash
source /home/panza/.nvm/nvm.sh
cd "/home/panza/v0 farmar"
git pull                                  # ou merge da branch de release
corepack pnpm@9.15.9 install --frozen-lockfile
corepack pnpm@9.15.9 typecheck
corepack pnpm@9.15.9 lint
corepack pnpm@9.15.9 test
corepack pnpm@9.15.9 test:integration
corepack pnpm@9.15.9 test:e2e
corepack pnpm@9.15.9 build
corepack pnpm@9.15.9 db:check
# se houver migration nova: aplicar em criarov0_test, rodar suíte, backup do principal, depois:
corepack pnpm@9.15.9 db:migrate
pm2 delete v0-farmar-web v0-farmar-worker && pm2 start ecosystem.config.cjs
pm2 save
curl -s https://v0.panzza.com.br/api/health/ready
git rev-parse HEAD                                          # comparar com:
curl -s https://v0.panzza.com.br/api/version                 # campo "commit" deve ser idêntico
```

## Verificação pós-deploy (smoke)

```bash
curl -s https://v0.panzza.com.br/api/health
curl -s https://v0.panzza.com.br/api/health/ready
curl -s https://v0.panzza.com.br/api/version
curl -s -o /dev/null -w "%{http_code}\n" https://v0.panzza.com.br/login   # esperado 200
curl -s -o /dev/null -w "%{http_code}\n" https://v0.panzza.com.br/        # esperado 307 (protegido)
curl -s -o /dev/null -w "%{http_code}\n" https://v0.panzza.com.br/api/metrics  # esperado 307/401/403
pm2 status v0-farmar-web v0-farmar-worker
```

## Nunca fazer em deploy

- Nunca `pm2 kill` (mata o daemon inteiro, todos os projetos do host).
- Nunca `pkill -f node`/`pkill -f next` (mata processos de outros projetos).
- Nunca `systemctl restart nginx` (usar `reload`).
- Nunca `drizzle-kit push` em produção.
- Nunca aplicar migration no principal sem antes: testar em `criarov0_test`, rodar a suíte, fazer
  backup com checksum do principal.
