# Take Me — PRD do App Motorista

> **Versao:** 1.2 | **Data:** 14/04/2026 | **Status:** Em desenvolvimento
> **Stack:** React Native + Expo SDK 54 + Supabase + @rnmapbox/maps v10 + expo-location
> **Repositorio:** monorepo `take_me/apps/motorista`
> **Arquitetura:** New Architecture habilitada (`newArchEnabled=true`)
> **Referencia:** Admin PRD v2.4 (fonte de verdade para modelo de dados e regras de negocio)

---

## 1. Visao Geral

O app Take Me Motorista e o aplicativo mobile (Android/iOS) usado por tres perfis de trabalhadores da plataforma:

| Perfil | `worker_profiles.role` | `worker_profiles.subtype` |
|--------|----------------------|--------------------------|
| Motorista Take Me | `driver` | `takeme` |
| Motorista Parceiro | `driver` | `partner` |
| Preparador de Encomendas | `preparer` | `shipments` |
| Preparador de Excursoes | `preparer` | `excursions` |

> **Atencao:** Os valores de `subtype` no banco sao `takeme` (nao `take_me`), `shipments` (nao `package_preparer`) e `excursions` (nao `excursion_preparer`). Sempre usar os valores do banco real.

Cada perfil tem um ambiente (stack de navegacao) dedicado com telas e fluxos especificos.

---

## 2. Autenticacao e Autorizacao

### 2.1 Fluxo de Autenticacao

```
Welcome → SignUpType → SignUp → VerifyEmail → CompleteDriverRegistration
       → FinalizeRegistration → RegistrationSuccess
```

- Email + senha via Supabase Auth
- OTP de 4 digitos enviado por email (Edge Function `send-email-verification-code`)
- Cadastro completo cria `worker_profiles` + `vehicles` + `worker_routes`
- Edge Function: `create-motorista-account`

### 2.2 Guard de Sessao (SplashScreen)

Ao iniciar:
1. Verifica sessao Supabase ativa
2. Busca `worker_profiles.status` e `worker_profiles.role`/`subtype` do usuario logado
3. Redireciona para o ambiente correto:
   - `status !== 'approved'` → `MotoristaPendingApproval`
   - `role === 'driver'` → `Main` (ambiente motorista)
   - `subtype === 'shipments'` → `MainEncomendas`
   - `subtype === 'excursions'` → `MainExcursoes`

### 2.3 Telas Publicas

| Tela | Descricao |
|------|-----------|
| `WelcomeScreen` | Landing com CTA login/cadastro |
| `LoginScreen` | Email + senha |
| `SignUpTypeScreen` | Escolha do tipo de conta |
| `SignUpScreen` | Formulario basico |
| `VerifyEmailScreen` | Inserir OTP recebido por email |
| `ForgotPasswordScreen` | Solicitar reset |
| `ForgotPasswordEmailSentScreen` | Confirmacao de envio |
| `ResetPasswordScreen` | Nova senha via link magico |
| `ResetPasswordSuccessScreen` | Confirmacao de reset |

---

## 3. Ambientes e Navegacao

### 3.1 Ambiente Motorista (`Main`)

**Navbar inferior:** Home | Pagamentos | Atividades | Perfil

| Aba | Tela | Descricao |
|-----|------|-----------|
| Home | `HomeScreen` | Viagem ativa, acesso rapido, toggle disponibilidade |
| Pagamentos | `PaymentsScreen` | Resumo financeiro e historico de payouts |
| Atividades | `ActivitiesScreen` | Feed de atividades recentes |
| Perfil | Stack `ProfileStack` | Configuracoes, rotas, veiculos, documentos |

**Telas modais / push (RootStack):**

| Tela | Rota | Descricao |
|------|------|-----------|
| `PendingRequestsScreen` | `PendingRequests` | Solicitacoes pendentes de aceite |
| `TripDetailScreen` | `TripDetail` | Detalhe de viagem agendada |
| `ActiveTripScreen` | `ActiveTrip` | Viagem em execucao (mapa ao vivo) |
| `TripHistoryScreen` | `TripHistory` | Historico de viagens concluidas |
| `PaymentHistoryScreen` | `PaymentHistory` | Historico de pagamentos |

### 3.2 Ambiente Preparador de Encomendas (`MainEncomendas`)

