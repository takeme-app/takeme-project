# Auditoria de RLS — 9 tabelas pendentes

Data: 21/abr/2026. Projeto Supabase `xdxzxyzdgwpucwuaxvik` (take_me).

**Status da aplicação:**
- Fase 1–5 (7 tabelas) **aplicada** em 21/abr/2026, via migrations `rls_enable_batch1_ratings_history_catalog` até `rls_enable_batch5_worker_ratings`. Ver seção "Status atual" abaixo.
- Fase 6 (`payouts`) e fase 7 (`worker_assignments`) **aplicadas** em 21/abr/2026, via migrations `rls_enable_batch6_payouts` e `rls_enable_batch7_worker_assignments`. Conclui o ciclo de RLS das 9 tabelas listadas neste documento (0 advisors `rls_disabled_in_public` restantes).

Este documento consolida, para cada tabela onde o advisor reportou
`rls_disabled_in_public`, o esquema atual, as policies existentes, os pontos
de consumo no código (apps e Edge Functions) e o SQL sugerido/aplicado.

## Status atual

| Tabela | RLS ON | Fase | Migration aplicada | Pendências |
|---|---|---|---|---|
| `dependent_shipment_ratings` | sim | 1 | `rls_enable_batch1_ratings_history_catalog` | — |
| `status_history` | sim | 1 | `rls_enable_batch1_ratings_history_catalog` | — |
| `surcharge_catalog` | sim | 1 | `rls_enable_batch1_ratings_history_catalog` | — |
| `pricing_route_surcharges` | sim | 2 | `rls_enable_batch2_pricing_route_surcharges` | — |
| `pricing_routes` | sim | 3 | `rls_enable_batch3_pricing_routes` | — |
| `promotions` | sim | 4 | `rls_enable_batch4_promotions` | — |
| `worker_ratings` | sim | 5 | `rls_enable_batch5_worker_ratings` | — |
| `payouts` | sim | 6 | `rls_enable_batch6_payouts` | policy leaky removida; self-read motorista adicionada |
| `worker_assignments` | sim | 7 | `rls_enable_batch7_worker_assignments` | 4 policies adicionadas (self-read/update motorista + admin read/update) |

Convenção:

