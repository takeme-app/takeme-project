# Runbook — execução manual do molde de 5 passos

Ordem: [apps/admin/src/router.tsx](apps/admin/src/router.tsx). Para cada módulo, marcar colunas em [docs/admin-qa-checklist.md](docs/admin-qa-checklist.md).

## Passos por módulo

1. **Carregar:** abrir rota; esperar fim do loading; consola sem erros críticos.
2. **Dados:** comparar KPIs/listas com [scripts/admin-qa/reconcile.sql](scripts/admin-qa/reconcile.sql) ou MCP `execute_sql` quando aplicável.
3. **Filtros:** percorrer sublista de controlos no checklist; contagem/KPI deve mudar de forma previsível; repor estado.
4. **Navegação:** URLs com IDs corretos (booking, trip, user).
5. **Escritas:** só staging / `[QA-TEST]`; ver inventário R/W em [docs/admin-qa-inventory.md](docs/admin-qa-inventory.md).

## Sequência sugerida

1. `/login`, `/signup`, `/forgot-password`
2. Layout (tabs, Mais, conta, sair)
3. `/` Início
4. `/viagens` + detalhe + histórico + editar
5. `/passageiros` + detalhe + viagem + editar
6. `/motoristas` + editar + viagem + histórico
7. `/destinos`
8. `/encomendas` + editar + viagem
9. `/preparadores` + editar + viagem
10. `/promocoes` + `/promocoes/nova`
11. `/pagamentos`, `/pagamentos/gestao`, criar trecho, detalhes slug
12. `/atendimentos` + detalhe + orçamento
13. `/configuracoes`

## Mapas

Com `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` válida: validar tiles e rota nos ecrãs que mostram mapa ao vivo.