**Navbar inferior:** Home | Coletas | Historico | Pagamentos | Perfil

| Tela | Descricao |
|------|-----------|
| `HomeEncomendasScreen` | Solicitacoes pendentes de aceite (encomendas sem motorista) |
| `ColetasEncomendasScreen` | Encomenda ativa + historico recente |
| `DetalhesEncomendaScreen` | Detalhe de encomenda especifica |
| `ActiveShipmentScreen` | Encomenda em execucao (mapa ao vivo + confirmacao de codigos) |
| `HistoricoEncomendasScreen` | Historico completo de entregas |
| `PagamentosEncomendasScreen` | Resumo financeiro |
| `PerfilEncomendasScreen` | Perfil e configuracoes |

### 3.3 Ambiente Preparador de Excursoes (`MainExcursoes`)

**Navbar inferior:** Home | Coletas | Historico | Pagamentos | Perfil

| Tela | Descricao |
|------|-----------|
| `HomeExcursoesScreen` | Excursoes ativas e agendadas |
| `ColetasExcursoesScreen` | Lista de excursoes filtrada por status |
| `DetalhesExcursaoScreen` | Detalhe com mapa, passageiros, check-in/out |
| `HistoricoExcursoesScreen` | Historico de excursoes concluidas |
| `PagamentosExcursoesScreen` | Resumo financeiro |
| `PerfilExcursoesScreen` | Perfil e configuracoes |

---

## 4. Regras de Negocio

### 4.1 Worker Assignments

Todo trabalho e atribuido via tabela `worker_assignments`:

```
assigned → accepted → in_progress → completed
                   ↘ cancelled / rejected / expired
```

- **assigned:** Admin ou sistema cria o assignment com `expires_at`
- **accepted:** Worker aceita via `respond-assignment` Edge Function
- **rejected:** Worker rejeita → Edge Function processa estorno Stripe automaticamente
- **expired:** Cron `expire-assignments` (5 min) expira assignments nao aceitos → estorno automatico
- **in_progress:** Status atualizado quando viagem/encomenda e iniciada
- **completed:** Atualizado ao final da viagem/entrega

O `PendingRequestsScreen` exibe assignments com `status = 'assigned'` para o worker logado, mostrando contagem regressiva ate `expires_at`.

### 4.2 Viagens (Motoristas) — trip_stops

A tabela `trip_stops` e a fonte de verdade para a ordem de paradas em uma viagem. Gerada pela function SQL `generate_trip_stops(trip_id)`:

| `sequence_order` | `stop_type` | Descricao |
|-----------------|-------------|-----------|
| 0 | `driver_origin` | Ponto de saida do motorista |
| 1..N | `passenger_pickup` | Embarque de cada passageiro (ordenado por distancia) |
| N+1..M | `shipment_pickup` | Coleta de encomendas vinculadas |
| M+1 | `base_dropoff` | Apenas Cenario 1 de encomendas |
| Last | `trip_destination` | Destino final da viagem |

**Status de cada stop:** `pending → arrived → completed / skipped`

**Fluxo no `ActiveTripScreen`:**
1. Ao montar: busca `trip_stops` via hook `useTripStops`; se nao existirem, chama `generate_trip_stops(trip_id)` via RPC
2. Exibe stops em ordem na sidebar direita com icones coloridos por tipo
3. Motorista confirma cada stop → `UPDATE trip_stops SET status = 'completed'`
4. Ao concluir ultimo stop → `UPDATE scheduled_trips SET status = 'completed'`
5. Ao inserir `status_history`: `{ entity_type: 'trip', entity_id: tripId, status: 'completed' }`

**Cores dos marcadores no mapa (conforme PRD Admin §6.5):**

| stop_type | Cor |
|-----------|-----|
| `driver_origin` | `#0d0d0d` (preto) |
| `passenger_pickup` | `#3b82f6` (azul) |
| `shipment_pickup` | `#f59e0b` (laranja) |
| `base_dropoff` | `#22c55e` (verde) |
| `trip_destination` | `#ef4444` (vermelho) |

### 4.3 Cenarios de Encomenda

| Cenario | Perfil | Fluxo |
|---------|--------|-------|
| 1 | Moto / Preparador (`subtype = 'shipments'`) | Motorista → Pickup cliente → Base Take Me mais proxima → fim |
| 2 | `driver` (carro Take Me ou parceiro) | Motorista → Pickup cliente → Destino final direto |