- "Impacto esperado" = o que deixa de funcionar se aplicar apenas
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` sem nenhuma policy nova. Serve
  para entender o que precisa ser acrescentado.
- "SQL sugerido" = draft das `CREATE POLICY` complementares. Ainda não foi
  aplicado; revisar antes.
- Edge Functions usam `service_role_key`, portanto bypassam RLS por padrão —
  policies abaixo não afetam Edge Functions que usem `createClient(url,
  serviceRoleKey)`.

## Visão geral

| Tabela | RLS ON hoje | Policies existentes | Bloquearia quem se RLS=ON sem novas policies? |
|---|---|---|---|
| `payouts` | não | 3 (2 admin + 1 "authenticated" ampla) | Motorista lendo próprios `payouts` (4 chamadas em `apps/motorista/`) e admin UI em `apps/admin/` |
| `promotions` | não | 1 admin SELECT | Cliente/Motorista lendo promoções ativas (3 telas) |
| `pricing_routes` | não | 2 (admin + worker via `worker_can_read_pricing_route`) | Cliente (`shipmentQuote.ts`) — não há policy para `authenticated` comum |
| `pricing_route_surcharges` | não | 1 admin SELECT | Ninguém no client-side direto (apenas Edge Functions com service_role) |
| `surcharge_catalog` | não | 1 admin SELECT | Admin UI (ativar RLS funciona pois `is_admin()` cobre) |
| `worker_ratings` | não | 1 admin SELECT | Admin UI (`PagamentosGestaoScreen`, `ViagemDetalheScreen`, `PreparadorEditScreen`) — policy cobre se sessão for admin |
| `dependent_shipment_ratings` | não | 1 admin SELECT | Nenhum caller direto client-side encontrado |
| `status_history` | não | 1 admin SELECT | Admin UI (`queries.ts`) — policy cobre |
| `worker_assignments` | não | 0 policies | **Motorista** (`PendingRequestsScreen`) — total bloqueio sem policies novas |

## 1. `payouts`

### Esquema

`id uuid PK`, `worker_id uuid NN`, `entity_type text NN`, `entity_id uuid NN`,
`gross_amount_cents int NN`, `worker_amount_cents int NN`, `admin_amount_cents int NN`,
`surcharges_cents int NN`, `promotion_discount_cents int NN`, `payout_method text NN`,
`status text NN`, `paid_at timestamptz`, `period_start date`, `period_end date`,
`created_at/updated_at`, `cancelled_reason text`, `receipt_url text`.

### Policies existentes (inertes)

- `"Admin can read all payouts"` SELECT, `USING is_admin_v2()`
- `"Admin can update payouts"` UPDATE, `USING is_admin_v2()`
- `"Authenticated admin can read all payouts"` SELECT, `USING (auth.role() = 'authenticated')` — **policy leaky**: qualquer authenticated lê todos os payouts.

### Callers

- Motorista lê os próprios (filtro `eq('worker_id', user.id)`):
  - [apps/motorista/src/lib/driverPaymentTransfers.ts](apps/motorista/src/lib/driverPaymentTransfers.ts) L32-L36
  - [apps/motorista/src/screens/excursoes/PagamentosExcursoesScreen.tsx](apps/motorista/src/screens/excursoes/PagamentosExcursoesScreen.tsx) L98-L102 e L117-L120
  - [apps/motorista/src/screens/excursoes/PagamentosHistoricoExcursoesScreen.tsx](apps/motorista/src/screens/excursoes/PagamentosHistoricoExcursoesScreen.tsx) L118-L122
- Admin UI lê todos / agrega:
  - [apps/admin/src/data/queries.ts](apps/admin/src/data/queries.ts) L822-L825, L925-L929, L2376-L2381, L2452-L2454, L3053-L3055
- Edge Functions (service_role, bypassam RLS):
  - `process-payouts`, `process-refund`, `refund-journey-start-not-accepted`

### Impacto esperado com RLS ON sem ajustes

Motorista **não lê** nenhum payout (bloqueia 4 telas). Admin UI só funciona se sessão tiver `is_admin_v2()=true`. A policy leaky continua leaky até ser removida.

### SQL sugerido (draft)

```sql
-- 1) Remover policy duplicada/leaky
DROP POLICY "Authenticated admin can read all payouts" ON public.payouts;

-- 2) Adicionar policy do motorista lendo próprios
CREATE POLICY "payouts_worker_read_own"
  ON public.payouts FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

-- 3) Bloquear INSERT/DELETE no client (só Edge Functions via service_role)
-- (não precisa CREATE POLICY: sem policy para INSERT/DELETE, RLS nega por padrão)

-- 4) Ligar RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
```

Smoke test (após aplicar):
- Motorista: `select count(*) from payouts where worker_id = auth.uid()` > 0 (sessão de motorista com payouts).
- Motorista: `select * from payouts where worker_id <> auth.uid() limit 1` = 0 linhas.
- Admin: dashboard de pagamentos carrega totais normalmente.

---

## 2. `promotions`

### Esquema

`id, title, description, start_at, end_at, target_audiences text[], discount_type, discount_value, applies_to text[], is_active, created_by, created_at, updated_at, gain_pct_to_worker numeric`.

### Policies existentes

- `"Admin can read all promotions"` SELECT `is_admin()`

### Callers

- Motorista: `apps/motorista/src/screens/HomeScreen.tsx` L415-L419 (lê `is_active=true, gain_pct_to_worker, end_at`); `apps/motorista/src/screens/encomendas/HomeEncomendasScreen.tsx` L153-L157
- Admin UI: `apps/admin/src/screens/PromocoesScreen.tsx` L261, `apps/admin/src/screens/PromocaoCreateScreen.tsx` L134, `apps/admin/src/data/queries.ts` L2325-L2329
- Edge Function: `manage-promotions` (service_role)

### Impacto esperado

Motorista perde listagem de promoções ativas; admin UI mantém via policy existente.

### SQL sugerido

```sql
CREATE POLICY "promotions_public_read_active"
  ON public.promotions FOR SELECT TO authenticated
  USING (is_active = true AND start_at <= now() AND end_at >= now());

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
```

Smoke test: motorista carrega Home com promoção ativa visível; promoção com `is_active=false` não aparece; admin continua vendo tudo no painel.

---

## 3. `pricing_routes`

### Esquema resumido

`id, role_type text, title, origin_address, destination_address, pricing_mode, price_cents int, driver_pct numeric, admin_pct numeric, accepted_payment_methods text[], departure_at, return_at, is_active, origin_lat/lng, destination_lat/lng`.

### Policies existentes

- `"Admin can read all pricing_routes"` SELECT `is_admin()`
- `pricing_routes_worker_read` SELECT `is_admin() OR worker_can_read_pricing_route(role_type)` — cobre motorista/preparador.

### Callers

- Cliente: `apps/cliente/src/lib/shipmentQuote.ts` L215-L218 — **role comum `authenticated`**.
- Motorista: `apps/motorista/src/screens/WorkerRoutesScreen.tsx` L174-L178 (cobre via policy existente).
- Admin: `apps/admin/src/screens/PagamentosGestaoScreen.tsx` L898, `apps/admin/src/data/queries.ts` L2477-L2481.
- Edge Function: `manage-pricing-routes` (service_role).

### Impacto esperado

Cliente perde cálculo de quote de envios. Policy atual não prevê cliente.

### SQL sugerido

```sql
CREATE POLICY "pricing_routes_client_read_active"
  ON public.pricing_routes FOR SELECT TO authenticated
  USING (is_active = true);

