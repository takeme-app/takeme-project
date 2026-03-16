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
