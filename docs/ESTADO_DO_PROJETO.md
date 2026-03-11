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
- **Mapas:** Mapbox (`@rnmapbox/maps`) — marcadores, rotas e controles de mapa.
- **Rotas / ETA:** OSRM (Open Source Routing Machine) para polylines e duração estimada.
- **Pagamentos:** Stripe (`@stripe/stripe-react-native`) — tokenização de cartões e cobranças.
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
   - `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` — [Mapbox Access Tokens](https://account.mapbox.com/access-tokens/).
   - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` — [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys) (chave pública).
   - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — se for usar mapas Google (opcional).
   - Outras chaves opcionais conforme o `.env.example`.
3. **Não** commitar `.env` (já está no [.gitignore](../.gitignore)).
4. Opcional: `npm run sync-env` para copiar o `.env` da raiz para os apps.

---

## 5. Como rodar

- **Na raiz:** `npm run cliente`, `npm run motorista`, `npm run admin`, etc. (detalhes no [README.md](../README.md)).
- **Supabase:** aplicar migrations com `npx supabase db push`; deploy de Edge Functions conforme [supabase/README.md](../supabase/README.md).

---

## 6. Supabase — estado atual

### Migrations

Dezenas de migrations em [supabase/migrations/](../supabase/migrations/): profiles, auth, bookings, shipments, dependents, notifications, excursion_requests, excursion_passengers, data_export_requests, dependent_shipments (tip/rating/receiver), entre outras. A migration mais recente é `20250311000000_dependent_shipments_tip_rating_receiver.sql` (adiciona `tip_cents`, `rating` e `receiver_name` à tabela `dependent_shipments`).

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

**Secrets necessários:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STRIPE_SECRET_KEY` (e outros conforme cada função). Ver [supabase/README.md](../supabase/README.md).

### Auth

- Cadastro e login com e-mail (código de verificação) e login por telefone.
- JWT com JWT Signing Keys (ES256). A função `request-data-export` usa `getClaims(token)` + `admin.getUserById` para compatibilidade com o novo formato.

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

- Migration `20250311000000_dependent_shipments_tip_rating_receiver.sql` — adiciona `tip_cents`, `rating` e `receiver_name` à tabela `dependent_shipments`.
- Migration `20250308000000_data_export_requests.sql` — tabela para controle de exportação de dados.
- Edge Function `request-data-export` com getClaims + Resend (dois anexos).

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
