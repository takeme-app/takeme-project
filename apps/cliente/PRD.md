# Take Me — PRD do App Cliente (Passageiro)

> **Versao:** 1.0 | **Data:** 14/04/2026 | **Status:** Implementado
> **Stack:** React Native + Expo SDK 54 + Supabase + @rnmapbox/maps v10 + Stripe React Native + expo-location
> **Repositorio:** monorepo `take_me/apps/cliente`
> **Arquitetura:** New Architecture habilitada (`newArchEnabled=true`)
> **Referencia:** Admin PRD v2.4 (fonte de verdade para modelo de dados e regras de negocio)

---

## 1. Visao Geral

O app Take Me Cliente e o aplicativo mobile (Android/iOS) usado por passageiros para:

- **Reservar viagens** interurbanas em rotas regulares
- **Enviar encomendas** com cotacao automatica e rastreamento
- **Enviar dependentes** (menores/idosos) com acompanhamento
- **Solicitar excursoes** em grupo com orcamento personalizado
- **Gerenciar perfil**, dependentes, cartoes de pagamento e notificacoes

### 1.1 Objetivos

- Oferecer experiencia simples e rapida para reserva de viagens compartilhadas
- Permitir envio de encomendas com cotacao transparente e acompanhamento em tempo real
- Suportar multiplos metodos de pagamento (cartao, PIX, dinheiro)
- Garantir comunicacao direta com motoristas e suporte via chat
- Cumprir LGPD (exportacao de dados, exclusao de conta)

---

## 2. Autenticacao e Autorizacao

### 2.1 Fluxo de Autenticacao

```
Welcome → Login (email/senha ou telefone)
       → SignUp → VerifyEmail (OTP 4 digitos) → AddPaymentPrompt → Main
```

### 2.2 Metodos de Login

| Metodo | Implementacao |
|--------|--------------|
| Email + senha | `supabase.auth.signInWithPassword` |
| Telefone | Edge Function `login-with-phone` + `setSession` |
| Google / Apple | `oauth.ts` com `signInWithOAuth` (preparado, exibido como "em desenvolvimento") |

### 2.3 Cadastro

1. `SignUpScreen`: email, nome, telefone, senha
2. `VerifyEmailScreen`: OTP de 4 digitos via Edge Function `send-email-verification-code`
3. Confirmacao via `verify-email-code` (grava nome e telefone no perfil)
4. `signInWithPassword` automatico apos verificacao
5. `AddPaymentPromptScreen`: convite para cadastrar cartao (opcional, pode pular)

### 2.4 Recuperacao de Senha

```
ForgotPassword → ForgotPasswordEmailSent → (link magico) → ResetPassword → ResetPasswordSuccess
```

Deep link scheme: `take-me-cliente` (configurado em `App.tsx` para capturar tokens na URL).

### 2.5 Sessao

- Persistencia via `AsyncStorage` (Supabase Auth)
- Refresh automatico com `onAuthStateChange`
- `AuthRecoveryHandler`: intercepta deep links de recuperacao de senha

### 2.6 Telas Publicas

| Tela | Descricao |
|------|-----------|
| `WelcomeScreen` | Landing com CTA login/cadastro |
| `LoginScreen` | Email + senha, telefone, OAuth (em desenvolvimento) |
| `SignUpScreen` | Formulario de cadastro |
| `VerifyEmailScreen` | Inserir OTP recebido por email |
| `ForgotPasswordScreen` | Solicitar reset |
| `ForgotPasswordEmailSentScreen` | Confirmacao de envio |
| `ResetPasswordScreen` | Nova senha via deep link |
| `ResetPasswordSuccessScreen` | Confirmacao de reset |
| `TermsOfUseScreen` | Termos de uso |
| `PrivacyPolicyScreen` | Politica de privacidade |

---

## 3. Navegacao

### 3.1 Root Stack

```
Splash → Welcome → Login/SignUp/VerifyEmail → AddPaymentPrompt → Main
                                                                → TripStack
                                                                → ShipmentStack
                                                                → DependentShipmentStack
                                                                → ExcursionStack
                                                                → ForgotPassword flow
                                                                → Terms/Privacy
```

### 3.2 Main Tabs (4 abas)

