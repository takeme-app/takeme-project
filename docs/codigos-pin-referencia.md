# Códigos de 4 dígitos — Referência completa

> **Nome do ficheiro:** `codigos-pin-referencia.md` (PIN de quatro dígitos; não “ping”).

> Documento técnico de referência sobre o sistema de **códigos de 4 dígitos**
> usados como prova de handoff entre os atores do produto (passageiro,
> preparador, base, motorista, destinatário, responsável por dependente).
>
> Base normativa: PDF **"Sequência de Solicitação de Código"**.
> Audiência principal: time **Admin** (visualização, suporte, auditoria).
> Companheiro: [`admin-pin-recomendacoes.md`](./admin-pin-recomendacoes.md) com
> recomendações de UI ainda não construídas.

---

## 1. Visão geral

O TakeMe usa **PINs numéricos de 4 dígitos** como prova mútua de que uma
transferência física aconteceu entre dois atores. Cada PIN é a senha de um
"handoff": um lado **informa**, o outro **valida**. O backend nunca aceita o
handoff como concluído sem essa validação cruzada (com a exceção documentada
em §11).

Existem **4 cenários** previstos no PDF, com **número diferente de PINs** por
cenário:

| Cenário | PINs | Atores na cadeia |
|---|---|---|
| 1. Viagem comum | 1 | Passageiro → Motorista |
| 2. Envio de Dependente | 2 | Solicitante → Motorista → Responsável-no-destino |
| 3. Encomenda **com** base | 4 | Passageiro → Preparador → Base → Motorista → Destinatário |
| 4. Encomenda **sem** base | 2 | Passageiro → Motorista → Destinatário |

Todos os PINs são gerados automaticamente por **triggers `BEFORE INSERT`** no
Postgres usando `public.generate_4digit_code()` (números entre `0000` e `9999`).
Os PINs do mesmo registro são garantidamente distintos entre si.

---

## 2. Catálogo de códigos (todos os PINs do sistema)

### 2.1 Tabela `bookings` — Viagem comum

| Coluna | Significado | Cenário | Status |
|---|---|---|---|
| `pickup_code` | PIN de embarque | 1 | ✅ Em uso |
| `delivery_code` | PIN de desembarque | — | ⚠️ **DEPRECADO** desde `20260603100000` (mantido nullable para histórico) |

> **Importante**: a partir da migration `20260603100000_bookings_remove_delivery_code_generation.sql`, **novas reservas não recebem mais `delivery_code`**. A coluna existe só para registros antigos.

### 2.2 Tabela `dependent_shipments` — Envio de Dependente

| Coluna | Significado | Cenário |
|---|---|---|
| `pickup_code` | PIN de embarque (responsável-origem → motorista) | 2 |
| `delivery_code` | PIN de desembarque (motorista ↔ responsável-destino) | 2 |

### 2.3 Tabela `shipments` — Encomenda

| Coluna | Significado | Cenário |
|---|---|---|
| `pickup_code` | PIN de coleta direta (motorista coleta no cliente) | 4 |
| `passenger_to_preparer_code` | **PIN A** — preparador informa ao passageiro (este valida no app) | 3 |
| `preparer_to_base_code` | **PIN B** — preparador informa ao operador da base; **admin** valida no painel (fallback: preparador digita via RPC legada) | 3 |
| `base_to_driver_code` | **PIN C** — motorista informa ao operador da base; **admin** valida no painel (fallback: motorista digita em `complete_trip_stop`) | 3 |
| `delivery_code` | **PIN D** — motorista → destinatário | 3 e 4 |

> Para encomendas **sem base** (`base_id IS NULL`): apenas `pickup_code` + `delivery_code` são preenchidos.
> Para encomendas **com base** (`base_id IS NOT NULL`): `passenger_to_preparer_code`, `preparer_to_base_code`, `base_to_driver_code` e `delivery_code` são preenchidos. `pickup_code` continua sendo gerado por compatibilidade, mas **não é validado** em nenhum handoff do cenário 3.

### 2.4 Outros códigos (fora do escopo deste documento)

Existem ainda códigos de **OTP de cadastro** (não relacionados a handoff físico):

- `phone_verification_codes` — verificação de telefone (WhatsApp/SMS).
- Códigos de e-mail em tabelas de email_verification — verificação de e-mail.

Estes **NÃO** fazem parte do PDF "Sequência de Solicitação de Código" e não
precisam ser visualizados no admin de operações.