**Deteccao do cenario:**
- `worker_profiles.role === 'preparer' && subtype === 'shipments'` → Cenario 1
- `worker_profiles.role === 'driver'` → Cenario 2

**Cenario 1 — Base intermediaria:**
- Chamar RPC `nearest_active_base(lat, lng)` para obter a base mais proxima do cliente
- Rota: driver_position → pickup_address → base.address
- Ao completar dropoff na base → shipment passa para responsabilidade da base

**Cenario 2 — Entrega direta:**
- Rota: driver_position → pickup_address → destination_address
- Confirmacao de entrega com codigo de 4 digitos

**Status da shipment:**
```
pending_review → confirmed → in_progress → delivered / cancelled
```

**Roteamento de encomenda** (DATABASE.md §shipments):
1. `package_size = 'grande'` → sempre para o motorista, NUNCA para preparador
2. Cidade de origem tem base ativa → notifica preparadores da base (prazo: 1h antes da viagem)
3. Nenhum preparador aceita → redireciona para o motorista
4. `HomeEncomendasScreen` deve filtrar: apenas `package_size IN ('pequeno','medio')` e `base_id` da base do preparador

**Percentuais de bagageira** (referencia visual no app):
- `pequeno` = 10% do porta-malas
- `medio` = 30% do porta-malas
- `grande` = 60% do porta-malas

**Confirmacao de codigos:**
- Pickup: codigo de 4 digitos fornecido pelo remetente → Edge Function `confirm-code`
- Delivery: codigo de 4 digitos fornecido pelo destinatario → Edge Function `confirm-code`
- Fallback local: comparar com `shipment.pickup_code` / `shipment.delivery_code` se Edge Function indisponivel

### 4.4 Excursoes

**Status flow:**
```
pending → contacted → quoted → in_analysis → approved → scheduled → in_progress → completed / cancelled
```

**Responsabilidade do Preparador de Excursoes:**
- Visualizar excursoes com `status IN ('scheduled', 'in_progress')` onde `preparer_id = userId`
- Gerenciar lista de passageiros (`excursion_passengers`)
- Realizar check-in de embarque: `UPDATE excursion_passengers SET status_departure = 'boarded'`
- Realizar check-out de retorno: `UPDATE excursion_passengers SET status_return = 'returned'`
- Alterar status da excursao: `scheduled → in_progress → completed`

**Lista de passageiros (`excursion_passengers`):**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `full_name` | text | Nome completo |
| `cpf` | text | CPF (exibir mascarado: `***.***.***-XX`) |
| `phone` | text | Telefone de contato |
| `age` | text | Idade em anos (campo texto — converter para int ao ordenar) |
| `gender` | text | Genero |
| `status_departure` | text | `not_embarked` → `embarked` → `disembarked` |
| `status_return` | text | `not_embarked` → `embarked` → `disembarked` |
| `observations` | text | Observacoes especiais |

> **Atencao:** O banco usa `not_embarked`/`embarked`/`disembarked`, NAO `pending`/`boarded`/`returned` como descrito no PRD Admin.
> O campo `age` e texto (nao integer) — usar `parseInt(age)` ao ordenar.

### 4.5 Disponibilidade do Motorista

- Toggle "Em viagem" na `HomeScreen` atualiza `worker_profiles.is_available_for_requests`
- Quando ha viagem ativa (`scheduled_trips.status = 'active'`), o toggle fica desabilitado e fixo em `true`
- Motorista nao aparece para novas atribuicoes quando `is_available_for_requests = false`

### 4.6 Avaliacao

- Apos concluir viagem: motorista avalia a experiencia geral (1-5 estrelas + comentario) → `trip_ratings`
- Apos concluir encomenda: avaliacao inserida em `shipment_ratings`
- Historico de avaliacoes recebidas visivel no `ProfileOverviewScreen`

---

## 5. Funcionalidades por Tela

### 5.1 HomeScreen (Motorista)