| Aba | Tela | Icone | Descricao |
|-----|------|-------|-----------|
| Inicio | `HomeScreen` | `home` | Busca de destino, destinos recentes, servicos rapidos |
| Servicos | `ServicesScreen` | `apps` | Grid de servicos (viagens, envios, dependentes, excursoes) |
| Atividades | `ActivitiesStack` | `receipt` | Historico unificado de todas as atividades |
| Perfil | `ProfileStack` | `person-outline` | Dados pessoais, carteira, dependentes, configuracoes |

### 3.3 Trip Stack (Viagens)

| Tela | Descricao |
|------|-----------|
| `WhenNeeded` | Escolha: "Agora" ou "Agendar" |
| `PlanTrip` | Origem e destino com autocomplete |
| `PlanRide` | Configurar viagem com mapa |
| `ChooseTime` | Selecao de data e horario |
| `SearchTrip` | Lista de viagens disponiveis (filtro por distancia ~15km) |
| `ConfirmDetails` | Passageiros, malas, CPF; validacao de capacidade |
| `Checkout` | Resumo, metodo de pagamento, promocao, cobranca |
| `PaymentConfirmed` | Confirmacao com atalho para acompanhamento |
| `DriverOnTheWay` | Motorista a caminho com mapa |
| `TripInProgress` | Viagem em andamento |
| `RateTrip` | Avaliacao (1-5 estrelas + comentario) |

### 3.4 Shipment Stack (Envios)

| Tela | Descricao |
|------|-----------|
| `SelectShipmentAddress` | Origem, destino, tamanho do pacote, quando |
| `Recipient` | Dados do destinatario + cotacao automatica |
| `SelectShipmentDriver` | Escolha de motorista (quando sem base na regiao) |
| `ConfirmShipment` | Resumo e pagamento |
| `ShipmentSuccess` | Confirmacao com ID do pedido |

### 3.5 Dependent Shipment Stack (Envio de Dependentes)

| Tela | Descricao |
|------|-----------|
| `DependentShipmentForm` | Nome, telefone, malas, instrucoes |
| `AddDependent` | Cadastro de novo dependente |
| `DependentSuccess` | Dependente cadastrado |
| `DefineDependentTrip` | Origem, destino, data da viagem |
| `ConfirmDependentShipment` | Resumo e confirmacao |
| `DependentShipmentSuccess` | Confirmacao com ID |

### 3.6 Excursion Stack (Excursoes)

| Tela | Descricao |
|------|-----------|
| `ExcursionRequestForm` | Destino, datas, numero de pessoas, tipo de frota |
| `ExcursionSuccess` | Solicitacao enviada |

### 3.7 Activities Stack (Atividades)

| Tela | Descricao |
|------|-----------|
| `ActivitiesList` | Feed unificado (viagens, envios, dependentes, excursoes) com filtros por chip |
| `TravelHistory` | Historico de viagens |
| `TripDetail` | Detalhe de viagem com mapa, rota, cancelamento |
| `DriverOnTheWay` | Acompanhamento: motorista a caminho |
| `TripInProgress` | Acompanhamento: viagem em andamento |
| `RateTrip` | Avaliacao de viagem |
| `ShipmentDetail` | Detalhe de envio com mapa e rastreamento |
| `ShipmentTip` | Gorjeta para motorista do envio |
| `ShipmentRating` | Avaliacao do envio (1-5 estrelas) |
| `Chat` | Chat com motorista/suporte |
| `ExcursionDetail` | Detalhe da excursao |
| `ExcursionBudget` | Orcamento da excursao |
| `ExcursionPassengerList` | Lista de passageiros da excursao |
| `ExcursionPassengerForm` | Cadastro de passageiro na excursao |
| `DependentShipmentDetail` | Detalhe do envio de dependente |

### 3.8 Profile Stack

