# Estado do projeto Take Me

Documento de situação atual para onboarding de novos desenvolvedores. Atualizado conforme o estado do repositório e do projeto Supabase.

---

## 1. Visão geral

- **Projeto:** Take Me — monorepo com 5 ambientes (Cliente, Motorista, Preparador Encomendas, Preparador Excursões, Admin).
- **Repositório:** [github.com/FraktalSoftwares/take_me](https://github.com/FraktalSoftwares/take_me)
- **Supabase:** projeto `xdxzxyzdgwpucwuaxvik` — [Dashboard](https://supabase.com/dashboard/project/xdxzxyzdgwpucwuaxvik)

---

## 2. Stack e ferramentas

- **Frontend:** Expo (React Native) para mobile; Expo Web para admin.
- **Backend / BaaS:** Supabase (Auth, Postgres, Storage, Edge Functions, RLS).
- **Monorepo:** npm workspaces (`apps/*`, `packages/*`); pacote compartilhado em [packages/shared](../packages/shared).
- **Requisitos:** Node >= 18 (recomendado Node 20 para Expo 54), npm ou pnpm.

---

## 3. Estrutura do repositório

| Pasta | Descrição |
|-------|-----------|
| **apps/cliente** | App do passageiro (viagens, envios, excursões, perfil, notificações, LGPD) |
| **apps/motorista** | App do motorista |
| **apps/preparador-encomendas** | App do preparador de encomendas |
| **apps/preparador-excursoes** | App do preparador de excursões |
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
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — se for usar mapas Google.
   - Outras chaves opcionais (Stripe, Mapbox, scheme do app) conforme o `.env.example`.
3. **Não** commitar `.env` (já está no [.gitignore](../.gitignore)).
4. Opcional: `npm run sync-env` para copiar o `.env` da raiz para os apps.

---

## 5. Como rodar

- **Na raiz:** `npm run cliente`, `npm run motorista`, `npm run admin`, etc. (detalhes no [README.md](../README.md)).
- **Supabase:** aplicar migrations com `npx supabase db push`; deploy de Edge Functions conforme [supabase/README.md](../supabase/README.md).

---

## 6. Supabase — estado atual

### Migrations

Dezenas de migrations em [supabase/migrations/](../supabase/migrations/): profiles, auth, bookings, shipments, dependents, notifications, excursion_requests, excursion_passengers, data_export_requests, entre outras. O projeto remoto já teve `db push` aplicado (incluindo `20250308000000_data_export_requests.sql`).

### Edge Functions

| Função | Uso |
|--------|-----|
| send-welcome-email | E-mail de boas-vindas |
| send-email-verification-code | Código de verificação de e-mail |
| verify-email-code | Validação do código |
| login-with-phone | Login por telefone |
| delete-account | Exclusão de conta |
| ensure-stripe-customer | Cliente Stripe |
| charge-booking | Cobrança de reserva |
| save-payment-method | Salvar método de pagamento |
| **request-data-export** | Cópia dos dados (LGPD) — JSON + PDF por e-mail, bloqueio 5 min |

**Secrets necessários:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (e outros conforme cada função). Ver [supabase/README.md](../supabase/README.md).

### Auth

- Cadastro e login com e-mail (código de verificação) e login por telefone.
- JWT com JWT Signing Keys (ES256). A função `request-data-export` usa `getClaims(token)` + `admin.getUserById` para compatibilidade com o novo formato.

---

## 7. Estado atual / entregas recentes

- **App Cliente:** fluxos de excursão (solicitação, orçamento, passageiros), envio de dependentes, tela “Solicitar cópia dos meus dados” (LGPD) com envio por e-mail (JSON + PDF) e bloqueio de 5 min; notificações com aba “Configurar notificações” embutida (sem botão “Abrir configurações”); títulos em Configurar notificações com Inter 24px, peso 600.
- **Supabase:** migration `data_export_requests`, Edge Function `request-data-export` com getClaims + Resend (dois anexos).

---

## 8. Convenções e referências

- **MCP:** Supabase e Figma conforme seção MCP do [README.md](../README.md).
- **Build Android:** EAS Build ou local; ver [README.md](../README.md) (Build Android).
- **Documentação adicional:** [README.md](../README.md) (raiz), [supabase/README.md](../supabase/README.md), [supabase/EMAIL_SETUP.md](../supabase/EMAIL_SETUP.md).
