# Continuar Amanhã

Handoff canônico. Este documento descreve o **estado real e verificado** do projeto, não intenção
ou trabalho planejado.

## Estado atual

Projeto em produção real em `https://v0.panzza.com.br`. Fase 7 (acabamento operacional) concluída:
backup automático diário, `APP_COMMIT` resolvido automaticamente e validado, feedback inline em
todos os formulários prioritários, monitoramento operacional automático com notificação interna
deduplicada, e página `/sistema` expandida.

## Branch e commit implantado

- Branch de trabalho: `chore/operational-polish` (publicada).
- `main`: atualizada via fast-forward puro, publicada.
- **Commit implantado e verificado em produção**: `449a7c06f379b28b2950f0309a8a14a7a1fd2347`.
  Confirmado por: `git rev-parse HEAD` local == campo `commit` de
  `curl -s https://v0.panzza.com.br/api/version` — validação exata, sem hardcode.

## Backup automático

- `systemd timer` `v0-farmar-backup.timer` (diário, 03:15 UTC + até 5 min de atraso aleatório),
  ativo e habilitado (`systemctl status v0-farmar-backup.timer` → `active (waiting)`).
- Script: `scripts/backup-database.ts` + `lib/ops/backup-retention.ts` (lógica pura testada em
  `tests/unit/ops.test.ts`, 14 testes).
- Retenção: 7 diários / 4 semanais / 6 mensais, com promoção antes de descarte.
- Checksum SHA-256 por arquivo, verificação de integridade via `pg_restore --list`.
- Status persistido em `backups/last-backup.json` **e** em `settings.ops.lastBackupStatus` (lido
  pela página `/sistema` e pelo monitor).
- **Evidência real desta certificação**: backup manual + backup via `systemctl start
  v0-farmar-backup.service` bem-sucedidos; teste de falha proposital com exit code correto; teste
  de retenção com 10 dumps simulados confirmando keep-7/promote-8th; restore real validado em banco
  temporário `criarov0_restore_check` (17 tabelas, contagens idênticas), depois removido.

## APP_COMMIT

- Resolvido dinamicamente em `ecosystem.config.cjs` via `git rev-parse HEAD` (nunca hardcoded,
  nunca editado manualmente).
- Propagado como variável de ambiente para `v0-farmar-web` e `v0-farmar-worker`.
- Logado na inicialização: `instrumentation.ts` (web, hook oficial do Next.js) e `lib/jobs/worker.ts`
  (worker, log `"worker started"` com `versionInfo()`).
- **Validado nesta certificação**: commit local == commit em produção (ver seção acima).

## Feedback inline de formulários

- Helpers reutilizáveis: `components/admin/action-form.tsx` (`ActionForm`, children JSX diretos —
  nunca render-prop, por causa da fronteira RSC server→client), `components/admin/form-feedback.tsx`
  (`FormError`, `FieldError`, `SubmitButton`, `useFormFeedback`), `components/ui/toast.tsx`
  (`ToastProvider`/`useToast`), `lib/admin/form-state.ts` + `lib/admin/form-state-types.ts`
  (`FormActionState<T>`, `runFormAction`, `KnownFormError`).
- Aplicado a: login, alterar-senha, usuários, contas, campanhas, indicações, clientes, pedidos,
  créditos, importações (upload CSV), jobs (enfileirar reconciliação), configurações.
- Comportamento: erro geral sanitizado (nunca stack trace ou erro cru de driver/banco), erro por
  campo, estado de carregamento no botão, foco automático no primeiro campo inválido, toast de
  sucesso, limpeza de campos sensíveis (senha) após falha.
- **Bug real encontrado e corrigido durante esta fase**: a primeira tentativa usou `children` como
  função (render-prop) recebendo `(state, pending) => JSX` — isso quebra em produção porque Next.js
  RSC não permite passar funções do Server Component (a página) para o Client Component
  (`ActionForm`); só dados serializáveis e Server Actions `"use server"` cruzam essa fronteira. O
  erro só apareceu no `next build`/`test:e2e` reais, não no `typecheck`/`lint`/testes unitários.
  Corrigido usando `children` como elementos JSX já instanciados (serializáveis), com
  `cloneElement` interno no `ActionForm` para injetar `aria-invalid` e renderizar `FieldError`.