---

## 3. Timestamps de handoff (quando cada PIN foi validado)

Cada validação bem-sucedida marca um timestamp na linha. O admin pode
inspecionar esses campos para reconstruir a linha do tempo da operação.

### 3.1 `bookings`

| Coluna | Quando é setado |
|---|---|
| `picked_up_at` | (não necessariamente — depende do fluxo legado) |

### 3.2 `dependent_shipments`

| Coluna | Marca o handoff |
|---|---|
| `picked_up_at` | PIN de embarque validado |
| `delivered_at` | PIN de desembarque validado |

### 3.3 `shipments`

| Coluna | Marca o handoff (PIN correspondente) |
|---|---|
| `picked_up_by_preparer_at` | **PIN A** validado pelo passageiro |
| `delivered_to_base_at` | **PIN B** validado pelo **admin** (`complete_shipment_preparer_to_base_by_admin`; fallback: preparador via `complete_shipment_preparer_to_base`) |
| `picked_up_by_driver_from_base_at` | **PIN C** validado pelo **admin** (`complete_shipment_base_to_driver_by_admin`; fallback: motorista via `complete_trip_stop` em `package_pickup` na base) |
| `picked_up_at` | Coleta confirmada (cenário 4 ou cenário 3 retirada na base) |
| `delivered_at` | **PIN D** validado pelo motorista (entrega ao destinatário) |

> Estes timestamps são **a fonte de verdade** para o admin saber em que ponto da cadeia uma encomenda está. Ver §8.

---

## 4. Cenários e fluxos completos

### 4.1 Cenário 1 — Viagem comum

```
┌─────────────┐                                  ┌─────────────┐
│  Passageiro │                                  │   Motorista │
└──────┬──────┘                                  └──────┬──────┘
       │  vê pickup_code no app                         │
       │ ─────────── informa verbalmente ─────────────► │
       │                                                │ digita PIN
       │                                                │ ↓
       │                              ┌─────────────────┴──────────────┐
       │                              │ RPC complete_trip_stop()       │
       │                              │ valida pickup_code             │
       │                              │ marca trip_stops.completed     │
       │                              └────────────────────────────────┘
                                      Corrida inicia. Sem PIN no desembarque.
```

**Tabelas/colunas**: `bookings.pickup_code`.
**RPC**: `complete_trip_stop` (ramo `passenger_pickup`).

### 4.2 Cenário 2 — Envio de Dependente

```
ETAPA 1: EMBARQUE                              ETAPA 2: DESEMBARQUE
┌──────────────┐    ┌───────────┐              ┌───────────┐    ┌──────────────────────┐
│ Solicitante  │    │ Motorista │              │ Motorista │    │ Responsável-destino  │
└──────┬───────┘    └─────┬─────┘              └─────┬─────┘    └──────────┬───────────┘
       │ pickup_code      │                          │            delivery_code (recebido
       │ ──── informa ──► │                          │             do solicitante via app
       │                  │ digita                   │             cliente, share/SMS)
       │                  ↓                          │ ◄── informa ───────│
       │   complete_trip_stop / dependent_pickup     │  digita
       │                                             ↓
       │                            complete_trip_stop / dependent_dropoff
```

**Tabelas/colunas**: `dependent_shipments.pickup_code` + `delivery_code`.
**RPC**: `complete_trip_stop` (ramos `dependent_pickup` e `dependent_dropoff`).

### 4.3 Cenário 3 — Encomenda **com** base

