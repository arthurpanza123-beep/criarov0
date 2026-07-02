# Backup e restore

## Procedimento de backup (banco principal)

```bash
TS=$(date +%Y%m%d-%H%M%S)
FNAME="criarov0-$TS.dump"
sudo -u postgres pg_dump -p 5433 -d criarov0 -F c -f "/tmp/$FNAME"
sudo chmod 644 "/tmp/$FNAME"
sudo cp "/tmp/$FNAME" "/home/panza/v0 farmar/backups/$FNAME"
sudo chown panza:panza "/home/panza/v0 farmar/backups/$FNAME"
sudo rm -f "/tmp/$FNAME"
cd "/home/panza/v0 farmar/backups" && sha256sum "$FNAME" > "$FNAME.sha256"
```

Formato `pg_dump -F c` (custom, comprimido, permite restore seletivo com `pg_restore`).
`backups/` não é versionado (ver `.gitignore`) — os dumps ficam apenas no host.

## Checksum

Todo backup deve ter um arquivo `.sha256` correspondente, gerado no momento do dump, para detectar
corrupção antes de um restore.

```bash
sha256sum -c criarov0-<timestamp>.dump.sha256
```

## Evidência real (backup pré-migration 0002)

Executado nesta fase antes de aplicar a migration `0002_organic_kate_bishop.sql` no banco principal:

- Arquivo: `backups/criarov0-pre-migration-0002-20260702-152049.dump`
- Tamanho: `38750` bytes
- SHA-256: `0f614550d7027cf062264f884235b3a762d277ab1c0a21f5e8d324a67902083d`

## Procedimento de restore (validação, nunca sobre o principal)

```bash
sudo -u postgres psql -p 5433 -c "DROP DATABASE IF EXISTS criarov0_restore_check;"
sudo -u postgres psql -p 5433 -c "CREATE DATABASE criarov0_restore_check OWNER criarov0_app;"
sudo cp "backups/<arquivo>.dump" /tmp/
sudo -u postgres pg_restore -p 5433 -d criarov0_restore_check "/tmp/<arquivo>.dump"
sudo -u postgres psql -p 5433 -d criarov0_restore_check -c "\dt public.*"
# comparar contagens-chave com o banco original, por exemplo:
sudo -u postgres psql -p 5433 -d criarov0 -c "select count(*) from public.\"user\";"
sudo -u postgres psql -p 5433 -d criarov0_restore_check -c "select count(*) from public.\"user\";"
# depois de validar, remover o banco temporário:
sudo -u postgres psql -p 5433 -c "DROP DATABASE criarov0_restore_check;"
sudo rm -f "/tmp/<arquivo>.dump"
```

**Nunca restaurar diretamente sobre `criarov0`** (produção). O restore é sempre feito primeiro em um
banco temporário isolado (`criarov0_restore_check` ou nome equivalente) para validação; qualquer
promoção do restore para produção é uma decisão explícita separada, feita apenas se o principal
estiver corrompido/inacessível, com o principal atual preservado até confirmação total.

## Evidência real de validação (restore desta fase)

- Banco temporário usado: `criarov0_restore_check`.
- Resultado: 14 tabelas restauradas (estado do backup, anterior à migration 0002).
- Comparação: `select count(*) from "user"` — original `1`, restaurado `1` (idêntico).
- Banco temporário removido (`DROP DATABASE`) após validação, sem impacto no principal.

## Retenção recomendada

- Backup antes de toda migration aplicada no principal (obrigatório).
- Backup diário adicional recomendado via `cron`/`systemd timer` chamando o script de backup acima,
  com rotação (ex.: manter últimos 14 dias) — **não configurado automaticamente nesta fase**; ver
  pendência em `CONTINUAR_AMANHA.md`.
- Testar o restore periodicamente em banco isolado (mesmo procedimento acima), não apenas confiar no
  arquivo existir.

## O que nunca fazer

- Nunca `pg_restore` direto sobre `criarov0` sem passo de validação em banco isolado antes.
- Nunca mover/apagar um `.dump` sem confirmar que existe outro backup válido mais recente.
- Nunca versionar arquivos `.dump` no Git (ignorado via `.gitignore`).
