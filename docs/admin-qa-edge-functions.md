# Matriz Edge Functions — Admin

Testar com JWT de utilizador **admin** (`app_metadata.role = admin`). Sem token: esperar **401**.

| Função | Método | Notas |
|--------|--------|--------|
| manage-promotions | GET / POST / PUT / DELETE | CRUD promoções; corpo conforme `queries.createPromotion` |
| manage-pricing-routes | GET / POST / PUT / DELETE | Trechos precificação |
| manage-excursion-budget | POST | `excursion_id`, `budget_lines`, `finalize` |
| process-refund | POST | Estorno Stripe (ambiente de teste) |

**RLS:** validar no browser com sessão real; o MCP SQL usa service role e não substitui este passo.