```
1. Passageiro solicita encomenda  →  Motorista aceita
2. Preparador é acionado pela base e vai até o cliente
   ┌─────────────┐    ┌─────────────┐
   │  Preparador │    │  Passageiro │
   └──────┬──────┘    └──────┬──────┘
          │ vê PIN A          │
          │ ── informa ──────►│ digita no app cliente
          │                   ↓
          │           RPC complete_shipment_passenger_to_preparer
          │           ↓ valida e marca picked_up_by_preparer_at
          │
3. Preparador leva até a base
   ┌─────────────┐    ┌─────────────┐
   │  Preparador │    │    Admin    │
   └──────┬──────┘    └──────┬──────┘
          │ vê PIN B         │
          │ ── informa verbalmente ──► digita no painel Admin
          │                  ↓
          │       RPC complete_shipment_preparer_to_base_by_admin
          │       ↓ valida e marca delivered_to_base_at
          │
4. Motorista vai à base buscar
   ┌─────────────┐    ┌─────────────┐
   │  Motorista  │    │    Admin    │
   └──────┬──────┘    └──────┬──────┘
          │ vê PIN C (app)   │
          │ ── informa verbalmente ──► digita no painel Admin
          │                  ↓
          │       RPC complete_shipment_base_to_driver_by_admin
          │       ↓ valida base_to_driver_code; marca picked_up_by_driver_from_base_at
          │       ↓ conclui `trip_stops` da retirada na base (quando há `scheduled_trip_id`)
          │
          │ Fallback (admin indisponível): motorista usa «Base fora do ar» e
          │       RPC complete_trip_stop (package_pickup) com PIN C.
          │
5. Motorista entrega ao destinatário
   ┌─────────────┐    ┌─────────────┐
   │ Destinatário│    │  Motorista  │
   └──────┬──────┘    └──────┬──────┘
          │ informa PIN D    │
          │ ────────────────►│ digita no app motorista
          │                  ↓
          │       RPC complete_trip_stop (package_dropoff)
          │       ↓ valida delivery_code
          │       ↓ marca delivered_at e status = 'delivered'
```

**Tabelas/colunas**: `shipments.passenger_to_preparer_code`, `preparer_to_base_code`, `base_to_driver_code`, `delivery_code`.
**RPCs**: `complete_shipment_passenger_to_preparer`, `complete_shipment_preparer_to_base_by_admin`, `complete_shipment_base_to_driver_by_admin`, `complete_trip_stop` (PIN D e fallback PIN C). RPCs legadas ainda disponíveis: `complete_shipment_preparer_to_base` (preparador), `complete_trip_stop` para PIN C pelo motorista.

### 4.4 Cenário 4 — Encomenda **sem** base

```
ETAPA 1: COLETA                              ETAPA 2: ENTREGA
┌──────────────┐    ┌───────────┐            ┌───────────┐    ┌─────────────┐
│  Passageiro  │    │ Motorista │            │ Motorista │    │Destinatário │
└──────┬───────┘    └─────┬─────┘            └─────┬─────┘    └──────┬──────┘
       │ vê pickup_code   │                        │ vê delivery_code que
       │ ─── informa ───► │                        │ o cliente repassou
       │                  │ digita                 │ ◄────── informa ────│
       │                  ↓                        │ digita
       │   complete_trip_stop / shipment_pickup    ↓
       │                            complete_trip_stop / shipment_dropoff
```

**Tabelas/colunas**: `shipments.pickup_code` + `delivery_code`.
**RPC**: `complete_trip_stop` (ramos `shipment_pickup` e `shipment_dropoff`).

### 4.5 Cenário 4 — Apoio no Admin (sem base)

No painel **Admin** → detalhe da encomenda (`EncomendaEditScreen`), quando `base_id` é nulo, existe um bloco **«Entrega direta (sem base)»** com:

- Estado resumido da coleta (`picked_up_at`) e da entrega final (`delivered_at`).
- Contactos do destinatário (telefone/e-mail) para suporte.
- Botão **«Copiar mensagem pronta»** — texto com o `delivery_code` para o operador reenviar ao destinatário por canal externo (WhatsApp/SMS/etc.). O **PIN de embarque da viagem comum** (`bookings.pickup_code`) continua apenas no app **Cliente** para passageiros da mesma viagem agregada; não misturar com PINs de encomenda.

---

## 5. RPCs e funções relacionadas

### 5.1 Geração de códigos

| Função | Trigger | Tabela |
|---|---|---|
| `public.generate_4digit_code()` | — (helper) | — |
| `public.generate_booking_trip_codes()` | `trg_bookings_generate_trip_codes` BEFORE INSERT | `bookings` |
| `public.generate_shipment_codes()` | `trg_shipments_generate_codes` BEFORE INSERT | `shipments` |
| `public.generate_dependent_shipment_codes()` | `trg_dependent_shipments_generate_codes` BEFORE INSERT | `dependent_shipments` |

### 5.2 Validação de PINs (RPCs)

Todas com `SECURITY DEFINER`. Retornam `jsonb` no formato `{ ok: bool, error?: text, already_completed?: bool }`.

