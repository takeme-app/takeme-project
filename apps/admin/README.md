# Take Me — Admin (painel web)

App **administrativo** do Take Me. Este app é **independente** do cliente, motorista e preparadores no dia a dia: tem seu próprio Metro config e scripts.

## Quem mexe aqui

- **Dev(s) do admin:** trabalham só nesta pasta e em `packages/shared` quando precisar.
- **Outros apps** (cliente, motorista, etc.) são desenvolvidos por outras pessoas; não altere esses apps.

## Rodar localmente

Sempre a partir **desta pasta** (`apps/admin`):

```bash
cd apps/admin
npm run start
```

Abra a URL que aparecer (ex.: http://localhost:8081). O **Metro usa o config daqui** (`metro.config.js`), não o da raiz do monorepo, então sempre sobe o **admin**.

## Variáveis de ambiente

- Copie o `.env` da **raiz do repo** para esta pasta (ou rode na raiz: `npm run sync-env`).
- As variáveis são carregadas pelo `app.config.js` (Node) e expostas em `Constants.expoConfig.extra` para o Supabase.

## Build / deploy (Vercel)

Na raiz: `npm run build:admin` ou, daqui, `npm run build`. O deploy usa as env vars configuradas na Vercel.

## Documentação QA (manual)

- [docs/admin-qa-environment.md](../../docs/admin-qa-environment.md) — variáveis e dados `[QA-TEST]`
- [docs/admin-qa-runbook.md](../../docs/admin-qa-runbook.md) — ordem de testes
- [docs/admin-qa-checklist.md](../../docs/admin-qa-checklist.md) — filtros por módulo
- [docs/admin-qa-sql-verification.md](../../docs/admin-qa-sql-verification.md) — baseline SQL

## Testes E2E (Playwright)

1. Uma vez: `cd apps/admin && npx playwright install chromium`
2. Credenciais de **admin** (recomendado): `E2E_ADMIN_EMAIL` e `E2E_ADMIN_PASSWORD` no **`apps/admin/.env`** ou no **`.env` na raiz do monorepo** (o Playwright carrega os dois; o do admin tem prioridade em chaves repetidas):

   ```env
   E2E_ADMIN_EMAIL=teu@email.com
   E2E_ADMIN_PASSWORD=a_tua_senha
   ```

   Modelo: copia [.env.example](.env.example) → `.env` e preenche. **Não commits** o `.env`.

3. Correr:

```bash
cd apps/admin
npm run test:e2e
```

Alternativa sem editar `.env`: `E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e`

Sem credenciais, corre apenas o smoke da página de login. Com credenciais de **admin**, percorre rotas principais, o modal de filtro do Início e o filtro por nome na tabela de Viagens.

Por omissão o Playwright arranca o Expo em `http://127.0.0.1:9323` (porta `PLAYWRIGHT_PORT`). Se já tens o admin noutra porta: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8081 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e`