| Tela | Descricao |
|------|-----------|
| `ProfileMain` | Grid de opcoes do perfil |
| `PersonalInfo` | Dados pessoais (nome, email, telefone, CPF, cidade) |
| `Wallet` | Cartoes salvos |
| `About` | Sobre o app |
| `Notifications` | Central de notificacoes |
| `ConfigureNotifications` | Preferencias de notificacao |
| `Dependents` | Lista de dependentes |
| `DependentDetail` | Detalhe do dependente |
| `AddDependent` | Cadastrar dependente |
| `Conversations` | Lista de conversas |
| `Chat` | Chat individual |
| `AddPaymentMethod` | Tipo de cartao (credito/debito) |
| `AddCard` | Formulario Stripe para novo cartao |
| `CardRegisteredSuccess` | Cartao salvo com sucesso |
| `EditName/Email/Phone/Cpf/Location` | Edicao de campos individuais (modais) |
| `ChangePassword` | Alterar senha |
| `EditAvatar` | Alterar foto de perfil |
| `DeleteAccountStep1` | Confirmacao de intencao |
| `DeleteAccountStep2` | Digitar "EXCLUIR" e confirmar |
| `DeleteDependent` | Remover dependente |
| `DeleteCard` | Remover cartao |
| `TermsOfUse` / `PrivacyPolicy` | Documentos legais |
| `CancellationPolicy` | Politica de cancelamento |
| `ConsentTerm` | Termo de consentimento |

---

## 4. Regras de Negocio

### 4.1 Viagens

**Busca de viagens (`clientScheduledTrips.ts`):**
- Filtra `scheduled_trips` ativas, futuras, com lugares disponiveis
- Ordena por `compareTripsByDepartureAndBadge` (horario, depois badge "Take Me" primeiro)
- Verifica capacidade com `tripFitsPassengersAndBags`

**Preco (`resolveTripPriceCents`):**
- Prioriza `worker_routes.price_per_person_cents` do motorista
- Fallback para campos da `scheduled_trip`

**Busca geografica (`SearchTripScreen`):**
- Filtro por distancia ~15km (em graus) entre destino buscado e destino da viagem

### 4.2 Checkout de Viagem

1. Recalcula preco pelo `scheduled_trip_id`
2. Aplica promocao via RPC `apply_active_promotion` (tipo `bookings`)
3. **Cartao:** `ensure-stripe-customer` → `charge-booking` (cria booking no servidor, retorna `booking_id`)
4. **PIX / Dinheiro:** `INSERT` em `bookings` com `status: 'pending'` e snapshot de preco (`orderPricingSnapshot.ts`)

**Snapshot de preco:** No momento da reserva, grava `subtotal_cents`, `platform_fee_cents`, `admin_pct_applied` no booking. Valores imutaveis apos criacao.

### 4.3 Cancelamento de Viagem

- Via `TripDetailScreen`: atualiza `bookings.status = 'cancelled'`
- Abre ticket de suporte automatico (categoria `reembolso`)

### 4.4 Envio de Encomendas

**Cotacao (`shipmentQuote.ts`):**
- Busca `pricing_routes` compativel com a rota
- Calcula preco base + ajuste por tamanho do pacote
- Aplica taxa da plataforma (`admin_pct`)

**Resolucao de base (`resolveShipmentBase.ts`):**
- Verifica se a cidade de origem tem base ativa (`bases`)
- Com base → envio vai para preparador (sem escolha de motorista)
- Sem base → cliente escolhe motorista preferido

**Confirmacao (`ConfirmShipmentScreen`):**
- `INSERT` em `shipments` com dados completos
- Upload opcional de foto para `shipment-photos`
- Se tem motorista preferido e sem hub: RPC `shipment_begin_driver_offering`
- Pagamento com cartao: Edge Function `charge-shipments`
- Se pagamento falhar: cancela o envio

**Estorno automatico:**
- Se nenhum motorista aceitar: Edge Function `refund-shipment-no-driver`

### 4.5 Envio de Dependentes

- Formulario com dados do dependente (nome, telefone, malas, instrucoes)
- Vincula a `dependents` existente ou cadastra novo
- `INSERT` em `dependent_shipments`
- Gorjeta e avaliacao gravadas diretamente na tabela (`tip_cents`, `rating`)

### 4.6 Excursoes

- Formulario: destino, datas, numero de pessoas, tipo de frota
- `INSERT` em `excursion_requests` com `status: 'pending'`
- Acompanhamento via Atividades (detalhe, orcamento, passageiros)

### 4.7 Avaliacoes