| RPC | Quem chama | Cenário/PIN | O que faz |
|---|---|---|---|
| `complete_trip_stop(p_trip_stop_id, p_confirmation_code)` | Motorista | 1, 2, 3, 4 | Valida PIN da parada (passenger_pickup, dependent_pickup/dropoff, shipment_pickup/dropoff, package_pickup/dropoff). Atualiza `trip_stops.status` e timestamps da entidade. Na retirada na **base**, o fluxo preferencial é validação pelo admin; o app motorista oferece fallback manual (PIN C). |
| `complete_shipment_passenger_to_preparer(p_shipment_id, p_confirmation_code)` | Passageiro | 3 / PIN A | Valida `passenger_to_preparer_code`. Marca `picked_up_by_preparer_at`. |
| `complete_shipment_preparer_to_base(p_shipment_id, p_confirmation_code)` | Preparador | 3 / PIN B (fallback) | Valida `preparer_to_base_code`. Marca `delivered_to_base_at`. Exige `picked_up_by_preparer_at` já preenchido. Preferir `…_by_admin` em operação normal. |
| `complete_shipment_preparer_to_base_by_admin(p_shipment_id, p_confirmation_code)` | Admin (`is_admin()`) | 3 / PIN B | Igual ao preparador, mas quem digita é o operador do painel após o preparador informar o código. |
| `complete_shipment_base_to_driver_by_admin(p_shipment_id, p_confirmation_code)` | Admin (`is_admin()`) | 3 / PIN C | Valida `base_to_driver_code`; marca `picked_up_by_driver_from_base_at` e `picked_up_at`; conclui paradas `package_pickup`/`shipment_pickup` pendentes da encomenda na viagem. Exige `delivered_to_base_at` já preenchido. |

### 5.3 Funções auxiliares de paradas

| Função | Para que serve |
|---|---|
| `ensure_shipment_trip_stops(p_trip_id)` | Materializa `trip_stops` para encomendas. Para com-base preenche `code` com PIN C; para sem-base com `pickup_code`. Para entrega sempre `delivery_code`. |
| `ensure_passenger_trip_stops(p_trip_id)` | Materializa paradas de booking. |
| `ensure_dependent_trip_stops(p_trip_id)` | Materializa paradas de dependente. |
| `ensure_all_trip_stops(p_trip_id)` | Agregadora: chama as 3 acima. |

### 5.4 Edge Function `confirm-code` (status: ÓRFÃ)

Existe em `supabase/functions/confirm-code/` mas **nenhum app a chama** atualmente. Toda a validação operacional vai pelas RPCs acima. Recomendação no `admin-pin-recomendacoes.md`: descontinuar ou consolidar.

---

## 6. Erros possíveis das RPCs

Padrão `{ ok: false, error: '<código>' }`. Códigos comuns:

| `error` | Significado |
|---|---|
| `not_authenticated` | `auth.uid()` é nulo |
| `forbidden` | Não autorizado: motorista/preparador/passageiro errado **ou** (RPCs `*_by_admin`) utilizador sem `is_admin()` |
| `stop_not_found` / `missing_entity` | Parada ou entidade não existe |
| `already_completed` | (vem com `ok: true`) já validado anteriormente — idempotente |
| `code_length` | PIN não tem 4 dígitos |
| `missing_code` | PIN esperado está vazio no banco |
| `invalid_code` | PIN digitado não confere |
| `pickup_not_completed` | (RPC do preparador) tentativa de validar PIN B antes de PIN A |
| `no_base` | (RPC do preparador / admin) shipment não tem `base_id` |
| `not_at_base` | (RPC admin PIN C) `delivered_to_base_at` ainda nulo — falta validar PIN B |

---

## 7. Resumo dos ajustes implementados

### 7.1 Migrations criadas

| # | Arquivo | Cenário | O que mudou |
|---|---|---|---|
| 1 | `20260603100000_bookings_remove_delivery_code_generation.sql` | 1 | Para de gerar `bookings.delivery_code`. |
| 2 | `20260603110000_complete_trip_stop_dependent_pin_validation.sql` | 2 | Restaura validação de `dependent_pickup` e `dependent_dropoff` no servidor. |
| 3 | `20260603120000_shipments_handoff_codes.sql` | 3 | Adiciona PINs A, B, C + timestamps em `shipments`. Atualiza geração. |
| 4 | `20260603130000_ensure_shipment_trip_stops_with_base.sql` | 3 | `trip_stops.code` da retirada vira PIN C quando há base. |
| 5 | `20260603140000_complete_trip_stop_with_base_handoff.sql` | 3 | RPC valida PIN C; marca `picked_up_by_driver_from_base_at`. |
| 6 | `20260603150000_shipment_preparer_handoff_rpcs.sql` | 3 | RPCs novas para PIN A e PIN B. |
| 7 | `20260604100000_shipment_admin_handoff_rpcs.sql` | 3 | PIN B e PIN C validados pelo admin (`*_by_admin`). |

