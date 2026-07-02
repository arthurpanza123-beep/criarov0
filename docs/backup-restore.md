# Backup e restore

## Estado atual: automático

Backup diário automatizado via `systemd timer` (`v0-farmar-backup.timer`, executa
`v0-farmar-backup.service` às 03:15 UTC + até 5 min de atraso aleatório para evitar contenção com
outros timers do host). Implementação em `scripts/backup-database.ts` + `lib/ops/backup-retention.ts`
(lógica pura de retenção/checksum, testada em `tests/unit/ops.test.ts`).

```bash
systemctl status v0-farmar-backup.timer
systemctl list-timers v0-farmar-backup.timer
journalctl -u v0-farmar-backup.service -n 50
```

## O que o backup faz

1. `pg_dump -F c` (formato custom, comprimido) do banco `criarov0`, usando os binários do
   PostgreSQL 17 (`/usr/lib/postgresql/17/bin`, mesma versão do cluster — evita incompatibilidade
   de formato com o `pg_dump` 16 do PATH padrão do sistema).
2. Escreve em arquivo temporário (`.dump.tmp`) e faz `rename` atômico para o nome final — nunca há
   um dump "pela metade" sob o nome definitivo, mesmo se o processo for interrompido.
3. Define permissão `600` (somente o usuário `panza` lê/escreve) no dump e no `.sha256`.
4. Calcula SHA-256 do arquivo e grava `<arquivo>.dump.sha256`.
5. Verifica integridade com `pg_restore --list` (conta entradas do TOC); um dump corrompido faz o
   script falhar antes de aplicar qualquer retenção.
6. Aplica retenção (ver abaixo) e escreve o status em `backups/last-backup.json` **e** na tabela
   `settings` (chave `ops.lastBackupStatus`), para a página `/sistema` e o monitor lerem.
7. Loga tudo em JSON estruturado (nunca imprime a senha do banco ou a `DATABASE_URL` completa).
8. Exit code `0` em sucesso, `1` em falha — nunca mascara uma falha real.

## Caminho e permissões

- Diretório: `backups/` na raiz do projeto (configurável via `BACKUP_DIR`), fora do Git
  (`.gitignore`), fora de qualquer diretório servido publicamente.
- Diretório criado com permissão `700`; arquivos de dump e checksum com `600`.

## Retenção

Política: **7 diários, 4 semanais, 6 mensais** (configurável via `BACKUP_RETENTION_DAILY`,
`BACKUP_RETENTION_WEEKLY`, `BACKUP_RETENTION_MONTHLY`). Mecanismo (`lib/ops/backup-retention.ts`,
testado em `tests/unit/ops.test.ts`):

1. Mantém os N dumps diários mais recentes (`criarov0-YYYYMMDD-HHMMSS.dump`).
2. Antes de descartar o dump diário mais antigo que excede o limite, promove uma cópia dele (com
   seu próprio checksum) para o nome `criarov0-weekly-...` (até o limite semanal) e
   `criarov0-monthly-...` (até o limite mensal) — nunca perde a única cópia de um período.
3. Remove o excedente de cada um dos três buckets (diário/semanal/mensal), sempre junto com o
   `.sha256` correspondente.
4. Nunca remove nada antes de o novo backup ter sido verificado com sucesso (`pg_restore --list`).

## Comando manual

```bash
source /home/panza/.nvm/nvm.sh
cd "/home/panza/v0 farmar"
corepack pnpm@9.15.9 db:backup
```

Variáveis de ambiente reconhecidas (todas opcionais, com defaults sensatos):

| Variável | Default | Uso |
| --- | --- | --- |
| `BACKUP_DIR` | `./backups` | Diretório de destino dos dumps. |
| `BACKUP_RETENTION_DAILY` | `7` | Nº de backups diários mantidos. |
| `BACKUP_RETENTION_WEEKLY` | `4` | Nº de backups semanais mantidos. |
| `BACKUP_RETENTION_MONTHLY` | `6` | Nº de backups mensais mantidos. |
| `PG_BIN_DIR` | `/usr/lib/postgresql/17/bin` | Diretório dos binários `pg_dump`/`pg_restore`. |

## Verificação periódica de integridade

```bash
cd "/home/panza/v0 farmar/backups"
sha256sum -c <arquivo>.dump.sha256
/usr/lib/postgresql/17/bin/pg_restore --list <arquivo>.dump | head -20
```

O `/sistema` (para quem tem `system:manage`, isto é, owner) mostra o status/idade do último backup
lido diretamente de `settings.ops.lastBackupStatus`.

## Comando de restore (teste em banco temporário)

**Nunca restaurar diretamente sobre `criarov0` (produção).** Sempre validar primeiro em um banco
temporário isolado:

```bash
FNAME="criarov0-<timestamp>.dump"
sudo cp "backups/$FNAME" "/tmp/$FNAME"
sudo chmod 644 "/tmp/$FNAME"

sudo -u postgres psql -p 5433 -c "DROP DATABASE IF EXISTS criarov0_restore_check;"
sudo -u postgres psql -p 5433 -c "CREATE DATABASE criarov0_restore_check OWNER criarov0_app;"
sudo -u postgres /usr/lib/postgresql/17/bin/pg_restore -p 5433 -d criarov0_restore_check "/tmp/$FNAME"

# validar:
sudo -u postgres psql -p 5433 -d criarov0_restore_check -c "\dt public.*"
sudo -u postgres psql -p 5433 -d criarov0 -c "select count(*) from public.\"user\";"
sudo -u postgres psql -p 5433 -d criarov0_restore_check -c "select count(*) from public.\"user\";"

# limpeza obrigatória do banco temporário e do arquivo em /tmp:
sudo -u postgres psql -p 5433 -c "DROP DATABASE criarov0_restore_check;"
sudo rm -f "/tmp/$FNAME"
```

## Evidência real de teste (auditoria de certificação)

- Backup: `criarov0-20260702-163146.dump`, tamanho 49101 bytes.
- SHA-256: `bad7a86dccde938f7e8ee908e814f73fad7364cbc6ec38e5d324aff2fc714676`.
- `pg_restore --list`: 135 entradas de TOC verificadas.
- Restore em `criarov0_restore_check`: 17 tabelas restauradas, contagem de `"user"` (1) e `jobs` (0)
  idênticas ao banco original.
- Banco temporário removido (`DROP DATABASE`) e arquivo em `/tmp` removido após validação.
- Execução manual do `systemd service` (`systemctl start v0-farmar-backup.service`) confirmada com
  `code=exited, status=0/SUCCESS` no `journalctl`.
- Teste de falha proposital (`DATABASE_URL` inválida): exit code `1`, mensagem de erro sanitizada
  (`pg_dump exited with status 1.`), sem credenciais expostas.

## O que nunca fazer

- Nunca `pg_restore` direto sobre `criarov0` sem validar antes em banco isolado.
- Nunca mover/apagar um `.dump` sem confirmar que existe outro backup válido mais recente.
- Nunca versionar arquivos `.dump`/`.sha256` no Git (ignorados via `.gitignore`).
- Nunca imprimir `DATABASE_URL` completa ou a senha do banco em logs, relatórios ou saída de
  comando.