- Viagem ativa: card com origem/destino, horario, passageiros, encomendas, bagageiro (stepper +/-)
- Mapa preview da viagem ativa (Mapbox, zoom no GPS ou origem, nao enquadra destino para nao parecer oceano)
- "Ver rota no mapa" → `ActiveTrip`
- "Encerrar viagem" → modal confirmacao → `UPDATE scheduled_trips SET status = 'completed'`
- Acesso rapido: Solicitacoes pendentes (badge count), Cronograma, Rotas e valores
- Toggle "Em viagem" → `worker_profiles.is_available_for_requests`
- Badge no botao Solicitacoes: soma de `bookings`, `shipments` e `excursion_requests` com `status = 'pending'`

### 5.2 PendingRequestsScreen

- Lista unificada de `worker_assignments` com `status = 'assigned'` e `worker_id = userId`
- Tipos exibidos: `passageiro` (booking), `encomenda` (shipment), `excursao` (excursion_request), `dependente`
- Card por solicitacao: avatar, nome, tipo (badge colorido), origem → destino, valor, countdown ate `expires_at`
- **Aceitar:** `POST respond-assignment { assignmentId, action: 'accepted' }` → navega para `TripDetail` ou `ActiveTrip`
- **Recusar:** `POST respond-assignment { assignmentId, action: 'rejected' }` → remove da lista; Edge Function processa estorno
- Assignment expirado: exibir banner "Solicitacao expirada", nao permitir aceite

### 5.3 TripDetailScreen

- Detalhe completo da viagem agendada: mapa (Mapbox), passageiros, encomendas vinculadas, timeline
- Mapa com rota Mapbox driving-traffic (origem → destino com waypoints dos passageiros)
- Lista de passageiros do trip: nome, avatar, mala, valor
- Lista de encomendas vinculadas: descricao, tamanho, destinatario, codigos
- Botao "Iniciar viagem" → atualiza `scheduled_trips.status = 'active'` → navega para `ActiveTrip`
- Botao upload de documento de despesa (expo-document-picker)

### 5.4 ActiveTripScreen (Viagem em execucao)

- Mapa Mapbox fullscreen com:
  - Marcador do motorista (preto, icone play, bolha pulse)
  - Marcadores de paradas coloridos por `stop_type` (ver §4.2)
  - Polyline dourada: rota completa (driving-traffic)
  - Polyline escura: GPS → proximo stop
- **Sidebar direita:** botoes circulares por stop na ordem de `sequence_order`, coloridos por tipo, linha conectora entre eles; ultimo no = bandeira vermelha (destino)
- **Botao minha localizacao (esquerda):** centraliza mapa no GPS com zoom 16
- **Card inferior flutuante:** pill "Viagem" / "Coleta" / "Entrega", nome, ETA em minutos, endereco atual, barra de progresso X/Y
- Toque no card ou botao da sidebar → bottom sheet com detalhe da parada atual
- **Confirmacao de parada (booking):** toque em "Embarcar" → avanca stop
- **Confirmacao de parada (shipment):** toque em "Confirmar coleta" ou "Confirmar entrega" → modal com codigo 4 digitos
- GPS: `expo-location.watchPositionAsync` com `distanceInterval: 8m`, `timeInterval: 5s`
- Rota motorista → stop atual: atualiza a cada ~100m (key do driverPositionKey com 3 casas decimais)
- Zoom inicial: 16 (`latitudeDelta: 0.002`) centrado na localizacao GPS do motorista
- **Finalizacao:** todos stops concluidos → bottom sheet "Finalizar viagem" com resumo + avaliacao opcional

### 5.5 HomeEncomendasScreen

- Solicitacoes de encomenda disponiveis: `shipments` com `status = 'pending_review'` e `driver_id IS NULL`
- Card por encomenda: remetente, origem → destino, tamanho do pacote, valor, tempo de espera
- Botao "Aceitar" → modal confirmacao → `respond-assignment` ou atribuicao direta
- Promocoes ativas para `preparador_encomendas` (tabela `promotions`)

### 5.6 ActiveShipmentScreen (Encomenda em execucao)

- Detecta cenario (§4.3) via `worker_profiles`
- **Cenario 1:** 3 stops: driver → pickup cliente → base
- **Cenario 2:** 2 stops: driver → pickup cliente → destino
- Mapa Mapbox com rota driving-traffic
- Sidebar direita com stops coloridos
- Confirmacao de pickup: modal com codigo 4 digitos → `confirm-code`
- Confirmacao de entrega: modal com codigo 4 digitos → `confirm-code`
- Apos entrega: modal resumo (tempo, distancia, avaliacao 1-5 estrelas)