### 7.2 Apps modificados

| App | Arquivo | O que mudou |
|---|---|---|
| Cliente | `screens/trip/TripInProgressScreen.tsx` | Removido fluxo/UI de PIN no desembarque (cenário 1). |
| Cliente | `screens/dependentShipment/DependentShipmentDetailScreen.tsx` | Nova seção mostrando PIN de desembarque para o responsável-destino (cenário 2). |
| Cliente | `screens/shipment/ShipmentDetailScreen.tsx` | Para com-base: esconde `pickup_code`; novo botão "Validar código do preparador" → RPC. |
| Motorista | `screens/ActiveTripScreen.tsx` | `dependent_dropoff` exige PIN; retirada na base: mostra PIN C ao motorista; admin valida; fallback «Base fora do ar» para `complete_trip_stop`. |
| Motorista | `hooks/useTripStops.ts` | `package_pickup` em base usa PIN C como `code`. |
| Motorista | `screens/encomendas/ActiveShipmentScreen.tsx` (preparador) | Coleta exibe PIN A; depósito na base: mostra PIN B; admin valida; fallback manual para RPC `complete_shipment_preparer_to_base`. |

### 7.3 App Admin

O painel **Admin** (`apps/admin`) expõe, no **detalhe da encomenda** (`EncomendaEditScreen`), os timestamps de handoff e os PINs (A–D, coleta e entrega) com **mascaramento por defeito** e botão **Revelar** (~10 s), alinhado à §10. **Com base:** ações **«Receber encomenda do preparador»** (PIN B) e **«Despachar ao motorista»** (PIN C) chamam as RPCs `complete_shipment_preparer_to_base_by_admin` e `complete_shipment_base_to_driver_by_admin`. **Sem base:** bloco «Entrega direta» + **«Copiar mensagem pronta»** com o PIN de entrega para apoio ao destinatário (§4.5). No **detalhe da viagem** (`ViagemDetalheScreen`), o admin vê o **PIN de embarque** da reserva (`bookings.pickup_code`, mascarado) e, nas encomendas ligadas à viagem, um **rótulo de estágio operacional** (sem PIN nas listagens). A **auditoria de revelações** (§10.2) e a tabela `code_validation_logs` continuam pendentes (fase P2). Detalhe complementar em [`admin-pin-recomendacoes.md`](./admin-pin-recomendacoes.md).

---

## 8. Diagnóstico operacional pelo Admin

### 8.1 Onde uma encomenda está? (cenário 3 — com base)

Usar a **combinação de timestamps** para inferir o estágio:

| Estado | Critério |
|---|---|
| Aguardando preparador buscar | `picked_up_by_preparer_at IS NULL` |
| Em trânsito do cliente para a base | `picked_up_by_preparer_at IS NOT NULL` AND `delivered_to_base_at IS NULL` |
| Aguardando motorista retirar na base | `delivered_to_base_at IS NOT NULL` AND `picked_up_by_driver_from_base_at IS NULL` |
| Em trânsito da base para o destinatário | `picked_up_by_driver_from_base_at IS NOT NULL` AND `delivered_at IS NULL` |
| Entregue | `delivered_at IS NOT NULL` |

### 8.2 Onde está um envio de dependente?

| Estado | Critério |
|---|---|
| Aguardando embarque | `picked_up_at IS NULL` |
| Em trânsito | `picked_up_at IS NOT NULL` AND `delivered_at IS NULL` |
| Entregue | `delivered_at IS NOT NULL` |

### 8.3 Indicadores de problema

- Encomenda parada por mais de **N horas** em "Aguardando motorista retirar" → suporte aciona base/motorista.
- Dependente com `picked_up_at` há mais de **2× a duração da rota** sem `delivered_at` → suporte verifica.
- PIN A com várias chamadas falhando (exigirá `code_validation_logs` futuro).

---

## 9. Queries úteis para o Admin

### 9.1 Visão completa de um shipment

