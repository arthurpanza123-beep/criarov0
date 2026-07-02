# Importação e exportação (Fase 6)

## Importação CSV

`lib/services/import-service.ts` + `lib/admin/csv.ts` (parser CSV sem dependências).

Entidades suportadas (administrativas, sem credenciais): `managed_accounts`, `campaigns`,
`customers`. **Nunca** importa senha, OTP, cookie, token ou sessão externa.

### Fluxo

1. Upload controlado (`/importacoes`, RBAC `imports:create` = owner/admin).
2. Parsing do CSV.
3. Validação por linha (Zod por entidade) + normalização (e-mail lowercase, telefone só dígitos/+,
   moeda sem negativo).
4. Detecção de duplicatas dentro do arquivo e contra o banco (por e-mail para contas/clientes; por
   nome+plataforma para campanhas).
5. Relatório de linhas válidas / inválidas / duplicadas (por linha, com mensagens de erro).
6. **Dry-run** (padrão): apenas valida e registra o relatório, sem inserir.
7. **Commit**: inserção **transacional** — se qualquer linha falhar, a transação inteira sofre
   rollback (nada é inserido).
8. **Idempotência**: duplicatas (já existentes no banco) são ignoradas, então reimportar o mesmo
   arquivo não cria duplicatas.
9. Histórico persistido em `import_batches` (modo, status, contagens, relatório sanitizado, autor).

### Limites

`IMPORT_LIMITS`: `maxRows = 5000`, `maxBytes = 2_000_000`. Excedê-los rejeita o arquivo.

### Colunas esperadas

- `managed_accounts`: `label, email, provider, monthlyCreditLimit, notes`.
- `campaigns`: `name, platform, rewardPerConversion, currency, monthlyLimit, referralUrl, notes, active`.
- `customers`: `name, email, phone, notes`.

### Assíncrono (fila)

O tipo de job `import_entities` executa uma importação transacional em background (CSV no payload).
A importação primária pela UI é síncrona (dry-run/commit no request), com histórico auditável.

## Exportação CSV

`lib/services/export-service.ts` + rota `GET /api/export/[entity]`.

- Entidades: `managed_accounts`, `campaigns`, `customers`, `orders`, `credit_ledger`.
- Autorização: cada exportação exige permissão de **leitura** da entidade correspondente
  (`exportResource`). Rota valida a sessão + permissão e registra uma activity `export_generated`.
- Resposta: `text/csv` com `Content-Disposition: attachment`, `Cache-Control: no-store, private`.
- Limite: `EXPORT_LIMIT = 10_000` linhas por exportação.
- Página `/exportacoes` lista apenas as entidades que o papel pode ler.
- **Mitigação de CSV/formula injection**: `escapeCsvField` (`lib/admin/csv.ts`) neutraliza qualquer
  campo que comece com `=`, `+`, `-`, `@`, tab ou CR, prefixando-o com um apóstrofo antes da escapa
  estrutural (aspas/vírgula/CRLF). Isso impede que planilhas (Excel, Google Sheets, LibreOffice)
  interpretem um valor exportado como fórmula executável ao abrir o CSV.

Nenhum segredo é exportado; as tabelas administrativas não contêm senhas, tokens ou cookies.

## Testes

- Unit: parser CSV (aspas, escapes, vírgulas embutidas, CRLF, linhas em branco) e neutralização de
  formula injection (`=`, `+`, `-`, `@`, tab, CR).
- Integração (`criarov0_test`): dry-run sem inserção, commit transacional, dedup em reimport, linhas
  inválidas sinalizadas, rollback em falha de transação, exportação com cabeçalho + dados.