### 5.7 DetalhesEncomendaScreen

- Detalhe de encomenda especifica (historico ou pendente)
- **Mapa Mapbox** com `MapMarker` em origem e destino (nao mais placeholder de icone)
- Rota tracada via `getRouteWithDuration` (driving-traffic)
- Timeline de eventos da encomenda
- Info do cliente: nome, telefone, endereco

### 5.8 HomeExcursoesScreen

- Query real (sem mock): `excursion_requests WHERE preparer_id = userId AND status IN ('scheduled', 'in_progress')`
- Card por excursao: destino, data partida/retorno, numero de pessoas, tipo de frota, status badge
- Botao "Ver detalhes" → `DetalhesExcursaoScreen`

### 5.9 DetalhesExcursaoScreen

- Mapa Mapbox com rota origem → destino
- Lista de `excursion_passengers` com filtro por status de embarque
- Toggle "Ordenar por idade" (campo `age`)
- Contador: `X / total embarcados`
- Check-in: botao por passageiro → `UPDATE excursion_passengers SET status_departure = 'boarded'`
- Check-out: botao por passageiro → `UPDATE excursion_passengers SET status_return = 'returned'`
- Botao "Iniciar excursao" → `UPDATE excursion_requests SET status = 'in_progress'`
- Botao "Concluir excursao" → modal confirmacao → `UPDATE excursion_requests SET status = 'completed'`

### 5.10 NotificationsScreen

- Query: `notifications WHERE user_id = userId ORDER BY created_at DESC`
- Badge de nao lidas na navbar
- Marcar como lida: `UPDATE notifications SET read_at = now()`
- Categorias: viagem, encomenda, excursao, pagamento, sistema

### 5.11 ProfileStack

| Tela | Funcionalidade |
|------|---------------|
| `SettingsScreen` | Grid de acesso rapido a sub-telas |
| `ProfileOverviewScreen` | Resumo: nome, foto, rating, viagens, ganhos |
| `PersonalInfoScreen` | Editar nome, telefone, cidade |
| `WorkerRoutesScreen` | CRUD de rotas com preco (tabela `worker_routes`) |
| `WorkerVehiclesScreen` | Lista de veiculos com status de aprovacao |
| `VehicleFormScreen` | Cadastrar/editar veiculo com fotos |
| `TripScheduleScreen` | Cronograma de viagens agendadas |
| `RouteScheduleScreen` | Detalhes de uma rota especifica |

---

## 6. Mapa (Mapbox)

### 6.1 Configuracao

- Biblioteca: `@rnmapbox/maps` v10 (requer New Architecture)
- Token: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `setAccessToken` chamado de forma sincrona no render do componente `GoogleMapsMap` (antes do MapView montar)
- Perfil de rota: `driving-traffic` (trafego em tempo real)
- Fallback: OSRM publico se Mapbox falhar

### 6.2 Componentes de Mapa (`src/components/googleMaps/`)

| Componente | Descricao |
|------------|-----------|
| `GoogleMapsMap.tsx` | Wrapper do `MapView` Mapbox com `Camera` ref e `UserLocation` |
| `MapMarker.tsx` | `MarkerView` (com filhos) ou `PointAnnotation` (pin simples) |
| `MapPolyline.tsx` | `ShapeSource` + `LineLayer` para rotas GeoJSON |
| `geometry.ts` | `isValidGlobeCoordinate`, `latLngFromDbColumns`, `regionFromLatLngPoints`, `regionToZoomLevel` |
| `route.ts` | `getRouteWithDuration`, `getMultiPointRoute`, `formatEta` |

### 6.3 Validacao de Coordenadas

- `isValidGlobeCoordinate(lat, lng)`: rejeita `NaN`, `Infinity`, e quando `|lat| < 1e-5 || |lng| < 1e-5` (evita (0,0))
- `latLngFromDbColumns(lat, lng)`: aplica mesma validacao + inverte colunas se necessario

### 6.4 Zoom Padrao

| Contexto | `latitudeDelta` | Zoom aprox. |
|----------|----------------|-------------|
| Mapa preview (HomeScreen) | 0.04 | ~12 |
| Inicio de viagem (sem GPS) | 0.002 | ~16 |
| GPS disponivel | 0.002 | 16 |
| Botao "Minha Localizacao" | 0.002 | 16 |

---