```sql
SELECT
  id, status, base_id, preparer_id, driver_id,
  -- PINs
  pickup_code,
  delivery_code,
  passenger_to_preparer_code,
  preparer_to_base_code,
  base_to_driver_code,
  -- Timeline
  created_at,
  picked_up_by_preparer_at,
  delivered_to_base_at,
  picked_up_by_driver_from_base_at,
  picked_up_at,
  delivered_at
FROM public.shipments
WHERE id = '<shipment-id>';
```

### 9.2 Encomendas paradas na base (cenário 3)

```sql
SELECT s.id, s.recipient_name, b.name AS base_name,
       s.delivered_to_base_at,
       now() - s.delivered_to_base_at AS aguardando_motorista
FROM public.shipments s
JOIN public.bases b ON b.id = s.base_id
WHERE s.delivered_to_base_at IS NOT NULL
  AND s.picked_up_by_driver_from_base_at IS NULL
  AND s.status NOT IN ('cancelled', 'refunded')
ORDER BY s.delivered_to_base_at ASC;
```

### 9.3 Encomendas em trânsito do preparador

```sql
SELECT s.id, s.preparer_id, p.full_name AS preparer_name,
       s.picked_up_by_preparer_at,
       now() - s.picked_up_by_preparer_at AS tempo_no_preparador
FROM public.shipments s
LEFT JOIN public.profiles p ON p.id = s.preparer_id
WHERE s.picked_up_by_preparer_at IS NOT NULL
  AND s.delivered_to_base_at IS NULL
  AND s.status NOT IN ('cancelled', 'refunded')
ORDER BY s.picked_up_by_preparer_at ASC;
```

### 9.4 Dependentes em trânsito

```sql
SELECT id, full_name, dependent_id, status,
       picked_up_at, delivered_at,
       now() - picked_up_at AS tempo_em_transito
FROM public.dependent_shipments
WHERE picked_up_at IS NOT NULL
  AND delivered_at IS NULL
  AND status NOT IN ('cancelled', 'refunded')
ORDER BY picked_up_at ASC;
```

### 9.5 Resumo diário de handoffs

