# Ambiente QA — Admin Take Me

## Variáveis (apps/admin)

| Variável | Uso |
|----------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | Projeto Take Me (ex.: `https://xdxzxyzdgwpucwuaxvik.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave anon (browser) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Mapas de viagem em tempo real (detalhe/histórico); não commitar |

Copiar `.env` da raiz ou usar `npm run sync-env` na raiz do monorepo.

## Utilizador admin

- Sessão com `app_metadata.role = admin` (ver [apps/admin/src/components/ProtectedRoute.tsx](apps/admin/src/components/ProtectedRoute.tsx)).

## Dados de teste

- **Preferência:** projeto Supabase de staging.
- **Produção:** prefixo textual `[QA-TEST]` em títulos/nomes; manter scripts `DELETE` comentados em [scripts/admin-qa/reconcile.sql](scripts/admin-qa/reconcile.sql) e executar na Fase 5.

## E2E

- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` em `apps/admin/.env` (carregado pelo Playwright) ou exportadas no shell — ver [apps/admin/README.md](../apps/admin/README.md) e [apps/admin/.env.example](../apps/admin/.env.example).
- Playwright usa porta `9323` por defeito ou `PLAYWRIGHT_BASE_URL` + `PLAYWRIGHT_SKIP_WEBSERVER=1`.
