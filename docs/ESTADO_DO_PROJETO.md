# Estado do projeto Take Me

Documento de situação atual para onboarding de novos desenvolvedores. Atualizado conforme o estado do repositório e do projeto Supabase.

---

## 1. Visão geral

- **Projeto:** Take Me — monorepo com 3 apps (Cliente, Motorista, Admin). Preparadores usam o app motorista no cadastro e fluxos dedicados.
- **Repositório:** [github.com/FraktalSoftwares/take_me](https://github.com/FraktalSoftwares/take_me)
- **Supabase:** projeto `xdxzxyzdgwpucwuaxvik` — [Dashboard](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik)

---

## 2. Stack e ferramentas

- **Frontend:** Expo (React Native) para mobile; Expo Web para admin.
- **Backend / BaaS:** Supabase (Auth, Postgres, Storage, Edge Functions, RLS).
- **Mapas:** Mapbox (`@rnmapbox/maps`) — marcadores, rotas e controles de mapa.
- **Rotas / ETA:** OSRM (Open Source Routing Machine) para polylines e duração estimada.
- **Pagamentos:**
  - **Cliente:** Stripe (`@stripe/stripe-react-native`) para tokenização de cartões + Edge Functions `charge-booking` / `charge-shipments` para cobrança.
  - **Motorista:** Stripe Connect Express via Edge Function `stripe-connect-link` (onboarding abre navegador externo; o bundle do app motorista **não** expõe chave Stripe).
  - **Admin:** aciona `process-refund` e `manage-*` para gestão financeira; não tokeniza.
- **Monorepo:** npm workspaces (`apps/*`, `packages/*`); pacote compartilhado em [packages/shared](../packages/shared).
- **Requisitos:** Node >= 18 (recomendado Node 20 para Expo 54), npm ou pnpm.

---

## 3. Estrutura do repositório

| Pasta | Descrição |
|-------|-----------|
| **apps/cliente** | App do passageiro (viagens, envios, excursões, perfil, notificações, LGPD) |
| **apps/motorista** | App do motorista (inclui fluxos de preparador de encomendas e excursões) |
| **apps/admin** | Painel web (Expo Web) |
| **packages/shared** | Cliente Supabase, tipos e utilitários compartilhados |
| **supabase/** | Migrations, Edge Functions; ver [supabase/README.md](../supabase/README.md) e [supabase/EMAIL_SETUP.md](../supabase/EMAIL_SETUP.md) |

---

## 4. Configuração local (passo a passo)

1. **Clonar** o repositório e, na raiz, rodar:
   ```bash
   npm install
   ```
2. **Variáveis de ambiente:** copiar [.env.example](../.env.example) para `.env` na raiz e preencher:
   - `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` — [Settings API](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/settings/api) do projeto Supabase.
   - `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` — [Mapbox Access Tokens](https://account.mapbox.com/access-tokens/).
   - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` — [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys) (chave pública).
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — se for usar mapas Google (opcional).
   - Outras chaves opcionais conforme o `.env.example`.
3. **Não** commitar `.env` (já está no [.gitignore](../.gitignore)).
4. Opcional: `npm run sync-env` para copiar o `.env` da raiz para os apps. Cada app também tem um `.env.example` próprio listando só as variáveis que ele consome: [apps/cliente/.env.example](../apps/cliente/.env.example), [apps/motorista/.env.example](../apps/motorista/.env.example), [apps/admin/.env.example](../apps/admin/.env.example).

---

## 5. Como rodar

- **Na raiz:** `npm run cliente`, `npm run motorista`, `npm run admin`, etc. (detalhes no [README.md](../README.md)).
- **Supabase:** aplicar migrations com `npx supabase db push`; deploy de Edge Functions conforme [supabase/README.md](../supabase/README.md).

---

## 6. Supabase — estado atual

### Migrations

~115 migrations em [supabase/migrations/](../supabase/migrations/) cobrindo: profiles + auth, bookings + scheduled_trips, shipments + dependent_shipments, promotions + pricing_routes, notifications + preferences, excursion_requests/passengers, platform_settings, support_atendimento, worker_assignments (queue de motoristas), payouts v2 (Connect + PIX manual), admin views/paginadas, data_export_requests (LGPD), trip_stops + routing, driver notification triggers e o flag `upcoming_1h_notified_at`, worker_routes delete-own, Stripe Connect status em worker_profiles.

A migration mais recente aplicada em produção (21/abr/2026) é `worker_routes_delete_own` + bloco de triggers de notificação do motorista (`notify_driver_trip_started`, `_trip_lifecycle`, `_activity_status_changed`, `_account_status_change`, `_payment_received`).

### Edge Functions

| Função | Uso |
|--------|-----|
| send-welcome-email | E-mail de boas-vindas |
| send-email-verification-code | Código de verificação de e-mail |
| verify-email-code | Validação do código |
| send-admin-credentials | Envia credenciais para novos admins (Resend) |
| login-with-phone | Login por telefone |
| complete-password-reset | Finaliza reset de senha |
| delete-account | Exclusão de conta |
| confirm-code | Validação de códigos de pickup/delivery |
| request-data-export | Cópia dos dados (LGPD) — JSON + PDF por e-mail, bloqueio 5 min |
| create-motorista-account | _Legado_ — não mais usado pelo app. Conta criada em `verify-email-code` apos PIN. |
| send-phone-verification-code | **Stub** — envia OTP por telefone (WhatsApp Cloud API pendente) |
| verify-phone-code | **Stub** — valida OTP de telefone e cria conta em `auth.users (phone)` |
| manage-admin-users | CRUD de usuários admin |
| manage-pricing-routes | CRUD de rotas de preço |
| dispatch-notification-fcm | Envio FCM de push |
| notify-driver-upcoming-trips | Cron de lembrete de viagem 1h antes |
| expire-assignments | Cron 5 min que expira assignments e dispara estornos |
| ensure-stripe-customer | Cria/busca customer Stripe |
| charge-booking | Cobra reserva (modo draft cobra antes de inserir; aplica split Connect quando motorista tem `stripe_connect_account_id`). Metadata `user_id` em PIs legacy desde 22/abr/2026. Versão remota: v10. |
| charge-shipments | Cobra `shipments` ou `dependent_shipments`. Desde 22/abr/2026 suporta fluxo Pix assíncrono (`pix_requires_payment` + `hosted_voucher_url`). Versão remota: v7. |
| stripe-connect-link | Gera Account Link de onboarding Stripe Connect Express (BR). Versão remota: v6. |
| stripe-webhook | Reconciliação: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`. `verify_jwt=false`. Versão remota: v4. |
| process-refund | Estorno via Stripe Refunds (admin ou cron). Versão remota: v6. |
| refund-shipment-no-driver | Estorno automático quando nenhum motorista aceita. **Deploy inicial (v1) feito em 21/abr/2026 via MCP.** |
| refund-journey-start-not-accepted | Estorno quando motorista inicia viagem sem aceitar um booking/shipment pendente. **Deploy inicial (v1) feito em 21/abr/2026 via MCP.** |
| expire-assignments | Cron (cada 5 min) — expira `worker_assignments` e encadeia `process-refund`. **Deploy inicial (v1) feito em 21/abr/2026 via MCP.** |
| notify-driver-upcoming-trips | Cron (cada 10 min) — envia notificação "1h antes" ao motorista; idempotente via `scheduled_trips.upcoming_1h_notified_at`. **Deploy inicial (v1) feito em 21/abr/2026 via MCP.** |
| save-payment-method | Salva cartão no Stripe; upsert por `(user_id, provider_id)` desde 22/abr/2026. Versão remota: v15. |
| process-payouts | Libera `payouts` em lote (Connect = `paid`; sem Connect = `processing` para PIX manual). Aceita admin via `app_metadata.role` ou `worker_profiles.role` desde 22/abr/2026. Versão remota: v7. |
| respond-assignment | **⚠️ DEPRECADA (stub 410 Gone desde 21/abr/2026).** Source local removido; nenhum cliente consome. Pode ser apagada via Dashboard Supabase a qualquer momento. |

**Secrets necessários no Supabase (Edge Functions → Secrets):**

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — e-mails transacionais
- `STRIPE_SECRET_KEY` (`sk_test_...` em dev, `sk_live_...` em produção)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`) — um por ambiente/endpoint
- `STRIPE_CONNECT_RETURN_URL`, `STRIPE_CONNECT_REFRESH_URL` — fallback quando o cliente não envia URLs no body
- Supabase já injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Ver [supabase/README.md](../supabase/README.md) para deploy (use `--no-verify-jwt` em `stripe-webhook` porque a autenticação é feita via `stripe-signature`, não JWT Supabase).

### Checklist de configuração Stripe (estrutura financeira)

Conta Stripe da plataforma: `acct_1Sz56zRY2dpdoOzu` ("Takeme"). Repetir o checklist abaixo **uma vez por ambiente** (test e live) e por projeto Supabase (dev / prod).

**1. Dashboard Stripe**
- [x] API keys (`sk_test_...` / `pk_test_...` em teste; chaves live em produção) — [Dashboard → API Keys](https://dashboard.stripe.com/apikeys). **Confirmado pelo usuário (22/abr/2026).**
- [x] **Connect** ligado no Brasil, termos aceites, branding (nome, ícone, cores) configurados — onboarding Express abre com esse branding. **Confirmado pelo usuário (22/abr/2026).**
- [x] **Webhook endpoint** apontando para `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`, assinando:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `account.updated` (reflete `charges_enabled`/`payouts_enabled` do Connect)
- [ ] (Opcional) Apple Pay: registar `merchant.com.takeme.cliente` no Apple Developer e associar à conta Stripe.

**2. Secrets Supabase (`supabase secrets set ...`)**
- [x] `STRIPE_SECRET_KEY` — confirmado via probe do `stripe-webhook` (21/abr/2026).
- [x] `STRIPE_WEBHOOK_SECRET` — confirmado via probe do `stripe-webhook` (21/abr/2026).
- [ ] `STRIPE_CONNECT_RETURN_URL` e `STRIPE_CONNECT_REFRESH_URL` — _opcionais_. O cliente já envia deep links `takeme://stripe-connect-return` e `takeme://payments` no body de `stripe-connect-link`; estes secrets funcionam só como fallback se algum caller futuro não enviar.
- [x] Redeploy das funções impactadas via MCP (21/abr/2026): `stripe-webhook` (v1→v4), `charge-booking` (→v9), `charge-shipments` (v6), `stripe-connect-link` (v6), `process-refund` (v6), `refund-shipment-no-driver` (v1), `refund-journey-start-not-accepted` (v1), `ensure-stripe-customer` (v11), `save-payment-method` (v13), `process-payouts` (v6).

**3. App Cliente (EAS)**
- [x] `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` configurada por perfil de build (test/live) — **Confirmado pelo usuário (22/abr/2026).** Ver [`apps/cliente/EAS_BUILD.md`](../apps/cliente/EAS_BUILD.md).
- [ ] Lembrar que cartão só funciona em development build / EAS (Expo Go e Web caem no fallback do `stripeNativeBridge`).

**4. App Motorista (deep links)**
- [ ] Scheme `takeme` abre o app em iOS e Android (testar em internal build) — URLs de retorno usadas: `takeme://payments`, `takeme://stripe-connect-return`.
- [ ] Não expõe chave Stripe no bundle (onboarding Connect é via navegador externo).

**5. QA ponta-a-ponta em test mode**
- [ ] Cliente: checkout de viagem com cartão teste `4242 4242 4242 4242` confirmando que `bookings.stripe_payment_intent_id` é gravado e status vira `paid`.
- [ ] Cliente: envio e envio de dependente cobrando via `charge-shipments` (confirmar PI no Dashboard Stripe).
- [ ] Motorista: onboarding Connect até a conta ficar `charges_enabled: true` (validar que `worker_profiles.stripe_connect_charges_enabled` atualiza via webhook `account.updated`).
- [ ] Viagem com motorista Connect habilitado: conferir `application_fee_amount` (taxa da plataforma) e `transfer_data.destination` no PaymentIntent.
- [ ] Admin: disparar `process-refund` em reserva/envio de teste e validar `refunds` no Dashboard + status `refunded`/`partially_refunded` na tabela via `stripe-webhook` (`charge.refunded`).

### Auth

- Cadastro e login com e-mail (código de verificação) e login por telefone.
- JWT com JWT Signing Keys (ES256). A função `request-data-export` usa `getClaims(token)` + `admin.getUserById` para compatibilidade com o novo formato.

### Onboarding motorista — 3 etapas (23/abr/2026)

- Fluxo atual: `SignUp` (Etapa 1/3) → `VerifyEmail` (PIN) → `CompleteDriverRegistration`/`CompletePreparador*` (Etapa 2/3) → `FinalizeRegistration` → `StripeConnectSetup` (Etapa 3/3, com botão **Pular esta etapa**).
- **Conta é criada no Auth logo após o PIN** (não mais no `FinalizeRegistration`). A edge `verify-email-code` faz `auth.admin.createUser(...)` + `insert worker_profiles (status='inactive')` quando `driver_type` é informado. Isso corrige o bug em que o cadastro era perdido se o app fechasse entre etapas.
- Campos bancários foram **removidos** da tela "Complete seu perfil" (eram redigitados no Stripe Connect). A coleta de conta bancária é feita apenas no Stripe Connect.
- Componente reutilizável `OnboardingStepHeader` visualiza "Etapa X de 3" nas 3 telas.
- **Telefone/WhatsApp:** arquitetura pronta (toggle no `SignUp`, migration `phone_verification_codes` com RLS `service_role`, edge functions `send-phone-verification-code` e `verify-phone-code`), porém o envio real via Meta WhatsApp Cloud API **ainda não está integrado**. Em dev os stubs retornam `dev_code` na resposta para permitir testar o fluxo ponta-a-ponta; em produção (`APP_ENV=prod`) o código não é devolvido. A tela de SignUp exibe aviso "Envio via WhatsApp chegará em breve" quando o usuário seleciona "Telefone".

### Sincronização Supabase ⇄ repositório — 21/abr/2026

Todas as ações validadas via MCP (`list_migrations`, `list_edge_functions`, `apply_migration`, `deploy_edge_function`, `execute_sql`, `get_advisors`).

**Bloco Stripe/Connect (primeira sessão):**

- [x] Migration aplicada: `worker_profiles_stripe_connect_status` (3 colunas booleanas espelhando `Account.charges_enabled` / `payouts_enabled` / `details_submitted`).
- [x] `stripe-webhook` criada no remoto (antes inexistente) com handler `switch` para 4 eventos (`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`) + assinatura assíncrona Deno (`constructEventAsync` + `createSubtleCryptoProvider`).
- [x] `charge-booking` atualizada com correção do `application_fee_amount` quando há desconto de promoção (antes usava `amountCents`, agora usa `chargeAmountCents`).
- [x] PRDs cliente/admin alinhados ao slug real publicado: **`charge-shipments`** (plural).

**Bloco notificações do motorista + refund automatizado + limpeza de órfãs (segunda sessão, mesmo dia):**

- [x] Migrations aplicadas:
  - `notifications_data_column` — adiciona coluna `data jsonb` para deeplinks.
  - `scheduled_trips_upcoming_1h_notified_at` — flag de idempotência para notificação 1h antes.
  - `should_notify_user_fn` — RPC central que respeita `notification_preferences` + `disable_all`.
  - `driver_notification_triggers` — 6 triggers (trip_started, lifecycle, activity_status_changed, account_status_change, payment_received + refresh dos dois existentes).
  - `worker_routes_delete_own` — RLS DELETE para motorista remover rotas próprias.
- [x] Edge Functions deployadas pela primeira vez (v1):
  - `expire-assignments` (cron 5min — expiry + chaining `process-refund`).
  - `refund-shipment-no-driver` (estorno quando nenhum motorista aceita).
  - `refund-journey-start-not-accepted` (estorno quando motorista inicia sem aceitar).
  - `notify-driver-upcoming-trips` (cron 10min — lembrete 1h antes, respeita preferências).
- [x] `respond-assignment` órfã (sem source local; ninguém chama) substituída por stub 410 Gone. Dashboard pode apagar a qualquer momento.
- [x] `.env.example` reorganizado na raiz + por app; `apps/motorista/.env.example` criado; `RESEND_API_KEY` removida do `.env` do cliente (era risco de bundle).

**Bloco hardening de segurança (terceira sessão, mesmo dia):**

- [x] Migration aplicada: `fn_search_path_hardening` — `ALTER FUNCTION ... SET search_path = public, pg_temp` em 18 funções pré-existentes com `search_path` mutable (resolve 17 advisors WARN `function_search_path_mutable` de uma vez).
- [x] Slug `charge-shipment` → `charge-shipments` alinhado: folder local renomeado, `supabase/config.toml` ajustado (`[functions.charge-shipments]`), `apps/cliente/src/lib/supabaseEdgeFunctionNames.ts` atualizado, refs em PRDs/README/migrations alinhadas.
- [x] `SERVICE_ROLE_KEY` gravado em `vault.secrets` (nome `service_role_key`) via `vault.create_secret`. Usado pelo `pg_cron` para chamar Edge Functions autenticadas.
- [x] `cron.schedule` criado: job 5 = `expire-assignments` (`*/5 * * * *`), job 6 = `notify-driver-upcoming-trips` (`*/10 * * * *`). Ambos ativos. Invocação manual retornou HTTP 200 (`expired_count=0`, `scanned=0,sent=0`).
- [x] `expire-assignments` e `notify-driver-upcoming-trips` deployadas em v2 para aceitar qualquer JWT com `role=service_role` (pelo `iss=supabase` + `role`), não só string-equal ao env var `SUPABASE_SERVICE_ROLE_KEY`. Compatível com JWT Signing Keys ES256 no novo formato.
- [x] **RLS fase 1–5 aplicado** (21/abr/2026, mesmo dia) — 5 migrations (`rls_enable_batch1_ratings_history_catalog`, `rls_enable_batch2_pricing_route_surcharges`, `rls_enable_batch3_pricing_routes`, `rls_enable_batch4_promotions`, `rls_enable_batch5_worker_ratings`). RLS ativado em 7 tabelas (`dependent_shipment_ratings`, `status_history`, `surcharge_catalog`, `pricing_route_surcharges`, `pricing_routes`, `promotions`, `worker_ratings`). Policies novas: `surcharge_catalog_authenticated_read_active`, `pricing_route_surcharges_worker_read`, `pricing_routes_client_read_active`, `promotions_authenticated_read_active`, `worker_ratings_worker_read_own`, `worker_ratings_rated_by_read_own`. Advisors `rls_disabled_in_public` caíram de 9 para 2 e `policy_exists_rls_disabled` de 8 para 1.
- [x] **RLS fase 6–7 aplicado** (21/abr/2026) — 2 migrations (`rls_enable_batch6_payouts`, `rls_enable_batch7_worker_assignments`). Em `payouts` a policy leaky `"Authenticated admin can read all payouts"` foi removida e a nova `payouts_worker_read_own` garante que cada motorista só lê os próprios registros (admins continuam via `Admin can read all payouts` + `Admin can update payouts`). Em `worker_assignments` (que não tinha **nenhuma** policy) foram criadas 4 novas antes de habilitar RLS: `worker_assignments_worker_read_own`, `worker_assignments_worker_update_own`, `worker_assignments_admin_read`, `worker_assignments_admin_update`. Advisors `rls_disabled_in_public` agora = **0** (antes 2); `policy_exists_rls_disabled` agora = **0** (antes 1). Edge Functions que operam nessas tabelas (`process-payouts`, `process-refund`, `refund-journey-start-not-accepted`, `expire-assignments`) usam `service_role` e bypassam RLS — nenhum redeploy necessário.
- [x] **Advisors residuais resolvidos** (21/abr/2026) — 3 migrations aplicadas em sequência:
  - `data_export_requests_user_read_own` — adiciona policy `USING (user_id = auth.uid())`. Resolve INFO `rls_enabled_no_policy` sem afetar a Edge Function `request-data-export` (continua usando service_role).
  - `storage_tighten_public_buckets_and_remove_catchalls` — dropa 9 policies leaky/redundantes em `storage.objects`: (i) `"all policies"` (catch-all catastrófico ALL/public/qual=null em qualquer bucket); (ii) `"all policies eqoggj_0..3"` (4 policies de CRUD público em `driver-documents`, bucket privado com CNH/CRLV/antecedentes); (iii) `"public_read_chat_attachments"` (SELECT anon em bucket privado); (iv) `"Profile avatars read"`, `"vehicles_public_read"`, `"Anyone can read payout receipts"` (SELECT amplo redundante nos 3 buckets public=true — downloads via getPublicUrl/CDN não dependem de RLS). Resolve 3 WARN `public_bucket_allows_listing` e elimina vazamentos extras não flagados pelo advisor.
  - `views_security_invoker_admin_and_driver` — `ALTER VIEW ... SET (security_invoker = true)` nas 7 views flagadas (6 admin + `driver_conversations`). Nenhuma tem caller runtime (grep em `apps/` + `supabase/functions/` retornou zero matches); são artefatos de schema. Admin session continua lendo via policies `is_admin_v2()`/`is_admin()` das base tables; motorista lê `driver_conversations` via `conversations_select`. Resolve 7 ERROR `security_definer_view`.
  - **Estado final dos advisors de segurança:** de 13 advisors (7 ERROR + 1 INFO + 4 WARN + 1 pendente manual) para **1 WARN** (`auth_leaked_password_protection`, toggle manual no Dashboard).
- [x] **Pagamentos ponta-a-ponta — Pix em envios, deduplicação de cartão, guardião de payout admin** (22/abr/2026):
  - Edge Function `charge-shipments` v7 — agora reconhece `payment_method = 'pix'` e cria PaymentIntent com `payment_method_types[]='pix'`. Se Stripe devolver `requires_action` + `pix_display_qr_code`, a função retorna `{ pix_requires_payment: true, image_url_png, hosted_voucher_url, pix_copy_paste }` para o cliente exibir. Cartão segue o caminho síncrono. Metadata `user_id` anexado a todos os PIs.
  - Edge Function `charge-booking` v10 — passa a gravar `metadata[user_id]` no PaymentIntent legado para paridade com `charge-shipments`.
  - Migration `shipment_begin_driver_require_stripe_payment` — guard na RPC `shipment_begin_driver_offering`: se o envio usa `credito`/`debito`/`pix` e ainda não tem `stripe_payment_intent_id`, a RPC devolve `{ ok: false, error: 'payment_required' }` antes de sortear motoristas. Dinheiro permanece isento.
  - Utilitário `apps/cliente/src/lib/waitForShipmentStripePaymentIntentId.ts` — polling por até 10 min nas tabelas `shipments`/`dependent_shipments` até o webhook gravar `stripe_payment_intent_id`. Usado por `ConfirmShipmentScreen` e `ConfirmDependentShipmentScreen` para o fluxo assíncrono de Pix.
  - UI `PaymentMethodSection` simplificada — removido o placeholder de "código Pix" inline e botão "Reenviar email"; descrição agora explica o fluxo Stripe Pix (copiar código → abrir voucher → pagar no banco).
  - Edge Function `save-payment-method` v15 — passou de `insert` para upsert por `(user_id, provider_id)`. Notificação "Cartão cadastrado" só dispara em inserção real.
  - Edge Function `process-payouts` v7 — admin aceito também via `user.app_metadata.role === 'admin'` ou `user.user_metadata.role === 'admin'`, além da checagem em `worker_profiles.role`.
- [x] **Storage chat-attachments endurecido** (22/abr/2026) — migration `storage_drop_leaky_chat_attachments_upload`: dropada a policy permissiva `authenticated_upload_chat_attachments` agora que `apps/admin/src/components/FileUpload.tsx` envia com path `${conversationId}/${uuid}.${ext}` e gera URL assinada. Uploads legítimos continuam via `chat_attachments insert admin support` (admin em `support_backoffice`) e `chat_attachments insert participants` (motorista/cliente em conversa ativa).
- [x] **Hardening de performance (quick wins)** (21/abr/2026) — migration `perf_fk_indexes_and_drop_duplicate`:
  - Criados 33 índices b-tree para cobrir todas as foreign keys flagadas pelo advisor `unindexed_foreign_keys` (bookings, conversations, dependent_shipments, excursion_requests, messages, platform_settings, pricing_route_surcharges, pricing_routes, promotions, shipments, status_history, worker_profiles, worker_ratings, worker_routes). Nome segue convenção `idx_<tabela>_<coluna>`, todos com `IF NOT EXISTS` para idempotência. Resolve 33 advisors INFO `unindexed_foreign_keys`.
  - Dropado `idx_trip_stops_trip` (idêntico a `idx_trip_stops_scheduled_trip_id`). Resolve 1 WARN `duplicate_index`.
  - Advisors de performance pendentes (sessão futura, risco médio/alto):
    - 99 WARN `auth_rls_initplan` em 31 tabelas — requer reescrever policies substituindo `auth.uid()` por `(SELECT auth.uid())` para evitar re-execução por linha. Grande impacto em tabelas com leituras volumosas (ex.: `messages`, `notifications`, `scheduled_trip_live_locations`).
    - 239 WARN `multiple_permissive_policies` — múltiplas policies permissivas na mesma combinação `(tabela, action, role)`. Consolidar em policies únicas com `OR` reduz overhead, mas exige auditoria cuidadosa para não perder cobertura.
    - 50 INFO `unused_index` — subiu de 17 para 50 após criação dos 33 FKs (contador zera após uso em produção; não é regressão real).

### Cron jobs ativos no projeto (`pg_cron`)

| jobid | nome | schedule | comando |
|-------|------|----------|---------|
| 1 | cleanup_old_conversations | `0 3 * * *` | `SELECT public.cleanup_old_conversations();` |
| 2 | apply_admin_auto_availability | `0 * * * *` | `SELECT public.apply_admin_auto_availability()` |
| 3 | shipment_process_expired_driver_offers | `* * * * *` | `SELECT public.shipment_process_expired_driver_offers();` |
| 4 | trigger_process_payouts | `0 9 * * *` | `SELECT public.trigger_process_payouts();` |
| 5 | expire-assignments | `*/5 * * * *` | `net.http_post` → Edge Function `expire-assignments` |
| 6 | notify-driver-upcoming-trips | `*/10 * * * *` | `net.http_post` → Edge Function `notify-driver-upcoming-trips` |

Jobs 5 e 6 usam `(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')` para montar o header `Authorization: Bearer <...>`. Para rotacionar a chave, basta `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name='service_role_key'), '<nova_chave>');` — nenhum cron precisa ser recriado.

### Pendências abertas (fora do MCP — precisam de ação manual)

1. **Dashboard Stripe** — **Concluído pelo usuário (22/abr/2026).** Webhook live + Connect Express BR + branding confirmados. Apple Pay segue opcional.
2. **Rotacionar `RESEND_API_KEY`** — **Concluído pelo usuário (22/abr/2026).** Chave antiga revogada, nova chave criada no Resend, secret atualizado via Dashboard Supabase (Functions → Secrets). Smoke test: `POST /functions/v1/send-email-verification-code {"email":"lucasazmuth@gmail.com","purpose":"password_reset"}` → HTTP 200 + e-mail entregue (logs da Edge Function v23 registraram 3.4s de execução, consistente com ida/volta ao Resend; handler só responde 200 se Resend OK).
3. **Remover `respond-assignment` do Dashboard Supabase** (opcional, mas recomendado — hoje retorna 410 e é inócua; MCP não suporta delete de Edge Function, precisa Dashboard).
4. **EAS — `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`** — **Concluído pelo usuário (22/abr/2026).** Chave correta por perfil (test/live) em builds reais.
5. **Testar deep links do motorista** (`takeme://stripe-connect-return`, `takeme://payments`) em device iOS e Android em build preview. Bloqueante para garantir onboarding Connect em produção.
6. **QA end-to-end em test mode** (checklist na seção "Checklist de configuração Stripe → passo 5", todos ainda marcados como `[ ]`). Para envios com Pix: executar o novo fluxo `charge-shipments` → webhook grava `stripe_payment_intent_id` → `shipment_begin_driver_offering` libera.
7. **Advisors pré-existentes de segurança** (progresso parcial):
   - [x] WARN `function_search_path_mutable` — 18 funções corrigidas via `ALTER FUNCTION ... SET search_path = public, pg_temp` (migration `fn_search_path_hardening`, 21/abr/2026). Cobre `compute_platform_fee_cents`, `fn_create_payouts_on_trip_complete`, `fn_cancel_payouts_on_trip_cancel`, `trigger_process_payouts`, `is_admin_v2`, `search_nearby_trips`, `admin_list_bookings/encomendas`, geradores de código, etc.
   - [x] ERROR `rls_disabled_in_public` + `policy_exists_rls_disabled` em todas as 9 tabelas — resolvido via 7 migrations `rls_enable_batch1_…` a `rls_enable_batch7_worker_assignments` (21/abr/2026). Cobriu `dependent_shipment_ratings`, `status_history`, `surcharge_catalog`, `pricing_route_surcharges`, `pricing_routes`, `promotions`, `worker_ratings`, `payouts`, `worker_assignments`. Policies novas respeitam os callers (`worker_can_read_pricing_route`, `is_active=true`, `worker_id=auth.uid()`, `rated_by=auth.uid()`, `is_admin_v2()`). Policy leaky em `payouts` removida. Advisors RLS agora = 0. Ver `docs/RLS_AUDIT.md` "Status atual".
   - [x] ERROR `security_definer_view` nas 7 views (`admin_promotion_adhesion`, `admin_passenger_demographics`, `admin_destinos_overview`, `admin_encomenda_stats`, `admin_dashboard_stats`, `driver_conversations`, `admin_worker_overview`) — resolvido em 21/abr/2026 via migration `views_security_invoker_admin_and_driver` (`ALTER VIEW ... SET (security_invoker = true)`). Nenhum app consome essas views (grep runtime vazio — são artefatos de schema para queries ad-hoc admin); com `security_invoker=true` passam a respeitar as policies RLS das base tables do caller (admin continua lendo via `is_admin()`/`is_admin_v2()`; motorista lê `driver_conversations` via `conversations_select`).
   - [x] INFO `rls_enabled_no_policy` em `data_export_requests` — resolvido em 21/abr/2026 via migration `data_export_requests_user_read_own` (`CREATE POLICY … USING (user_id = auth.uid())`). Edge Function `request-data-export` continua com service_role e bypass.
   - [x] WARN `public_bucket_allows_listing` em `avatars`, `vehicles`, `payout-receipts` — resolvido em 21/abr/2026 via migration `storage_tighten_public_buckets_and_remove_catchalls`. Também removidas: `"all policies"` (catch-all `cmd=ALL`/`roles=public`/`qual=null` que permitia qualquer anon operar em qualquer bucket), `"all policies eqoggj_0..3"` (CRUD anon em `driver-documents`) e `"public_read_chat_attachments"` (read anon em bucket privado). Policies granulares por `auth.uid()`/`is_admin()` e flag `public=true` dos 3 buckets cobrem os fluxos legítimos (getPublicUrl, uploads escopados, admin read, participantes de conversa).
   - [x] WARN `auth_leaked_password_protection` — **Ligado pelo usuário (22/abr/2026).** Verificado via MCP `get_advisors({type:'security'})` → `lints: []` (zero advisors de segurança abertos).
8. **Advisors de performance remanescentes** (risco médio/alto, sessão dedicada):
   - 99 WARN `auth_rls_initplan` — reescrever policies que chamam `auth.uid()`/`auth.role()` diretamente para usar `(SELECT auth.uid())` (evita re-execução por linha). Afeta 31 tabelas; migration grande e precisa smoke test por app (motorista/cliente/admin).
   - 239 WARN `multiple_permissive_policies` — consolidar múltiplas policies `PERMISSIVE` na mesma combinação `(tabela, action, role)` em uma única policy com `USING (cond1 OR cond2 OR ...)`. Requer auditoria cuidadosa para manter cobertura.
   - 17 INFO `unused_index` originais (não os 33 recém-criados) — avaliar drop dos que seguirem não-usados após 1–2 semanas em produção.
9. **Refactor `apps/admin/src/components/FileUpload.tsx`** — **CONCLUÍDO (22/abr/2026).**
   - Componente agora exige `pathPrefix` (repassado como `conversationId` pelo `ChatPanel`), gera path `${conversationId}/${uuid}.${ext}` e devolve URL assinada de 1 ano via `createSignedUrl`, sem `getPublicUrl` em bucket privado.
   - Migration `storage_drop_leaky_chat_attachments_upload` (aplicada em 22/abr/2026) dropa a policy `authenticated_upload_chat_attachments`. Uploads admin continuam válidos via `chat_attachments insert admin support` (conversas `support_backoffice`); apps cliente/motorista já usavam `chat_attachments insert participants`.
   - Conhecido (backlog, fora do plano): mensagens enviadas pelo admin usam `attachment_url` enquanto os apps móveis usam `attachment_path` — anexos não renderizam cross-app. Corrigir junto com padronização da coluna quando o chat entre pontas for priorizado.

### Checklist manual para go-live (tutoriais passo a passo)

Os itens desta seção precisam de acesso a consoles externos e **não** podem
ser feitos via MCP. Cada bloco traz o passo a passo exato.

#### C1. Stripe Dashboard — webhook + Connect + Apple Pay

Conta: `acct_1Sz56zRY2dpdoOzu` ("Takeme"). Faça **duas vezes**: modo test e modo live.

1. **Criar webhook endpoint**
   1. Abrir [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) (switch para o modo correto no topo — test/live).
   2. **+ Add endpoint** → URL: `https://xdxzxyzdgwpucwuaxvik.supabase.co/functions/v1/stripe-webhook`.
   3. Em "Select events to listen to" marcar exatamente:
      - `payment_intent.succeeded`
      - `payment_intent.payment_failed`
      - `charge.refunded`
      - `account.updated`
   4. Clicar "Add endpoint". Copiar o **Signing secret** (`whsec_...`).
   5. Em um terminal com Supabase CLI: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref xdxzxyzdgwpucwuaxvik`. Ou via Dashboard: [Project → Edge Functions → Secrets](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/functions/secrets).
   6. Redeploy do `stripe-webhook` para reler o segredo: `supabase functions deploy stripe-webhook --no-verify-jwt --project-ref xdxzxyzdgwpucwuaxvik`.
2. **Enviar test event**
   1. Na página do endpoint, aba "Event deliveries" → **Send test webhook** → `payment_intent.succeeded`.
   2. Deve retornar HTTP 200. Se 400 "Assinatura inválida", o `STRIPE_WEBHOOK_SECRET` no Supabase não bate com o do Dashboard — repetir passo 1.5.
   3. Conferir logs em [Supabase → Logs → Edge Functions → stripe-webhook](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/functions/stripe-webhook/logs).
3. **Connect Express BR**
   1. Abrir [dashboard.stripe.com/settings/connect](https://dashboard.stripe.com/settings/connect).
   2. "Account settings" → confirmar país suportado BR e termos aceitos.
   3. "Branding" → logo 128x128, nome `Takeme`, cor primária — isso aparece no onboarding Express.
4. **(Opcional) Apple Pay**
   1. [developer.apple.com](https://developer.apple.com/account) → Certificates, IDs & Profiles → Merchant IDs → **+** → ID: `merchant.com.takeme.cliente`.
   2. Em Stripe: [dashboard.stripe.com/settings/payments/apple_pay](https://dashboard.stripe.com/settings/payments/apple_pay) → Register new domain ou registrar merchant ID.
   3. Validar em app nativa (precisa build real — não funciona em Expo Go).

#### C2. Rotacionar `RESEND_API_KEY`

A chave anterior (`re_SmprCmr9...`) foi exposta em `apps/cliente/.env`. Revogue.

1. [resend.com/api-keys](https://resend.com/api-keys) → localizar a chave → **Revoke**.
2. **+ Create API Key** → nome `takeme-supabase-edge-prod` → Permission: `Sending access` → Domain restrito (`takeme.app` ou equivalente). Copiar `re_...`.
3. Atualizar secret no Supabase:
   ```bash
   supabase secrets set RESEND_API_KEY=re_... --project-ref xdxzxyzdgwpucwuaxvik
   ```
4. Redeploy das funções que consomem Resend:
   ```bash
   supabase functions deploy send-email-verification-code --project-ref xdxzxyzdgwpucwuaxvik
   supabase functions deploy send-welcome-email --project-ref xdxzxyzdgwpucwuaxvik
   supabase functions deploy request-data-export --project-ref xdxzxyzdgwpucwuaxvik
   supabase functions deploy complete-password-reset --project-ref xdxzxyzdgwpucwuaxvik
   supabase functions deploy send-admin-credentials --project-ref xdxzxyzdgwpucwuaxvik
   ```
5. Testar: pedir código de verificação de e-mail num dispositivo; confirmar que chega.

#### C3. EAS build + deep links + HIBP

1. **`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` por perfil**
   1. `eas.json` dos apps cliente/motorista → em `build.development.env`, `build.preview.env`, `build.production.env` definir o valor certo (`pk_test_...` em dev/preview, `pk_live_...` em production).
   2. Ou via secrets EAS (recomendado): `eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_...` e referenciar no `eas.json` com `"EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "$EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"`.
   3. Rodar `eas build -p ios --profile preview` e `eas build -p android --profile preview`.
2. **Testar deep links (motorista)**
   1. Instalar build preview no device.
   2. Iniciar onboarding Stripe Connect (tela Wallet/Pagamentos → conectar Stripe).
   3. Completar o fluxo no browser → confirmar retorno ao app via `takeme://stripe-connect-return`.
   4. Se abrir browser externo sem voltar: revisar `app.json` `scheme: "takeme"` e `intent-filter` Android / `LSApplicationQueriesSchemes` iOS.
3. **HIBP (Leaked Password Protection)**
   1. [Supabase → Auth → Providers → Email](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/auth/providers) → rolar até "Password Strength".
   2. Toggle **Leaked password protection** → Save.
   3. Confirmar advisor `auth_leaked_password_protection` desaparece em [Advisors](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/advisors).

#### C4. QA end-to-end em test mode

Rodar com cartão `4242 4242 4242 4242`, CVV qualquer, data futura (ex.: 12/30).

| # | Cenário | App | Validação |
|---|---------|-----|-----------|
| 1 | Checkout viagem | Cliente | Após sucesso: `bookings.stripe_payment_intent_id` gravado e `status='paid'`. Conferir PI no [Dashboard Stripe](https://dashboard.stripe.com/test/payments). |
| 2 | Envio (shipment) | Cliente | `shipments.stripe_payment_intent_id` gravado. Edge Function `charge-shipments` aparece em logs. |
| 3 | Envio de dependente | Cliente | `dependent_shipments.stripe_payment_intent_id` gravado. |
| 4 | Onboarding Connect | Motorista | Após voltar do deep link: `worker_profiles.stripe_connect_charges_enabled=true`. Webhook `account.updated` aparece em logs. |
| 5 | Split motorista com Connect | Sistema | Pagar viagem de motorista com Connect; confirmar `application_fee_amount` no charge (= `admin_pct` do pricing_routes). |
| 6 | Refund admin | Admin | Chamar `process-refund` via tela de gestão de pagamentos; confirmar `refunds/` no Stripe e `payouts.status='cancelled'` + `cancelled_reason='refund'`. |
| 7 | Expiry de assignment | Motorista/Cron | Criar um booking/shipment pendente com `expires_at` no passado; aguardar até 5min; confirmar `worker_assignments.status='expired'` e notificação no cliente. |
| 8 | Lembrete 1h antes | Motorista/Cron | Criar viagem `active` com `departure_at = now() + 60min`; aguardar até 10min; confirmar notificação `trip_upcoming_1h` em `notifications` + `upcoming_1h_notified_at` gravado. |

Cada cenário deve:
- retornar HTTP 200 na Edge Function correspondente;
- criar linha nova na tabela Supabase;
- criar evento correspondente no Stripe Dashboard (test mode);
- disparar notificação (quando aplicável) visível no device.

---

## 7. Estado atual / entregas recentes

### App Cliente — funcionalidades implementadas

- **Fluxos de excursão:** solicitação, orçamento, passageiros, tela de detalhes.
- **Envio de dependentes:** formulário, confirmação, detalhes com mapa, gorjeta, avaliação e cancelamento em 3 etapas (política → confirmação → execução).
- **Envio de encomendas:** formulário, confirmação, detalhes com mapa, gorjeta, avaliação.
- **Viagens:** planejamento, checkout, detalhes com mapa, avaliação.
- **LGPD:** tela "Solicitar cópia dos meus dados" com envio por e-mail (JSON + PDF) e bloqueio de 5 min.
- **Notificações:** aba "Configurar notificações" embutida.
- **Exclusão de conta:** fluxo em 2 etapas com Edge Function `delete-account`.
- **Carteira / Pagamentos:** Stripe para tokenização de cartões; validação de CPF em formulários.

### App Cliente — UI/UX recentes

- **Tela Atividades:** redesign com ícones customizados PNG por tipo de atividade, layout simplificado (lista única), header centralizado, filtro com chips horizontais e aplicação apenas ao clicar "Aplicar filtro".
- **AnimatedBottomSheet:** componente reutilizável (`src/components/AnimatedBottomSheet.tsx`) com animação suave via `Animated.View` (translateY + opacity). Substitui `Modal animationType="slide"` em toda a app.
- **SupportSheet:** bottom sheet de contato/suporte com opções configuráveis (suporte, motorista, WhatsApp). Opção "Chat com motorista" condicional (só em telas de detalhe com envio ativo).
- **FAB de chat:** botão flutuante padronizado com `icon-chat.png` em todas as telas de detalhe (envio, envio de dependente, excursão, viagem) e na tela de atividades.
- **Detalhes de envio de dependente:** redesign completo — mapa com rota/marcadores, seções de gorjeta e avaliação (com bottom sheets animados para enviar), cancelamento em 3 etapas, ícones customizados (recibo, partida, destino, gorjeta, avaliação).
- **Gorjeta e avaliação (dependent_shipments):** grava direto na tabela `dependent_shipments` (colunas `tip_cents` e `rating`), sem tabela separada de ratings. Botões "Gorjeta" e "Avaliar" aparecem apenas quando ainda não há valor.

### Mapbox — melhorias em telas de detalhe

- **Rota com duração:** `getRouteWithDuration()` e `formatDuration()` em `lib/route.ts` (OSRM).
- **Marcadores customizados:** `icon-partida.png` (origem) e `icon-destino.png` (destino) via prop `icon` do `MapboxMarker`.
- **DriverEtaMarkerIcon:** ícone de motorista com badge de ETA estimada, exibido quando o motorista está a caminho.
- **MapboxMarker refatorado:** usa `MarkerView` para todo conteúdo customizado (fix de distorção em Android com `PointAnnotation`).
- **Controles de mapa:** zoom in/out e recentralização via prop `showControls` no `MapboxMap`.
- **Validação de destino:** flag `destinationConfirmed` em `DefineDependentTripScreen`, `PlanTripScreen` e `SelectShipmentAddressScreen` para garantir coordenadas corretas.

### Supabase — atualizações recentes

**Estrutura financeira (março–abril 2026):**
- `payout_flow_v2_schema` + `payout_cron_auto_process` — payouts separando motorista Connect (pago automático) de motorista sem Connect (status `processing` para PIX manual).
- `order_pricing_snapshot_and_weekly_adjustments` — snapshot de precificação no momento da compra para auditoria.
- `promotion_adhesions` + `promotions_gain_pct` + `apply_promotion_rpc` — sistema de adesão a promoções com % de ganho por motorista.
- `worker_profiles_stripe_connect_status` — colunas `charges_enabled`/`payouts_enabled`/`details_submitted` espelhadas pelo webhook Stripe `account.updated`.

**Notificações do motorista (abril 2026):**
- `notifications_data_column` — payload `data jsonb` para deeplink (`route`, `params`).
- `should_notify_user` — RPC central que respeita `notification_preferences` + `disable_all` e sempre libera categorias `account_*`.
- `driver_notification_triggers` — 5 novas categorias (trip_started, trip_completed, trip_closed, activity_status_changed, account_approved/rejected, payment_received, booking_cancelled_by_passenger) + refresh dos 2 triggers existentes para respeitar preferências.
- Cron `notify-driver-upcoming-trips` — lembrete 1h antes via janela `[now+55, now+65]`, idempotente com `upcoming_1h_notified_at`.

**Marketplace / assignments (abril 2026):**
- `shipments_driver_offer_queue` + `shipment_same_route_haversine` + `shipment_driver_offer_window_30_minutes` — fila de oferta de envios para motoristas em viagens com rota compatível, janela de 30min.
- `cron_shipment_expired_offers` + Edge Function `expire-assignments` — expiry automático e estorno encadeado via `process-refund`.
- Edge Functions `refund-shipment-no-driver` e `refund-journey-start-not-accepted` — dois casos de estorno automatizado com Stripe Refunds.

**Suporte / atendimento:**
- `support_atendimento_conversations_core` + policies + `close_support_conversation_rpc` + `auto_support_ticket_pending_review`.

**LGPD / auth:**
- `data_export_requests` + Edge Function `request-data-export` (getClaims + Resend com JSON + PDF anexos).

---

## 8. Ícones e assets customizados

O app cliente usa ícones PNG customizados em `apps/cliente/assets/icons/`:

| Arquivo | Uso |
|---------|-----|
| `icon-chat.png` | FAB de chat (todas as telas de detalhe) |
| `icon-partida.png` | Marcador de origem no mapa |
| `icon-destino.png` | Marcador de destino no mapa |
| `icon-recibo.png` | Botão de recibo |
| `icon-sessao-gorjeta.png` | Seção de gorjeta |
| `icon-sessao-avaliacao.png` | Seção de avaliação |
| `icon-endereco-partida.png` | Endereço de partida na rota |
| `icon-endereco-destino.png` | Endereço de destino na rota |
| `icon-atividade-tipo-viagem.png` | Ícone de atividade tipo viagem |
| `icon-atividade-tipo-envio.png` | Ícone de atividade tipo envio |
| `icon-atividade-tipo-excursao.png` | Ícone de atividade tipo excursão |
| `icon-atividade-tipo-enviodependente.png` | Ícone de atividade tipo envio de dependente |

---

## 9. Componentes reutilizáveis relevantes

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| AnimatedBottomSheet | `src/components/AnimatedBottomSheet.tsx` | Bottom sheet com animação suave (translateY + opacity) |
| SupportSheet | `src/components/SupportSheet.tsx` | Sheet de contato/suporte com opções configuráveis |
| MapboxMap | `src/components/mapbox/MapboxMap.tsx` | Wrapper Mapbox com controles opcionais (zoom, recentralizar) |
| MapboxMarker | `src/components/mapbox/MapboxMarker.tsx` | Marcador Mapbox com suporte a ícones customizados |
| MapboxPolyline | `src/components/mapbox/MapboxPolyline.tsx` | Polyline para rotas no mapa |
| DriverEtaMarkerIcon | `src/components/DriverEtaMarkerIcon.tsx` | Marcador de motorista com badge de ETA |
| AddressAutocomplete | `src/components/AddressAutocomplete.tsx` | Autocomplete de endereço com sugestões |
| CalendarPicker | `src/components/CalendarPicker.tsx` | Seletor de data |
| PaymentMethodSection | `src/components/PaymentMethodSection.tsx` | Seção de método de pagamento (Stripe) |

---

## 10. Convenções e referências

- **MCP:** Supabase e Figma conforme seção MCP do [README.md](../README.md).
- **Build Android:** EAS Build ou local; ver [README.md](../README.md) (Build Android). Script `npm run android:release` na pasta `apps/cliente` faz bump automático e renomeia o APK para `take-me-cliente-{versão}.apk`. Use `SKIP_VERSION_BUMP=1` para manter a versão atual.
- **Documentação adicional:** [README.md](../README.md) (raiz), [supabase/README.md](../supabase/README.md), [supabase/EMAIL_SETUP.md](../supabase/EMAIL_SETUP.md), [EAS_BUILD.md](../apps/cliente/EAS_BUILD.md).