```sql
SELECT
  date_trunc('day', picked_up_by_preparer_at) AS dia,
  count(*) FILTER (WHERE picked_up_by_preparer_at IS NOT NULL)         AS pin_a_validados,
  count(*) FILTER (WHERE delivered_to_base_at IS NOT NULL)              AS pin_b_validados,
  count(*) FILTER (WHERE picked_up_by_driver_from_base_at IS NOT NULL)  AS pin_c_validados,
  count(*) FILTER (WHERE delivered_at IS NOT NULL)                       AS pin_d_validados
FROM public.shipments
WHERE base_id IS NOT NULL
  AND picked_up_by_preparer_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

**Nota sobre `refunded` nas cláusulas `status`:** nas secções 9.2–9.4 usa-se `status NOT IN ('cancelled', 'refunded')`. O `CHECK` habitual de `shipments` / `dependent_shipments` no repositório inclui `pending_review`, `confirmed`, `in_progress`, `delivered`, `cancelled`. **Só inclua `'refunded'`** se o vosso ambiente tiver estendido o enum ou uma coluna equivalente; caso contrário use apenas `'cancelled'`.

---

## 10. Mascaramento e segurança na UI Admin

PINs são **dados sensíveis**. Recomendações para o frontend Admin:

1. **Mascarar por padrão**: exibir `••••` com botão "Revelar" que mostra por 10 segundos.
2. **Logar revelações**: cada clique em "Revelar" deveria ser auditado (quem, quando, qual PIN, qual shipment).
3. **Não logar PIN em URL ou query string**.
4. **Não exibir PIN em listas/tabelas** — apenas no detalhe do registro.
5. **Restrição por papel**: operador comum vê apenas timestamps; admin de suporte vê PINs.

---

## 11. Pontos de atenção / dívidas conhecidas

### 11.1 UI da Base (Admin)
A **Base** passa a ser representada pelo **painel Admin** (operador): valida PIN B e PIN C após o preparador/motorista informarem verbalmente os códigos. Os apps **preparador** e **motorista** mostram os respetivos PINs em chips (com copiar/partilhar) e **Realtime** em `shipments` para avançar quando o admin valida; existe **fallback manual** se o painel estiver indisponível.

### 11.2 PINs visíveis nos apps "do mesmo lado do handoff"
- Passageiro vê seu próprio `delivery_code` no app cliente (PIN D, cenário 3 e 4) — **correto**, pois ele precisa repassar.
- Passageiro **não vê** `passenger_to_preparer_code` na UI atual — **correto**, o handoff é genuíno.
- Preparador vê `preparer_to_base_code` no app para **mostrar** ao operador da base — alinhado ao modelo admin; o dígito continua sensível em RLS (§11.3).
- Motorista vê `base_to_driver_code` (via `trip_stops.code` / UI de retirada na base) para informar ao admin — mesmo raciocínio.

### 11.3 RLS column-level
PostgreSQL não tem RLS por coluna nativo. Hoje, se um cliente fizesse `SELECT *` em `shipments`, traria todos os PINs. Os apps foram disciplinados para selecionar apenas o necessário, mas isso depende de revisão contínua. **Mitigação futura**: criar views `shipments_passenger_view`, `shipments_preparer_view`, `shipments_driver_view` com apenas as colunas que cada papel pode ver.

### 11.4 `bookings.delivery_code` deprecada
Coluna preservada por compatibilidade. Não selecionar em código novo. Pode ser dropada após 30-60 dias de observação sem incidentes.

### 11.5 Edge Function `confirm-code`
Órfã. Decidir: descontinuar do deploy ou refatorar todos os apps para chamá-la. Não manter os 2 caminhos paralelos por mais tempo.

### 11.6 Auditoria
Não há tabela `code_validation_logs`. Reconstruir histórico hoje exige cruzar timestamps + `status_history`. Recomendação: criar a tabela na próxima fase (esquema sugerido em `admin-pin-recomendacoes.md` §5).

---

## 12. Checklist para o time Admin

### Visualização básica (P0)
- [x] Tela de detalhe do shipment com todos os timestamps e PINs (mascarados).
- [x] Tela de detalhe do dependent_shipment com `pickup_code`, `delivery_code` e timestamps.
- [ ] Lista filtrável de shipments por estágio (usar critérios da §8.1).
- [ ] Lista de dependentes em trânsito.

### Operações (P1)
- [ ] Painel "Encomendas paradas na base" (query 9.2).
- [ ] Indicador de SLA estourado (encomenda parada > N horas).
- [ ] Visualização da timeline de cada handoff em ordem cronológica.

### Auditoria/Segurança (P2)
- [x] Mascaramento + revelar (§10.1); auditoria de cada revelação ainda **não** implementada (§10.2).
- [ ] Tabela `code_validation_logs` + integração nas RPCs.
- [ ] Relatório diário/semanal de validações por base, por motorista, por preparador.

### Suporte (P2)
- [ ] Botão "Reenviar PIN" (regenera + atualiza coluna + re-notifica).
- [ ] Botão "Forçar conclusão" (admin-only, com motivo, gera log) — para casos onde validação falha mas o handoff físico ocorreu.

---

## 13. Glossário

- **PIN A**: `shipments.passenger_to_preparer_code` — handoff Passageiro → Preparador (etapas 1-3 do PDF cenário 3).
- **PIN B**: `shipments.preparer_to_base_code` — preparador informa ao operador da base; **admin** valida no painel (etapas 6-8 do PDF, com UI Admin).
- **PIN C**: `shipments.base_to_driver_code` — motorista informa ao operador da base; **admin** valida no painel (etapas 10-11).
- **PIN D**: `shipments.delivery_code` — handoff Motorista → Destinatário na entrega final (etapas 14-17).
- **Handoff**: transferência física da encomenda/passageiro/dependente entre dois atores, validada pelo PIN correspondente.
- **`complete_trip_stop`**: RPC que conclui uma parada de viagem combinada (motorista). Multi-cenário.
- **`complete_shipment_passenger_to_preparer`**: RPC do passageiro (cenário 3, PIN A).
- **`complete_shipment_preparer_to_base`**: RPC do preparador (cenário 3, PIN B) — fallback; preferir `complete_shipment_preparer_to_base_by_admin`.
- **`complete_shipment_preparer_to_base_by_admin` / `complete_shipment_base_to_driver_by_admin`**: RPCs do operador Admin (PIN B e PIN C).

---

**Versão**: 1.2 — PIN B/C com validação no Admin; fallbacks nos apps motorista/preparador; apoio cenário 4 no Admin.
**Última atualização**: 2026-04-30.
**Documentos relacionados**: [`admin-pin-recomendacoes.md`](./admin-pin-recomendacoes.md), [`Sequência de Solicitação de Código.pdf`](./Sequência%20de%20Solicitação%20de%20Código.pdf).
