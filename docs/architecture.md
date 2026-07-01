# Arquitetura

## Stack atual

- Next.js 16 com App Router.
- React 19.
- TypeScript estrito.
- Tailwind CSS 4.
- shadcn/base-ui parcial para componentes.
- Zod para contratos de domínio.
- Vitest para testes unitários.
- ESLint com `eslint-config-next` para App Router, React e TypeScript.

## Estrutura

- `app/`: páginas, layouts e route handlers.
- `app/api/health/route.ts`: endpoint público de health check sem dados sensíveis.
- `components/`: componentes visuais preservados do frontend v0.
- `lib/auth/`: fronteira futura de autenticação e autorização.
- `lib/db/`: fronteira futura de banco e ORM.
- `lib/repositories/`: fronteira futura de acesso a dados.
- `lib/services/`: fronteira futura de regras de negócio.
- `lib/types/`: tipos de domínio compartilhados.
- `lib/validators/`: schemas Zod para validação.
- `tests/unit/`: testes unitários.
- `tests/integration/`: testes de integração futuros.
- `docs/`: documentação técnica.

## Fronteiras de segurança

O sistema não deve automatizar cadastros em plataformas externas, CAPTCHA, OTP, links de afiliado, sessões de terceiros ou navegação externa. Contas gerenciadas não armazenam senha, senha de e-mail, cookie, OTP ou token de sessão externa. Segredos ficam fora do Git e `.env.example` contém apenas nomes de variáveis com valores de exemplo.

## Arquitetura prevista

O frontend no App Router chamará Server Actions ou Route Handlers próprios. As rotas e actions validarão entrada com Zod, aplicarão autenticação/autorização em `lib/auth`, chamarão services para regras de negócio e repositories para persistência. Na Fase 3, `lib/db` deve receber Drizzle ORM, migrations e conexão PostgreSQL exclusiva do projeto.

Fluxo previsto:

`UI -> Server Action/Route Handler -> validators -> auth policy -> service -> repository -> Drizzle -> PostgreSQL`

## Ainda não implementado

- PostgreSQL real.
- Drizzle ORM e migrations.
- Better Auth.
- CRUD persistente.
- Painel administrativo conectado ao banco.
- Filas reais.
- Métricas persistentes.
- Deploy, PM2, Nginx e domínio.
