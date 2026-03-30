# Verificação SQL (baseline) — projeto Take Me

Executar localmente ou via MCP `execute_sql` (`project_id`: `xdxzxyzdgwpucwuaxvik`). Os números abaixo são um **snapshot de referência**; voltar a correr as queries ao validar cada módulo.

## `scheduled_trips` por `status`

| status | n (snapshot) |
|--------|----------------|
| active | 2 |
| cancelled | 1 |
| completed | 6 |

## `bookings` por `status`

Snapshot MCP: conjunto vazio na leitura executada (pode ser tabela vazia ou política). Confirmar no SQL Editor com a mesma conta/service role usada no MCP.

## Script completo

Ver [scripts/admin-qa/reconcile.sql](scripts/admin-qa/reconcile.sql) para `shipments`, `promotions`, `payouts`, `conversations`.

**Nota:** comparação com o admin no browser deve usar sessão **JWT admin**; resultados só com service role não provam RLS.