| Tipo | Tabela | Tela |
|------|--------|------|
| Viagem | `booking_ratings` | `RateTripScreen` (upsert por `booking_id`) |
| Envio | `shipment_ratings` | `ShipmentRatingScreen` |
| Dependente | `dependent_shipments.rating` (coluna direta) | `DependentShipmentDetailScreen` |

### 4.8 Destinos Recentes

- Tabela `recent_destinations` por usuario
- Hook `useRecentDestinationsSorted` para exibir na Home

### 4.9 Exclusao de Conta (LGPD)

1. `DeleteAccountStep1Screen`: confirmacao de intencao
2. `DeleteAccountStep2Screen`: digitar "EXCLUIR"
3. Edge Function `delete-account`:
   - Remove objetos do Storage (avatars, dependent-documents, shipment-photos, excursion-passenger-docs)
   - Deleta Stripe Customer (se existir)
   - `admin.auth.admin.deleteUser` → cascade em todas as tabelas
4. SignOut e redirect para Splash

### 4.10 Exportacao de Dados (LGPD)

- Edge Function `request-data-export`
- Envia JSON + PDF por email (Resend)
- Bloqueio de 5 minutos entre solicitacoes

---

## 5. Pagamentos

### 5.1 Stripe React Native

- `@stripe/stripe-react-native` com `StripeProvider` em `App.tsx`
- Token: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Bridge nativo (`stripeNativeBridge.tsx`): ativo apenas em dev builds; fallback de UI em Expo Go

### 5.2 Fluxo de Cartao

1. `AddPaymentMethodScreen`: escolha credito/debito
2. `AddCardScreen`: `createPaymentMethod` via Stripe SDK
3. Edge Function `save-payment-method`: salva no Stripe e em `payment_methods`
4. Cartoes salvos visiveis em `WalletScreen`

### 5.3 Metodos de Pagamento

| Metodo | Viagens | Envios | Dependentes |
|--------|---------|--------|-------------|
| Cartao (credito/debito) | Sim (Stripe) | Sim (Stripe) | Sim (Stripe) |
| PIX | Sim (insert direto, sem cobranca automatica) | Placeholder | Placeholder |
| Dinheiro | Sim (insert direto) | — | — |

### 5.4 Stripe Customer

- Edge Function `ensure-stripe-customer`: cria ou busca customer
- `stripe_customer_id` salvo em `profiles`
- Necessario antes de qualquer cobranca com cartao

---

## 6. Mapas e Localizacao

### 6.1 Configuracao

- Biblioteca: `@rnmapbox/maps` v10 (requer New Architecture)
- Token: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
- Componentes em `src/components/mapbox/`

### 6.2 Componentes de Mapa

| Componente | Descricao |
|------------|-----------|
| `MapboxMap.tsx` | Wrapper com controles opcionais (zoom, recentralizar) |
| `MapboxMarker.tsx` | Marcador com suporte a icones customizados |
| `MapboxPolyline.tsx` | Polyline para rotas GeoJSON |
| `DriverEtaMarkerIcon.tsx` | Icone de motorista com badge de ETA |

### 6.3 Rotas (`lib/route.ts`)

- `getRouteWithDuration()`: Mapbox Directions API (driving-traffic)
- Fallback: OSRM publico com timeout
- `formatDuration()` / `formatEta()`: formatacao de tempo estimado

### 6.4 Localizacao

- `expo-location` com `CurrentLocationContext`
- `requestForegroundPermissionsAsync`
- `getCurrentPositionAsync` para posicao inicial

### 6.5 Marcadores Customizados

| Icone | Uso |
|-------|-----|
| `icon-partida.png` | Marcador de origem no mapa |
| `icon-destino.png` | Marcador de destino no mapa |
| `icon-chat.png` | FAB de chat em telas de detalhe |

---

## 7. Chat e Suporte

### 7.1 Conversas

- `chatConversations.ts`: garante conversa passageiro-motorista
- RPC `list_client_conversations_for_app` (fallback REST com `.or()` em participantes)
- `ConversationsScreen`: lista de conversas com Realtime

### 7.2 Chat em Tempo Real

- `ChatScreen`: canal Supabase Realtime `chat:${conversationId}`
- `postgres_changes` em `INSERT` na tabela `messages`
- Suporte a texto, imagens e PDFs

### 7.3 Suporte