## 7. GPS e Localizacao

- Modulo: `expo-location` (import defensivo com try/catch para builds sem rebuild nativo)
- Permissao: `requestForegroundPermissionsAsync` (foreground suficiente para viagem ativa)
- Precisao: `Accuracy.Balanced` para tracking continuo (economia de bateria)
- Intervalo: `distanceInterval: 8` metros, `timeInterval: 5000` ms
- `driverPositionKey`: truncado a 3 casas decimais (~100m) para evitar re-renderizacao excessiva da rota

---

## 8. Edge Functions e RPCs Utilizadas

### 8.1 Edge Functions

| Funcao | Chamada em | Descricao |
|--------|------------|-----------|
| `send-email-verification-code` | `SignUpScreen`, `VerifyEmailScreen` | Enviar OTP de 4 digitos |
| `verify-email-code` | `VerifyEmailScreen` | Validar OTP com nome, telefone, senha |
| `login-with-phone` | `LoginScreen` | Login por telefone |
| `stripe-connect-link` | `PaymentsScreen`, `StripeConnectSetupScreen` | Link de cadastro Stripe Connect |
| `expire-assignments` | Cron (nao chamada diretamente) | Expira assignments vencidos |

> **Divergencia PRD vs codigo:** O PRD v1.1 citava `respond-assignment`, `confirm-code` e `create-motorista-account` como Edge Functions centrais. Na implementacao atual:
> - `PendingRequestsScreen` usa **RPCs SQL** (`shipment_driver_accept_offer`, `shipment_driver_pass_offer`) e **updates diretos** em `bookings`/`shipments`/`worker_assignments` — nao chama `respond-assignment`.
> - `ActiveShipmentScreen` faz **validacao local** comparando com `shipment.pickup_code`/`delivery_code` (`shipmentCodesMatch`) — nao chama `confirm-code`.
> - `FinalizeRegistrationScreen` usa `registerMotoristaWithAuth` em `motoristaRegistration.ts` (`signUp` + inserts diretos) — nao chama `create-motorista-account`.

### 8.2 RPCs SQL Utilizadas

| RPC | Chamada em | Descricao |
|-----|------------|-----------|
| `generate_trip_stops(trip_id)` | `useTripStops` hook | Gera paradas ordenadas se nao existirem |
| `nearest_active_base(lat, lng)` | `ActiveShipmentScreen` Cenario 1 | Retorna base mais proxima |
| `preparer_shipment_queue()` | `HomeEncomendasScreen` | Fila de encomendas para preparador da base |
| `shipment_process_expired_driver_offers()` | `PendingRequestsScreen` | Expira ofertas vencidas |
| `shipment_driver_accept_offer()` | `PendingRequestsScreen` | Motorista aceita oferta de envio |
| `shipment_driver_pass_offer()` | `PendingRequestsScreen` | Motorista recusa oferta de envio |
| `open_support_ticket()` | `supportTickets.ts` | Abre ticket de suporte |

---

## 9. Pagamentos e Ganhos

### 9.1 Stripe Connect (obrigatorio)

Apos aprovacao do cadastro (`worker_profiles.status = 'approved'`), o motorista e redirecionado para `StripeConnectSetupScreen` se nao tiver `stripe_connect_account_id`. O fluxo:

1. `StripeConnectSetupScreen`: chama Edge Function `stripe-connect-link`
2. Abre link externo no navegador para cadastro Stripe Connect
3. Ao completar, `stripe_connect_account_id` e salvo em `worker_profiles`
4. Gate em `App.tsx`: sem Stripe Connect, nao acessa o ambiente principal

### 9.2 Historico Financeiro (`driverPaymentTransfers.ts`)

- Prioriza `payouts` com `status = 'paid'`
- Fallback: `bookings` pagos + linhas sinteticas por viagem concluida
- Exibido em `PaymentsScreen` e `PaymentHistoryScreen`

### 9.3 Ganhos por Viagem (`driverTripEarnings.ts`)

- Soma valores de reservas (`bookings`) vinculadas a viagem
- Exibido em `TripDetailScreen` e `ActiveTripScreen` (resumo ao finalizar)

### 9.4 Chave PIX

- Editavel em `worker_profiles.pix_key`
- Visivel nas telas de pagamento

### 9.5 Preparador de Encomendas — Pagamentos

