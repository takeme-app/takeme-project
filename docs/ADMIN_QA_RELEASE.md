# Notas release — pass Admin QA

## Regressão

- `npm run test:e2e --workspace=admin` (com `E2E_ADMIN_*` ou baseURL apontando ao admin).
- Percorrer checklist em `docs/admin-qa-checklist.md` para módulos P0/P1.

## Limpeza

- Remover registos `[QA-TEST]` em produção se tiverem sido inseridos (ver comentários em `scripts/admin-qa/reconcile.sql`).

## Alterações principais deste pass

- **QA documental:** `docs/admin-qa-environment.md`, `docs/admin-qa-runbook.md`, `docs/admin-qa-sql-verification.md`, `docs/admin-qa-bugs.md`; checklist expandido em `docs/admin-qa-checklist.md` (filtros por módulo).
- **Destinos:** `fetchDestinos` agrega estados de viagem, Take Me vs parceiro e partidas passadas/futuras; lista, KPI e gráfico respeitam filtros da UI.
- **E2E:** `data-testid="home-open-filter"` + teste do modal de filtro no Início (com `E2E_ADMIN_*`).
- **Metro / React:** `apps/admin/metro.config.js` passa a resolver `react`/`react-dom` na raiz do monorepo quando não existirem em `apps/admin/node_modules` (hoisting npm). Na raiz, `react`/`react-dom` devem estar alinhados à versão do admin (ex.: 19.1.0 com os `overrides` do monorepo).
- Inventário: `docs/admin-qa-inventory.md`
- Viagens: filtros unificados, lista usa `bookingId` por linha; métricas derivadas da lista filtrada
- Home: “Aplicar filtro” recalcula cartões a partir de `fetchViagens` / `fetchEncomendas`; gráfico de payouts permanece global (copy atualizada)
- Motoristas: filtros da tabela aplicados; navegação usa `tripId` + `driverId`
- Passageiros: filtros da tabela; navegação usa `id` do passageiro + primeira reserva quando existir