- `SupportSheet`: bottom sheet com opcoes (suporte, motorista, WhatsApp)
- `supportTickets.ts`: RPC `open_support_ticket`
- FAB de chat em todas as telas de detalhe

---

## 8. Integracao com Supabase Realtime

| Canal | Tabela | Tela |
|-------|--------|------|
| `chat:${conversationId}` | `messages` (INSERT) | `ChatScreen` |
| `client-conversations-list:${clientId}` | `conversations` | `ConversationsScreen` |
| `shipment-detail-${shipmentId}` | `shipments` | `ShipmentDetailScreen` |

---

## 9. Modelo de Dados Relevante

### 9.1 Tabelas Principais

| Tabela | Uso no app |
|--------|-----------|
| `profiles` | Nome, avatar, CPF, cidade, rating, stripe_customer_id |
| `bookings` | Reservas de viagem com status e pagamento |
| `scheduled_trips` | Viagens disponiveis para reserva |
| `worker_routes` | Rotas e precos dos motoristas |
| `shipments` | Encomendas com cotacao, codigos e rastreamento |
| `dependent_shipments` | Envios de dependentes com gorjeta e avaliacao |
| `excursion_requests` | Solicitacoes de excursao |
| `excursion_passengers` | Participantes de excursao |
| `payment_methods` | Cartoes salvos no Stripe |
| `dependents` | Dependentes cadastrados (menores/idosos) |
| `conversations` / `messages` | Chat com motoristas e suporte |
| `notifications` | Notificacoes in-app |
| `notification_preferences` | Preferencias de notificacao |
| `recent_destinations` | Destinos recentes do usuario |
| `booking_ratings` | Avaliacoes de viagem |
| `shipment_ratings` | Avaliacoes de envio |
| `pricing_routes` | Precificacao para cotacao de envios |
| `bases` | Hubs para resolucao de envios |
| `user_preferences` | Preferencias do usuario |
| `promotions` | Promocoes disponiveis |

### 9.2 RPCs SQL Utilizadas

| RPC | Chamada em | Descricao |
|-----|------------|-----------|
| `apply_active_promotion` | `CheckoutScreen` | Aplica desconto de promocao ativa |
| `shipment_begin_driver_offering` | `ConfirmShipmentScreen` | Inicia fila de ofertas a motoristas |
| `open_support_ticket` | `supportTickets.ts` | Abre ticket de suporte |
| `list_client_conversations_for_app` | `chatConversations.ts` | Lista conversas do cliente |

### 9.3 Edge Functions Utilizadas

| Funcao | Chamada em | Descricao |
|--------|------------|-----------|
| `login-with-phone` | `LoginScreen` | Login por telefone |
| `send-email-verification-code` | `SignUpScreen` | OTP de 4 digitos |
| `verify-email-code` | `VerifyEmailScreen` | Valida OTP |
| `ensure-stripe-customer` | `CheckoutScreen` | Cria/busca Stripe Customer |
| `charge-booking` | `CheckoutScreen` | Cobra reserva de viagem |
| `charge-shipments` | `ConfirmShipmentScreen` | Cobra envio de encomenda |
| `save-payment-method` | `AddCardScreen` | Salva cartao no Stripe |
| `refund-shipment-no-driver` | Sistema (callback) | Estorno quando nenhum motorista aceita |
| `delete-account` | `DeleteAccountStep2Screen` | Exclusao de conta LGPD |
| `request-data-export` | `ProfileScreen` | Exportacao de dados LGPD |

---

## 10. Componentes Reutilizaveis

| Componente | Arquivo | Descricao |
|------------|---------|-----------|
| `AnimatedBottomSheet` | `src/components/AnimatedBottomSheet.tsx` | Bottom sheet com animacao suave (translateY + opacity) |
| `SupportSheet` | `src/components/SupportSheet.tsx` | Sheet de contato/suporte com opcoes configuraveis |
| `MapboxMap` | `src/components/mapbox/MapboxMap.tsx` | Wrapper Mapbox com controles (zoom, recentralizar) |
| `MapboxMarker` | `src/components/mapbox/MapboxMarker.tsx` | Marcador com icones customizados |
| `MapboxPolyline` | `src/components/mapbox/MapboxPolyline.tsx` | Polyline para rotas |
| `DriverEtaMarkerIcon` | `src/components/DriverEtaMarkerIcon.tsx` | Marcador de motorista com ETA |
| `AddressAutocomplete` | `src/components/AddressAutocomplete.tsx` | Autocomplete de endereco |
| `CalendarPicker` | `src/components/CalendarPicker.tsx` | Seletor de data |
| `PaymentMethodSection` | `src/components/PaymentMethodSection.tsx` | Secao de metodo de pagamento (Stripe) |

