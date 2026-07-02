# Rollback

Procedimentos de reversão para código, migration e infraestrutura. Todos assumem acesso à VPS e
aos bancos `criarov0` (principal) / `criarov0_test` (testes) em PostgreSQL 17, porta `5433`.

## Princípios

- Migrations no schema são **aditivas** (somente `CREATE TYPE`/`CREATE TABLE`/`ADD CONSTRAINT`/
  `CREATE INDEX`). Reverter uma migration aditiva quase nunca é necessário: o código antigo
  simplesmente ignora colunas/tabelas novas.
- Nunca `DROP TABLE`, `DROP COLUMN` ou `DROP SCHEMA` manual em produção. Se uma migration precisar
  ser desfeita, criar uma **nova migration compensatória** versionada e testá-la primeiro em
  `criarov0_test`.
- Sempre ter um backup com checksum do banco principal antes de qualquer migration (ver
  `docs/backup-restore.md`).

## Rollback de código (sem mudança de schema)

```bash
source /home/panza/.nvm/nvm.sh
cd "/home/panza/v0 farmar"
git log --oneline -10                      # identificar o commit anterior estável
git checkout <commit-anterior-ou-branch>   # ou git revert do commit problemático
corepack pnpm@9.15.9 install --frozen-lockfile
corepack pnpm@9.15.9 build
pm2 reload v0-farmar-web
pm2 restart v0-farmar-worker
curl -s https://v0.panzza.com.br/api/health/ready
```

Se o rollback for de um commit já mesclado em `main` publicado, preferir `git revert` (mantém
histórico, não reescreve commits publicados) a `git reset`.

## Rollback de migration

1. **Não** executar `DROP` direto no banco principal.
2. Escrever uma migration nova que reverta o efeito de forma controlada (ex.: uma migration que
   torna uma coluna nova opcional novamente, ou remove uma constraint adicionada por engano).
3. Gerar com `corepack pnpm@9.15.9 db:generate`, revisar o SQL manualmente.
4. Aplicar em `criarov0_test`:
   ```bash
   set -a; source .env.local; set +a
   DRIZZLE_DATABASE_URL="$TEST_DATABASE_URL" corepack pnpm@9.15.9 db:migrate
   corepack pnpm@9.15.9 test:integration
   ```
5. Fazer backup do principal com checksum (`docs/backup-restore.md`).
6. Aplicar no principal: `corepack pnpm@9.15.9 db:migrate`.
7. `corepack pnpm@9.15.9 db:check` deve retornar limpo.

Se a migration já tiver corrompido dados no principal (cenário raro, pois migrations são aditivas),
restaurar o backup pré-migration em um banco **isolado** (`criarov0_restore_check` ou similar),
validar os dados, e só então decidir o próximo passo — nunca restaurar diretamente sobre o `criarov0`
em produção sem esse passo intermediário de validação.

## Rollback de infraestrutura (PM2 / Nginx)

### PM2

```bash
pm2 restart v0-farmar-web v0-farmar-worker   # após rollback de código/build
pm2 logs v0-farmar-web --lines 50            # confirmar 0 erros pós-restart
```

Nunca `pm2 delete` os processos como parte de um rollback rotineiro — isso remove a definição do
daemon. Prefira `restart`/`reload`. `pm2 delete` só é apropriado se o `ecosystem.config.cjs` mudou
de forma incompatível (nome do processo, script) e precisa ser reaplicado do zero:

```bash
pm2 delete v0-farmar-web v0-farmar-worker
pm2 start ecosystem.config.cjs
```

### Nginx

Cada alteração no arquivo de site é precedida por uma cópia local. Para reverter:

```bash
sudo cp /etc/nginx/sites-available/v0.panzza.com.br /etc/nginx/sites-available/v0.panzza.com.br.bak-$(date +%Y%m%d-%H%M%S)
# restaurar versão anterior conhecida, depois:
sudo nginx -t
sudo systemctl reload nginx   # nunca "restart" (afeta outros sites do mesmo Nginx)
```

Se o certificado TLS precisar ser revogado/reemitido, usar `certbot` (nunca editar os arquivos em
`/etc/letsencrypt/live/` manualmente).

## Critério de sucesso do rollback

- `pm2 status v0-farmar-web v0-farmar-worker` mostra `online`, `restarts` não crescendo
  indefinidamente.
- `curl https://v0.panzza.com.br/api/health/ready` retorna `200` com `status: "ready"`.
- `corepack pnpm@9.15.9 db:check` limpo.
- Nenhum outro projeto do host afetado (checar `pm2 status` completo e `nginx -t`).