- `PagamentosEncomendasScreen`: agrega `shipments` entregues (`status = 'delivered'`)
- Filtrado por `driver_id` + `base_id` da base do preparador
- Modelo de negocio: diaria fixa definida pelo admin (nao percentual por encomenda)

---

## 10. Modelo de Dados Relevante

### 10.1 Tabelas Principais

| Tabela | Uso no app |
|--------|-----------|
| `profiles` | Nome, avatar, rating do worker |
| `worker_profiles` | Role, subtype, status, is_available_for_requests, PIX |
| `worker_assignments` | Solicitacoes pendentes de aceite |
| `scheduled_trips` | Viagens: origem, destino, status, passageiros |
| `trip_stops` | Paradas ordenadas da viagem (fonte de verdade) |
| `bookings` | Passageiros de cada viagem |
| `shipments` | Encomendas (diretas) |
| `dependent_shipments` | Encomendas em nome de dependentes |
| `excursion_requests` | Excursoes com budget_lines JSONB |
| `excursion_passengers` | Participantes com status embarque/retorno |
| `worker_routes` | Rotas e precos configurados pelo worker |
| `vehicles` | Veiculos com fotos e status de aprovacao |
| `payouts` | Historico de pagamentos recebidos |
| `notifications` | Notificacoes do sistema |
| `conversations` | Threads de chat com suporte |
| `messages` | Mensagens do chat |
| `status_history` | Auditoria de mudancas de status |
| `worker_ratings` | Avaliacoes recebidas pelo worker |
| `bases` | Hubs de encomenda (Cenario 1) |

### 10.2 RPCs SQL Utilizadas

Ver secao 8.2 para lista completa de RPCs.

---

## 11. Integracao com Supabase Realtime

- `ChatScreen`: subscription em `messages` para chat em tempo real com suporte/admin
- `PendingRequestsScreen`: subscription opcional em `worker_assignments` para novos assignments chegarem sem recarregar
- `ActiveTripScreen`: polling/subscription em `trip_stops` para refletir mudancas feitas pelo admin

---

## 12. Seguranca

- RLS ativa em todas as tabelas
- Worker so ve seus proprios dados (`worker_id = auth.uid()` ou `driver_id = auth.uid()`)
- Codigos de pickup/delivery validados localmente comparando com `shipment.pickup_code`/`delivery_code` (ver divergencia na secao 8.1)
- Token Mapbox exposto apenas como `EXPO_PUBLIC_` (restricao por bundle ID configurada no dashboard Mapbox)

---

## 13. Status de Implementacao

### Divergencias entre PRD e codigo real (verificadas em 14/04/2026)

| Item | PRD dizia | Codigo real | Valor correto |
|------|-----------|-------------|---------------|
| `subtype` motorista Take Me | `take_me` | `takeme` | `takeme` |
| `subtype` preparador encomendas | `package_preparer` | `shipments` | `shipments` |
| `subtype` preparador excursoes | `excursion_preparer` | `excursions` | `excursions` |
| `excursion_passengers.status_departure` | `pending`/`boarded` | `not_embarked`/`embarked`/`disembarked` | banco |
| `excursion_passengers.age` | `integer` | `text` | banco (usar `parseInt`) |
| `PendingRequestsScreen` | `respond-assignment` Edge Function | RPCs SQL (`shipment_driver_*`) + updates diretos | codigo |
| `ActiveShipmentScreen` codigos | `confirm-code` Edge Function | Validacao local (`shipmentCodesMatch`) | codigo |
| Cadastro motorista | `create-motorista-account` Edge Function | `registerMotoristaWithAuth` (signUp + inserts) | codigo |
| Stripe Connect | Nao mencionado | Obrigatorio apos aprovacao (gate em `App.tsx`) | codigo |

### Implementado e Funcional