## Monitoramento operacional

- `systemd timer` `v0-farmar-monitor.timer` (a cada 5 minutos), ativo e habilitado.
- Script: `scripts/health-monitor.ts` + `lib/services/monitoring-service.ts`.
- Checagens: banco, worker (heartbeat, throttle 15s), fila (backlog), dead-letter, jobs presos,
  backup (status/idade), disco (via `statfs`, sem shell out).
- Resultado agregado em `settings.ops.lastMonitorRun`, exibido em `/sistema`.
- Notificação interna criada **apenas na transição de estado** (novo incidente ou recuperação) —
  comprovado por teste de integração que roda o monitor duas vezes seguidas com o mesmo incidente e
  confirma que só 1 notificação é criada.
- **Evidência real desta certificação**: antes do deploy, o worker real (código antigo, sem
  heartbeat) foi detectado como `critical` pelo monitor. Após o deploy, o heartbeat apareceu em
  ~20s e uma nova execução do monitor confirmou `severity: "ok"` em todas as 7 checagens, com
  notificação de recuperação "Operação normalizada" criada automaticamente.

## Página /sistema

Expandida com: banco, worker (heartbeat), fila, dead-letter, versão/commit, ambiente, backup
(status/idade — detalhes sensíveis como erro cru só para quem tem `system:manage`, ou seja, owner),
disco, jobs presos (só aparece se houver), última execução do monitor. RBAC: dados básicos exigem
`system:read` (admin+owner); detalhes sensíveis exigem `system:manage` (owner).

## Banco de dados

- `criarov0` (principal) e `criarov0_test`: ambos com 17 tabelas públicas, 3/3 migrations
  aplicadas. Nenhuma migration nova nesta fase (Fase 7 não altera schema).
- Backup pré-deploy desta fase: `criarov0-20260702-175620.dump` (feito antes do deploy do
  commit `449a7c0`).

## Testes (última execução completa)

```text
typecheck        0 erros
lint              0 avisos
test (unit)      78 passed (8 arquivos)
test:integration 74 passed (5 arquivos)
build            ok (25 rotas)
db:check         ok
test:e2e         3 passed (Playwright, fluxo completo real)
```

## Smoke de produção (última execução)

Via `https://v0.panzza.com.br`: `/api/health` 200, `/api/health/ready` 200 (`ready`), `/api/version`
200 (commit correto), `/login` 200, `/`, `/sistema` e `/api/metrics` 307 (protegidos corretamente),
headers de segurança presentes (incluindo HSTS). Zero erros nos logs (`web-error.log`,
`worker-error.log`) e zero restarts do PM2 minutos após o deploy.

## Infraestrutura (sem alteração nesta fase)

PM2 (`v0-farmar-web` + `v0-farmar-worker`), Nginx com TLS (Let's Encrypt) em
`v0.panzza.com.br`, PostgreSQL 17 porta `5433` — todos já certificados em fase anterior e mantidos
sem alteração de arquitetura nesta fase (apenas `ecosystem.config.cjs` ganhou resolução automática
de `APP_COMMIT`).

## Pendências reais (não bloqueiam produção atual)

- Backup automatizado é diário (não incremental); RPO máximo ~24h.
- Sem recuperação de senha por e-mail nem login social (fora do escopo desta fase, explicitamente
  não solicitados).
- Sem agendamento cron embutido para reconciliação/relatórios (jobs podem ser agendados via `run_at`
  futuro, mas não há daemon de cron).
- Auditoria visual pós-deploy não incluiu login manual com credenciais reais do owner de produção
  (boa prática de segurança — a senha nunca foi exposta); a evidência funcional vem do `test:e2e`
  completo contra servidor de produção real antes do deploy, mais smoke HTTP direto pós-deploy.

## Próximo passo exato

1. Considerar automatizar a instalação dos arquivos `systemd/*.service`/`*.timer` como parte do
   fluxo de deploy (hoje é um passo manual documentado em `docs/deployment.md`).
2. Avaliar CSP mais estrita (com nonce) no Nginx, se necessário.
3. Nenhuma ação urgente pendente — sistema certificado e estável.