---

## 11. Seguranca

- RLS ativa em todas as tabelas
- Cliente so ve seus proprios dados (`user_id = auth.uid()`)
- Tokens Stripe nunca expostos no cliente (apenas publishable key)
- Deep link scheme `take-me-cliente` para recuperacao de senha
- Codigos de pickup/delivery nunca exibidos ao cliente (apenas ao motorista/destinatario)

---

## 12. Status de Implementacao

### Implementado e Funcional

- [x] Autenticacao completa (login email/senha, telefone, cadastro com OTP, reset de senha)
- [x] Navegacao com 4 tabs + stacks dedicados para cada servico
- [x] Fluxo completo de viagens (busca, selecao, checkout, pagamento, acompanhamento, avaliacao)
- [x] Fluxo completo de envio de encomendas (cotacao, confirmacao, pagamento, rastreamento)
- [x] Fluxo completo de envio de dependentes (formulario, confirmacao, gorjeta, avaliacao)
- [x] Fluxo de excursoes (solicitacao, acompanhamento via Atividades)
- [x] Pagamento com cartao via Stripe (viagens e envios)
- [x] Carteira com cartoes salvos (adicionar, listar, remover)
- [x] Chat em tempo real com motoristas e suporte (Supabase Realtime)
- [x] Mapas Mapbox com rotas, marcadores customizados e controles
- [x] Atividades: feed unificado com filtros por tipo
- [x] Perfil completo (dados pessoais, avatar, dependentes, notificacoes)
- [x] Exclusao de conta LGPD (2 etapas + Edge Function)
- [x] Exportacao de dados LGPD (JSON + PDF por email)
- [x] Destinos recentes na Home
- [x] Avaliacoes de viagem e envio
- [x] Cancelamento de viagem com ticket de reembolso
- [x] AnimatedBottomSheet e SupportSheet reutilizaveis
- [x] Validacao de CPF em formularios

### Em Desenvolvimento / Pendente

- [ ] OAuth (Google/Apple): fluxo tecnico preparado em `oauth.ts`, UI exibe "em desenvolvimento"
- [ ] PIX como metodo de pagamento real (hoje e insert direto sem cobranca automatica)
- [ ] Push notifications nativas (`expo-notifications` nao esta nas dependencias)
- [ ] Tracking em tempo real da posicao do motorista (telas de acompanhamento usam dados estaticos)
- [ ] Acompanhamento de envio de dependente em tempo real

---

## 13. Variaveis de Ambiente

| Variavel | Uso |
|----------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | Cliente Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox (@rnmapbox/maps) + Directions API |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe React Native |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps (opcional, fallback) |

---

## 14. Glossario

| Termo | Descricao |
|-------|-----------|
| **Take Me** | Frota propria da plataforma (`subtype = 'takeme'`) |
| **Motorista Parceiro** | Motorista terceiro (`subtype = 'partner'`) |
| **Booking** | Reserva de assento em viagem agendada |
| **Shipment** | Envio de encomenda (pacote) |
| **Dependent Shipment** | Transporte de menor/idoso |
| **Excursion Request** | Solicitacao de excursao em grupo |
| **Pricing Route** | Configuracao de preco para um trecho (usada na cotacao de envios) |
| **Base/Hub** | Ponto fisico da Take Me onde encomendas sao transferidas |
| **Snapshot de preco** | Valores congelados no momento da reserva (imutaveis) |
| **OTP** | One-Time Password — codigo de 4 digitos enviado por email |
| **Deep link** | URL scheme `take-me-cliente://` para recuperacao de senha |
| **AnimatedBottomSheet** | Componente de bottom sheet com animacao suave |
| **SupportSheet** | Bottom sheet de contato/suporte com opcoes configuraveis |
