# Take Me

Plataforma brasileira de mobilidade e logistica interurbana. Monorepo com 3 apps (Cliente, Motorista/Preparador, Admin) e backend Supabase.

- **Repositorio:** [github.com/FraktalSoftwares/take_me](https://github.com/FraktalSoftwares/take_me)
- **Supabase:** [Dashboard](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik) — projeto `xdxzxyzdgwpucwuaxvik`

---

## Visao geral do produto

O Take Me conecta passageiros, motoristas (frota propria e parceiros), preparadores de encomendas e preparadores de excursoes em 4 pilares de servico:

| Pilar | Descricao |
|-------|-----------|
| **Viagens agendadas** | Passageiros reservam assentos em rotas interurbanas regulares (bookings) |
| **Envio de encomendas** | Coleta e entrega de pacotes com cotacao automatica (shipments) |
| **Transporte de dependentes** | Envio de menores/idosos acompanhados (dependent_shipments) |
| **Excursoes** | Viagens em grupo com equipe, orcamento e check-in de passageiros (excursion_requests) |

### Roles do sistema

| Role | Subtype | Descricao |
|------|---------|-----------|
| `driver` | `takeme` | Motorista da frota Take Me |
| `driver` | `partner` | Motorista parceiro (terceiro) |
| `preparer` | `shipments` | Preparador de encomendas (vinculado a uma base/hub) |
| `preparer` | `excursions` | Preparador de excursoes (guia, sem veiculo) |
| — | — | `admin` (via `app_metadata.role` no Supabase Auth) |
| — | — | `passenger` (cliente, usuario padrao) |

---

## Estrutura do monorepo

| Pasta | Descricao | PRD |
|-------|-----------|-----|
| [apps/cliente](apps/cliente) | App do passageiro (Expo, mobile) | [PRD](apps/cliente/PRD.md) |
| [apps/motorista](apps/motorista) | App do motorista e preparadores (Expo, mobile) | [PRD](apps/motorista/PRD.md) |
| [apps/admin](apps/admin) | Painel administrativo (Expo Web, desktop) | [PRD](apps/admin/PRD.md) |
| [packages/shared](packages/shared) | `@take-me/shared` — Supabase client, tipos e utilitarios | — |
| [supabase](supabase) | Migrations, Edge Functions, config | — |
| [docs](docs) | Documentacao operacional e QA | — |

### Documentacao relevante

| Documento | Descricao |
|-----------|-----------|
| [docs/ESTADO_DO_PROJETO.md](docs/ESTADO_DO_PROJETO.md) | Situacao atual para onboarding |
| [docs/DATABASE (2).md](<docs/DATABASE (2).md>) | Schema completo do banco de dados |
| [docs/PAGAMENTOS_EXPLICACAO_LEIGOS.md](docs/PAGAMENTOS_EXPLICACAO_LEIGOS.md) | Fluxo financeiro em linguagem simples |
| [docs/BRANCHES.md](docs/BRANCHES.md) | Estrategia de branches e PRs |

---

## Stack tecnica

| Camada | Tecnologia |
|--------|------------|
| **Mobile** | Expo SDK 54, React Native 0.81.5, React 19.1.0, New Architecture |
| **Admin (web)** | Expo Web, React Router DOM 6, `React.createElement` (sem JSX), estilos inline |
| **Backend** | Supabase — Postgres 15+, Auth (JWT), Edge Functions (Deno/TS), Storage, Realtime |
| **Mapas (mobile)** | `@rnmapbox/maps` v10, Mapbox Directions API |
| **Mapas (admin)** | `mapbox-gl` (GL JS), Google Maps (Places + Geocoding) |
| **Rotas** | Mapbox Directions (driving-traffic), Google Directions (fallback), OSRM (fallback publico) |
| **Pagamentos** | Stripe — PaymentIntents, Customers, Connect, Refunds, Webhooks |
| **Email** | Resend (transacionais) |
| **Graficos** | Recharts 3.x (admin) |
| **Monorepo** | npm workspaces (`apps/*`, `packages/*`) |
| **Testes** | Playwright (admin E2E) |

---

## Pre-requisitos

- Node.js >= 18 (recomendado **Node 20.x** para Expo 54)
- npm (ou pnpm)
- [Expo Go](https://expo.dev/go) no celular (para testar os apps mobile)

## Configuracao

1. **Instalar dependencias** (na raiz):

```bash
npm install
```

2. **Variaveis de ambiente** — copie `.env.example` para `.env` na raiz e preencha:

| Variavel | Onde obter | Obrigatorio |
|----------|-----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | [Supabase Settings API](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/settings/api) | Sim |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mesmo link acima | Sim |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | [Mapbox Access Tokens](https://account.mapbox.com/access-tokens/) | Sim |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [Stripe API Keys](https://dashboard.stripe.com/apikeys) | Sim (cliente) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | Opcional |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings API (service_role) | Apenas scripts/Edge Functions |

Nao coloque `SUPABASE_SERVICE_ROLE_KEY` em nenhum app; use apenas em Edge Functions ou backends privados.

3. **Storage** — o app cliente usa o bucket `avatars`. Para criar automaticamente:

```bash
npm run create-avatars-bucket
```

Ou crie manualmente no [Storage](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik/storage/buckets): bucket `avatars`, publico.

## Rodar os apps

```bash
npm run cliente      # App cliente (Expo Go)
npm run motorista    # App motorista (Expo Go)
npm run admin        # Admin web (localhost)
```

---

## Modelo de dados (resumo)

### Tabelas principais

| Tabela | Descricao |
|--------|-----------|
| `profiles` | Perfil publico (1:1 com auth.users): nome, CPF, cidade, rating, stripe_customer_id |
| `worker_profiles` | Workers: role, subtype, status, dados bancarios, PIX, base_id |
| `vehicles` | Veiculos: modelo, placa, capacidade, status (pending/approved/rejected) |
| `worker_routes` | Rotas e precos configurados pelo motorista |
| `takeme_routes` | Rotas padrao da plataforma |
| `scheduled_trips` | Viagens: origem/destino, horarios, capacidade, status |
| `trip_stops` | Paradas ordenadas de uma viagem (geradas por `generate_trip_stops`) |
| `bookings` | Reservas de passageiros em viagens |
| `shipments` | Encomendas: pacote, destinatario, codigos pickup/delivery, fila de motoristas |
| `dependent_shipments` | Transporte de dependentes |
| `excursion_requests` | Excursoes: destino, orcamento (budget_lines JSONB), passageiros |
| `excursion_passengers` | Participantes de excursao com check-in/check-out |
| `promotions` | Promocoes com desconto e publico-alvo |
| `promotion_adhesions` | Adesoes a promocoes |
| `pricing_routes` | Precificacao por trecho (role_type, modo preco, percentuais) |
| `surcharge_catalog` | Sobretaxas globais (pedagio, noturno, feriado) |
| `payouts` | Repasses financeiros a workers |
| `conversations` / `messages` | Chat e suporte em tempo real |
| `bases` | Hubs fisicos da Take Me para encomendas |
| `platform_settings` | Configuracoes editaveis (preco gasolina, km) |
| `status_history` | Auditoria de mudancas de status |
| `notifications` | Notificacoes in-app |

### Status flows

**Booking:** `pending → confirmed → paid → completed / cancelled`

**Shipment:** `pending_review → confirmed → in_progress → delivered / cancelled`

**Excursion:** `pending → contacted → quoted → in_analysis → approved → scheduled → in_progress → completed / cancelled`

**Payout:** `pending → processing → paid / failed`

**Worker Assignment:** `assigned → accepted → in_progress → completed / cancelled / rejected / expired`

**Vehicle:** `pending → approved / rejected`

**Dependent:** `pending → validated`

### Cenarios de encomenda

| Cenario | Perfil do motorista | Fluxo de paradas |
|---------|-------------------|-----------------|
| 1 | Moto / Preparador encomenda | Motorista → Cliente (pickup) → Base Take Me mais proxima (dropoff) |
| 2 | Carro Take Me / Parceiro | Motorista → Cliente (pickup) → Destino final (entrega direta) |

---

## Edge Functions

| Funcao | Descricao | Usado por |
|--------|-----------|-----------|
| `charge-booking` | Cobra reserva via Stripe PaymentIntent | Cliente |
| `charge-shipments` | Cobra envio de encomenda via Stripe | Cliente |
| `confirm-code` | Verifica codigos de pickup/delivery | Motorista |
| `create-motorista-account` | Cadastro completo de motorista | Motorista |
| `delete-account` | Exclusao de conta (LGPD) com cascade | Cliente |
| `ensure-stripe-customer` | Cria/busca Stripe Customer | Cliente |
| `expire-assignments` | Expira assignments pendentes (cron 5 min) | Sistema |
| `geocode` | Geocoding via Nominatim | Admin/Sistema |
| `login-with-phone` | Login por telefone | Cliente, Motorista |
| `manage-admin-users` | CRUD de usuarios admin | Admin |
| `manage-excursion-budget` | Criar/finalizar orcamento de excursao | Admin |
| `manage-pricing-routes` | CRUD de rotas de preco com adicionais | Admin |
| `manage-promotions` | CRUD de promocoes | Admin |
| `process-payouts` | Processa repasses a workers | Admin |
| `process-refund` | Estorno via Stripe Refunds | Admin |
| `refund-shipment-no-driver` | Estorno quando nenhum motorista aceita | Sistema |
| `request-data-export` | Exportacao de dados (LGPD) — JSON + PDF | Cliente |
| `respond-assignment` | Worker aceita/rejeita assignment | Motorista |
| `save-payment-method` | Salva cartao no Stripe | Cliente |
| `send-admin-credentials` | Envia credenciais de acesso por email (Resend) | Admin |
| `send-email-verification-code` | OTP de 4 digitos para cadastro | Cliente, Motorista |
| `send-welcome-email` | Email de boas-vindas | Sistema |
| `stripe-connect-link` | Link de cadastro Stripe Connect para workers | Motorista |
| `stripe-webhook` | Webhook Stripe (payment_intent.succeeded) | Sistema |
| `verify-email-code` | Valida codigo de verificacao de email | Cliente, Motorista |

## Storage buckets

| Bucket | Publico | Uso |
|--------|---------|-----|
| `avatars` | Sim | Fotos de perfil |
| `chat-attachments` | Nao | PDFs e imagens no chat de atendimento |
| `dependent-documents` | Nao | Documentos de dependentes |
| `driver-documents` | Nao | CNH, background check, docs de veiculos |
| `excursion-passenger-docs` | Nao | Documentos de participantes de excursao |
| `shipment-photos` | Nao | Fotos de encomendas |
| `trip-expenses` | Nao | Comprovantes de despesas de viagem |
| `vehicles` | Nao | Fotos de veiculos |

## RPCs SQL

| RPC | Descricao |
|-----|-----------|
| `generate_trip_stops(trip_id)` | Gera paradas ordenadas por distancia |
| `nearest_active_base(lat, lng)` | Retorna base ativa mais proxima |
| `preparer_shipment_queue()` | Fila de encomendas para preparador da base |
| `shipment_begin_driver_offering()` | Inicia fila de ofertas a motoristas |
| `shipment_driver_accept_offer()` | Motorista aceita oferta de envio |
| `shipment_driver_pass_offer()` | Motorista recusa oferta de envio |
| `shipment_process_expired_driver_offers()` | Expira ofertas vencidas |
| `apply_active_promotion(...)` | Aplica promocao ativa a um pedido |
| `open_support_ticket(...)` | Abre ticket de suporte |
| `list_client_conversations_for_app()` | Lista conversas do cliente |
| `is_admin()` | Verifica se o usuario e admin |
| `claim_support_conversation(...)` | Admin assume conversa de suporte |
| `close_support_conversation(...)` | Finaliza conversa de suporte |
| `compute_platform_fee_cents(...)` | Calcula taxa da plataforma |

---

## Deploy Admin (Vercel)

O admin e exportado com `expo export --platform web` e configurado pelo `vercel.json` na raiz (Root Directory = `apps/admin`).

**Variaveis de ambiente na Vercel:** `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Exclusao de conta (app cliente)

Fluxo em 2 etapas: confirmacao de intencao → digitar "EXCLUIR" → Edge Function `delete-account`. Remove Storage, Stripe Customer, Auth (cascade em todas as tabelas). Detalhes no [PRD do cliente](apps/cliente/PRD.md).

## Build Android (APK/AAB)

### EAS Build (nuvem)

```bash
cd apps/cliente
eas build --platform android --profile preview
```

### Build local

```bash
cd apps/cliente
npm run android:release          # bump automatico de versao
SKIP_VERSION_BUMP=1 npm run android:release  # manter versao
```

APK em `apps/cliente/android/app/build/outputs/apk/release/take-me-cliente-{versao}.apk`.

## Branches e trabalho em equipe

Prefixos por app: `admin/`, `cliente/`, `motorista/`. Detalhes em [docs/BRANCHES.md](docs/BRANCHES.md).

## MCP

- **Supabase:** MCP user-supabase para migrations, SQL, tipos e Edge Functions. Projeto `xdxzxyzdgwpucwuaxvik`.
- **Figma (local):** Figma Desktop MCP Server em `http://127.0.0.1:3845/mcp`. Requer Figma Desktop com Dev Mode MCP Server ativado.