- [x] Autenticacao completa (login email/senha, telefone, signup com OTP, reset de senha)
- [x] Guard de sessao com redirect por role/subtype (`motoristaAccess.ts`)
- [x] Gate de Stripe Connect obrigatorio apos aprovacao
- [x] HomeScreen com viagem ativa, mapa preview Mapbox, toggle disponibilidade
- [x] Mapa Mapbox com driving-traffic (`@rnmapbox/maps` v10, New Architecture)
- [x] `ActiveTripScreen`: mapa ao vivo, sidebar direita, card inferior flutuante, botao minha localizacao
- [x] Zoom 16 no GPS do motorista (zoom inicial e botao centralizar)
- [x] Validacao de coordenadas (`isValidGlobeCoordinate`)
- [x] Fallback de rota: Mapbox → Google Directions → OSRM
- [x] `PendingRequestsScreen`: lista de solicitacoes com RPCs de aceite/recusa de envios
- [x] Stack de navegacao para todos os tres ambientes (motorista, encomendas, excursoes)
- [x] Telas de cadastro e perfil completas
- [x] `TripDetailScreen` com mapa e passageiros
- [x] `ActiveShipmentScreen` com confirmacao de codigos (validacao local) e avaliacao final
- [x] `useTripStops` hook: busca e geracao de `trip_stops` via RPC
- [x] Historico financeiro (`driverPaymentTransfers.ts`)
- [x] Ganhos por viagem (`driverTripEarnings.ts`)
- [x] Chat em tempo real com suporte (Supabase Realtime em `messages`)
- [x] `useDriverOngoingTripForTabs`: badge de viagem ativa com Realtime em `scheduled_trips`
- [x] Preparador de encomendas: fila via `preparer_shipment_queue`, coletas, historico, pagamentos
- [x] `DetalhesEncomendaScreen`: mapa Mapbox com rota e marcadores

### Em Desenvolvimento / Pendente

- [ ] `ActiveTripScreen`: refatorar para usar `trip_stops` com cores por tipo e confirmacao de paradas
- [ ] `ActiveShipmentScreen`: deteccao automatica de cenario (1 vs 2) por `worker_profiles`
- [ ] `ActiveShipmentScreen`: Cenario 1 com RPC `nearest_active_base`
- [ ] `PendingRequestsScreen`: countdown ate `expires_at` nos assignments
- [ ] `HomeExcursoesScreen`: substituir mock data por query real em `excursion_requests`
- [ ] `DetalhesExcursaoScreen`: lista de passageiros + check-in/check-out (`excursion_passengers`)
- [ ] `NotificationsScreen`: query real em `notifications`
- [ ] Badge de notificacoes nao lidas na navbar
- [ ] Supabase Realtime em `PendingRequestsScreen` e `ActiveTripScreen` (alem do chat)
- [ ] Insercao em `status_history` ao mudar status de viagem/encomenda/excursao
- [ ] Push notifications nativas (`expo-notifications` nao esta nas dependencias)

---

## 14. Variaveis de Ambiente

| Variavel | Uso |
|----------|-----|
| `EXPO_PUBLIC_SUPABASE_URL` | Cliente Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox GL (@rnmapbox/maps) + Directions API |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Directions API fallback (opcional) |

---

## 15. Glossario

| Termo | Descricao |
|-------|-----------|
| **Take Me** | Frota propria da plataforma (`subtype = 'takeme'`) |
| **Motorista Parceiro** | Motorista terceiro (`subtype = 'partner'`) |
| **Preparador** | Worker que organiza excursoes ou entregas de encomendas |
| **Assignment** | Atribuicao de trabalho a um worker (tabela `worker_assignments`) |
| **trip_stops** | Paradas ordenadas de uma viagem, geradas por SQL function |
| **Trunk Occupancy** | Percentual de ocupacao do porta-malas (0-100%) |
| **Base** | Hub fisico da Take Me onde encomendas do Cenario 1 sao transferidas |
| **Cenario 1** | Encomenda via moto/preparador: entrega ate base intermediaria |
| **Cenario 2** | Encomenda via carro: entrega direta ao destinatario |
| **Budget Lines** | Linhas de orcamento de uma excursao (JSONB em `excursion_requests`) |
| **Stripe Connect** | Cadastro de recebimento do motorista no Stripe (obrigatorio apos aprovacao) |
| **Check-in** | Confirmacao de embarque de passageiro na excursao (`status_departure = 'embarked'`) |
| **Check-out** | Confirmacao de retorno de passageiro (`status_return = 'disembarked'`) |
| **driving-traffic** | Perfil Mapbox Directions com trafego em tempo real (mais preciso) |
| **driverPositionKey** | Chave de 3 casas decimais do GPS para throttling de re-render de rota |
| **New Architecture** | `newArchEnabled=true` no Android — obrigatorio para @rnmapbox/maps v10 |