-- Alternativa: mantendo só admin/worker e movendo quote para Edge Function.

ALTER TABLE public.pricing_routes ENABLE ROW LEVEL SECURITY;
```

Decisão: expor `is_active=true` globalmente é aceitável porque não há segredos (preço/rotas são informação comercial). Se preferir não expor, migrar `shipmentQuote.ts` para uma Edge Function.

---

## 4. `pricing_route_surcharges`

### Esquema

`id, pricing_route_id, surcharge_id, value_cents, created_at`.

### Callers

- Só Edge Function `manage-pricing-routes` (bypass via service_role).
- Admin UI lê via join `pricing_routes(*, pricing_route_surcharges(*, surcharge_catalog(*)))` — relação embutida depende de RLS da tabela aninhada.

### Policy existente

- `"Admin can read all pricing_route_surcharges"` SELECT `is_admin()`.

### Impacto esperado

Se admin UI usa join aninhado e sessão é admin, policy cobre. Sem sessão admin (ex.: motorista) não verá surcharges embutidas em `pricing_routes`.

### SQL sugerido

```sql
CREATE POLICY "pricing_route_surcharges_worker_read"
  ON public.pricing_route_surcharges FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pricing_routes pr
      WHERE pr.id = pricing_route_id
        AND (is_admin() OR public.worker_can_read_pricing_route(pr.role_type))
    )
  );

ALTER TABLE public.pricing_route_surcharges ENABLE ROW LEVEL SECURITY;
```

Smoke test: motorista abre rota com surcharges e o join retorna os registros.

---

## 5. `surcharge_catalog`

### Esquema

`id, name, description, default_value_cents, surcharge_mode, is_active, created_at, updated_at`.

### Callers

- Admin UI: `apps/admin/src/data/queries.ts` L2490-L2494 (`is_active=true`).
- Join aninhado via `pricing_routes`.

### Policy existente

- `"Admin can read all surcharge_catalog"` SELECT `is_admin()`.

### Impacto esperado

Se RLS ligar, motorista deixa de ver o `surcharge_catalog` aninhado nas rotas.

### SQL sugerido

```sql
CREATE POLICY "surcharge_catalog_authenticated_read_active"
  ON public.surcharge_catalog FOR SELECT TO authenticated
  USING (is_active = true);

ALTER TABLE public.surcharge_catalog ENABLE ROW LEVEL SECURITY;
```

Smoke test: motorista/admin leem catálogos ativos; inativos só admin.

---

## 6. `worker_ratings`

### Esquema

`id, worker_id, rated_by, entity_type, entity_id, rating smallint, comment, created_at`.

### Callers

- Admin UI: `PagamentosGestaoScreen.tsx` L809, `ViagemDetalheScreen.tsx` L181, `PreparadorEditScreen.tsx` L288.
- Nenhum caller client-side (cliente) encontrado — criação ocorre via RPC ou Edge Function.

### Policy existente

- `worker_ratings_admin_read` SELECT `is_admin()`.

### Impacto esperado

- Admin UI: OK (policy cobre).
- Motorista: **não lê** suas próprias avaliações (nenhuma policy o permite). Se existe tela de auto-rating no motorista (confirmar), precisa policy.
- Cliente: sem consumo direto encontrado.

### SQL sugerido

```sql
CREATE POLICY "worker_ratings_worker_read_own"
  ON public.worker_ratings FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "worker_ratings_rated_by_read_own"
  ON public.worker_ratings FOR SELECT TO authenticated
  USING (rated_by = auth.uid());

ALTER TABLE public.worker_ratings ENABLE ROW LEVEL SECURITY;
```

Smoke test: motorista lê próprias avaliações; usuário que avaliou vê a linha que criou; admin continua vendo tudo.

---

## 7. `dependent_shipment_ratings`

### Esquema

`id, dependent_shipment_id, rating smallint, comment, created_at`.

### Callers

Nenhum via grep direto em apps/* ou supabase/functions/*. Pode ser lida via view admin ou Edge Function RPC.

### Policy existente

- `dependent_shipment_ratings_admin_read` SELECT `is_admin()`.

### SQL sugerido

```sql
ALTER TABLE public.dependent_shipment_ratings ENABLE ROW LEVEL SECURITY;
```

Smoke test: abrir admin → aba de avaliações de dependentes; verificar que retorna dados.

---

## 8. `status_history`

### Esquema

`id, entity_type text, entity_id uuid, status text, label text, changed_by uuid, changed_at timestamptz`.

### Callers

- Admin UI: `apps/admin/src/data/queries.ts` L2049-L2053 (lê eventos de excursion).
- Possivelmente triggers escrevem (verificar funções `fn_insert_status_history`).

### Policy existente

- `"Admin can read all status_history"` SELECT `is_admin()`.

### Impacto esperado

Admin OK. Dono da entidade não lê seu histórico (se relevante).

### SQL sugerido

```sql
-- Por ora, só admin. Se no futuro user precisar ver histórico próprio,
-- adicionar policy por entity (join + user_id match).
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
```

Smoke test: admin abre detalhe de uma excursion e vê a timeline completa.

---

## 9. `worker_assignments`

### Esquema

`id, worker_id, entity_type, entity_id, status, assigned_at, accepted_at, completed_at, notes, rejected_at, rejection_reason, expires_at`.

### Callers

- Motorista (crítico): `apps/motorista/src/screens/PendingRequestsScreen.tsx` L146-L149 (SELECT), L707-L718 (UPDATE accept/reject), L752-L764 (UPDATE accept/reject).
- Admin UI: `apps/admin/src/data/queries.ts` (contagens/listagens — ver grep).
- Edge Function `expire-assignments` (service_role).

### Policy existente

**Nenhuma.** Habilitar RLS sem adicionar policies **quebra o motorista por completo** (tela PendingRequests fica vazia, aceite/rejeição falha).

### SQL sugerido

```sql
CREATE POLICY "worker_assignments_worker_read_own"
  ON public.worker_assignments FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "worker_assignments_worker_update_own"
  ON public.worker_assignments FOR UPDATE TO authenticated
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "worker_assignments_admin_read"
  ON public.worker_assignments FOR SELECT TO authenticated
  USING (is_admin_v2());

ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;
```

Smoke test:
- Motorista com assignment `assigned` vê linha em `PendingRequestsScreen`.
- Motorista consegue `UPDATE status='accepted'` via supabase-js.
- Motorista tentando ler assignment de outro worker retorna 0 linhas.
- Edge Function `expire-assignments` continua funcionando (service_role).

---

## Ordem de aplicação sugerida

Por ordem de risco/impacto — aplicar **um por vez** com smoke test entre cada:

1. `dependent_shipment_ratings`, `status_history`, `surcharge_catalog` — zero/mínimo blast radius.
2. `pricing_route_surcharges` — só afeta admin.
3. `pricing_routes` — adiciona policy do cliente (pode optar por Edge Function).
4. `promotions` — adiciona policy authenticated read active.
5. `worker_ratings` — adiciona policies de self-read.
6. `payouts` — remove policy leaky + adiciona worker self-read.
7. `worker_assignments` — **obrigatório criar policies antes de ligar** (4 novas).

## Pós-aplicação

Rodar `get_advisors type=security` e confirmar queda dos 9 erros
`rls_disabled_in_public` para 0. Atualizar
[docs/ESTADO_DO_PROJETO.md](docs/ESTADO_DO_PROJETO.md) seção "Advisors
pré-existentes de segurança".
