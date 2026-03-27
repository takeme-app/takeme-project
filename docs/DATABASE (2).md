# Take Me — Estado Completo do Banco de Dados

> Última atualização: 2026-03-26
> Backend: Supabase (PostgreSQL 15+, Edge Functions Deno/TypeScript, Storage)
> Integrações: Stripe, Resend, Mapbox, OSRM, Nominatim

---

## Visão Geral

App de transporte e logística brasileiro com 4 pilares de serviço:

1. **Viagens agendadas** (bookings) — passageiros entre cidades
2. **Envio de encomendas** (shipments) — coleta e entrega de pacotes
3. **Transporte de dependentes** (dependent_shipments) — menores/idosos
4. **Excursões** (excursion_requests) — viagens em grupo com equipe

### Roles do sistema

| Role | Subtype | Descrição |
|------|---------|-----------|
| `driver` | `takeme` | Motorista da Take Me |
| `driver` | `partner` | Motorista parceiro |
| `preparer` | `shipments` | Preparador de encomendas (vinculado a uma base) |
| `preparer` | `excursions` | Preparador de excursões (guia, sem veículo) |
| — | — | `admin` (via app_metadata.role no Auth) |
| — | — | `passenger` (cliente, usuário padrão) |

### Apps

- **App Cliente** (React Native/Expo) — solicita viagens, encomendas, dependentes, excursões
- **App Motorista/Preparador** (React Native/Expo) — aceita/recusa solicitações, confirma coletas/entregas
- **Admin Web** (Next.js) — gerencia motoristas, orçamentos, promoções, trechos de precificação, bases

---

## Tabelas

### auth.users (Supabase Auth)

Gerenciado pelo Supabase Auth. Campos relevantes:

- `id` (uuid, PK)
- `email` (text)
- `phone` (text)
- `raw_user_meta_data` (jsonb) — contém `full_name`, `phone`
- `app_metadata` (jsonb) — contém `role: 'admin'` para administradores

---

### profiles

Perfil público do usuário. Criado automaticamente via trigger `handle_new_user`.

```sql
id                uuid        PK, FK → auth.users(id) ON DELETE CASCADE
full_name         text        NULL
phone             text        NULL, UNIQUE parcial (WHERE phone IS NOT NULL AND trim(phone) <> '')
avatar_url        text        NULL
cpf               text        NULL
city              text        NULL
state             text        NULL
rating            numeric(2,1) NULL, CHECK 0–5
verified          boolean     DEFAULT false
stripe_customer_id text       NULL
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```

---

### worker_profiles

Perfil de motorista ou preparador.

```sql
id                        uuid        PK, FK → auth.users(id) ON DELETE CASCADE
role                      text        CHECK ('driver', 'preparer')
subtype                   text        CHECK ('takeme', 'partner', 'shipments', 'excursions')
status                    text        CHECK ('inactive', 'pending', 'under_review', 'approved', 'rejected', 'suspended') DEFAULT 'inactive'
cpf                       text        NOT NULL
age                       smallint    NULL
city                      text        NULL
experience_years          smallint    NULL
bank_code                 text        NULL
bank_agency               text        NULL
bank_account              text        NULL
pix_key                   text        NULL
cnh_document_url          text        NULL
cnh_document_back_url     text        NULL
background_check_url      text        NULL
has_own_vehicle           boolean     DEFAULT false
preference_area           text        NULL
base_id                   uuid        NULL, FK → bases(id) ON DELETE SET NULL
is_available_for_requests boolean     DEFAULT false
reviewed_by               uuid        NULL
reviewed_at               timestamptz NULL
rejection_reason          text        NULL
created_at                timestamptz DEFAULT now()
updated_at                timestamptz DEFAULT now()
```

**Índices:** `role`, `status`, `subtype`

**Nota:** `base_id` é usado apenas para preparadores de encomendas (role=preparer, subtype=shipments).

---

### bases

Pontos físicos (galpões) da Take Me. Cadastrados pelo admin.

```sql
id          uuid            PK, DEFAULT gen_random_uuid()
name        text            NOT NULL
address     text            NOT NULL
city        text            NOT NULL
state       text            NULL
lat         double precision NULL
lng         double precision NULL
is_active   boolean         DEFAULT true
created_at  timestamptz     DEFAULT now()
updated_at  timestamptz     DEFAULT now()
```

**Índices:** `city`, `is_active` (parcial WHERE is_active = true)

**Regra de negócio:** Se a cidade de origem de uma encomenda tem base ativa, o pedido é direcionado primeiro ao preparador de encomendas daquela base. Se não tem base, vai direto para o motorista.

---

### vehicles

Veículos dos motoristas.

```sql
id                    uuid        PK, DEFAULT gen_random_uuid()
worker_id             uuid        NOT NULL, FK → worker_profiles(id) ON DELETE CASCADE
year                  smallint    NOT NULL, CHECK >= 1900
model                 text        NOT NULL
plate                 text        NOT NULL
passenger_capacity    smallint    DEFAULT 4, CHECK >= 1
is_active             boolean     DEFAULT true
vehicle_document_url  text        NULL
vehicle_photos_urls   text[]      NULL
status                text        CHECK ('pending', 'approved', 'rejected') DEFAULT 'pending'
reviewed_at           timestamptz NULL
rejection_reason      text        NULL
renavam               text        NULL
use_type              text        CHECK ('principal', 'reserva') DEFAULT 'principal'
created_at            timestamptz DEFAULT now()
updated_at            timestamptz DEFAULT now()
```

**Índices:** `worker_id`, `status`, UNIQUE parcial `(worker_id) WHERE is_active = true AND status = 'approved'` (máx 1 veículo ativo aprovado por motorista)

---

### worker_routes

Rotas cadastradas pelo motorista com precificação.

```sql
id                      uuid            PK, DEFAULT gen_random_uuid()
worker_id               uuid            NOT NULL, FK → worker_profiles(id) ON DELETE CASCADE
origin_address          text            NOT NULL
origin_lat              double precision NULL
origin_lng              double precision NULL
destination_address     text            NOT NULL
destination_lat         double precision NULL
destination_lng         double precision NULL
price_per_person_cents  integer         NULL, CHECK >= 0
price_per_hour_cents    integer         NULL, CHECK >= 0
price_per_day_cents     integer         NULL, CHECK >= 0
is_active               boolean         DEFAULT true
weekend_surcharge_pct   numeric(5,2)    DEFAULT 15
nocturnal_surcharge_pct numeric(5,2)    DEFAULT 15
holiday_surcharge_pct   numeric(5,2)    DEFAULT 15
created_at              timestamptz     DEFAULT now()
updated_at              timestamptz     DEFAULT now()
```

**Índices:** `worker_id`, `(worker_id, is_active)`

**Nota:** Coordenadas podem ser preenchidas via Edge Function `geocode`.

---

### takeme_routes

Rotas padrão da plataforma. Motoristas podem importar para suas `worker_routes`.

```sql
id                      uuid        PK, DEFAULT gen_random_uuid()
origin_address          text        NOT NULL
destination_address     text        NOT NULL
price_per_person_cents  integer     NOT NULL
is_active               boolean     DEFAULT true
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

---

### scheduled_trips

Viagens agendadas criadas pelos motoristas a partir das rotas.

```sql
id                      uuid            PK, DEFAULT gen_random_uuid()
driver_id               uuid            NOT NULL, FK → auth.users(id) ON DELETE CASCADE
route_id                uuid            NULL, FK → worker_routes(id) ON DELETE SET NULL
title                   text            NULL
origin_address          text            NOT NULL
origin_lat              double precision NOT NULL
origin_lng              double precision NOT NULL
destination_address     text            NOT NULL
destination_lat         double precision NOT NULL
destination_lng         double precision NOT NULL
departure_at            timestamptz     NOT NULL
arrival_at              timestamptz     NOT NULL
seats_available         smallint        NOT NULL, CHECK >= 0
bags_available          smallint        NOT NULL, CHECK >= 0
badge                   text            DEFAULT 'Take Me'
amount_cents            integer         NULL, CHECK >= 0
price_per_person_cents  integer         NULL
capacity                smallint        NULL
confirmed_count         integer         DEFAULT 0
day_of_week             smallint        NULL
departure_time          text            NULL
arrival_time            text            NULL
is_active               boolean         DEFAULT true
status                  text            CHECK ('active', 'scheduled', 'completed', 'cancelled') DEFAULT 'active'
pickup_code             text            NULL
delivery_code           text            NULL
trunk_occupancy_pct     smallint        DEFAULT 0, CHECK 0–100
created_at              timestamptz     DEFAULT now()
updated_at              timestamptz     DEFAULT now()
```

**Índices:** `driver_id`, `departure_at`, `status`, `(driver_id, departure_at)`, `route_id`, `day_of_week`, `(origin_lat, origin_lng) WHERE active`, `(destination_lat, destination_lng) WHERE active`, `departure_at WHERE active AND seats > 0`

**Nota:** `trunk_occupancy_pct` é manual (motorista marca no app), apenas visual.

---

### bookings

Reservas de passageiros em viagens agendadas.

```sql
id                  uuid        PK, DEFAULT gen_random_uuid()
user_id             uuid        NOT NULL, FK → auth.users(id) ON DELETE CASCADE
scheduled_trip_id   uuid        NOT NULL, FK → scheduled_trips(id) ON DELETE RESTRICT
origin_address      text        NOT NULL
origin_lat          double precision NOT NULL
origin_lng          double precision NOT NULL
destination_address text        NOT NULL
destination_lat     double precision NOT NULL
destination_lng     double precision NOT NULL
passenger_count     smallint    NOT NULL, CHECK >= 1
bags_count          smallint    NOT NULL, CHECK >= 0
passenger_data      jsonb       DEFAULT '[]'
payment_method_id   uuid        NULL, FK → payment_methods(id) ON DELETE SET NULL
promotion_id        uuid        NULL, FK → promotions(id) ON DELETE SET NULL
amount_cents        integer     NOT NULL, CHECK >= 0
status              text        CHECK ('pending', 'confirmed', 'paid', 'cancelled') DEFAULT 'pending'
paid_at             timestamptz NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

**Índices:** `user_id`, `scheduled_trip_id`, `status`

---

### shipments

Envio de encomendas.

```sql
id                  uuid            PK, DEFAULT gen_random_uuid()
user_id             uuid            NOT NULL, FK → auth.users(id) ON DELETE CASCADE
origin_address      text            NOT NULL
origin_lat          double precision NULL
origin_lng          double precision NULL
destination_address text            NOT NULL
destination_lat     double precision NULL
destination_lng     double precision NULL
when_option         text            NOT NULL, CHECK ('now', 'later')
scheduled_at        timestamptz     NULL
package_size        text            NOT NULL, CHECK ('pequeno', 'medio', 'grande')
recipient_name      text            NOT NULL
recipient_email     text            NOT NULL
recipient_phone     text            NOT NULL
instructions        text            NULL
photo_url           text            NULL
payment_method      text            NOT NULL
payment_method_id   uuid            NULL, FK → payment_methods(id) ON DELETE SET NULL
promotion_id        uuid            NULL, FK → promotions(id) ON DELETE SET NULL
base_id             uuid            NULL, FK → bases(id) ON DELETE SET NULL
amount_cents        integer         NOT NULL, CHECK >= 0
tip_cents           integer         NULL, CHECK >= 0
status              text            CHECK ('pending_review', 'confirmed', 'in_progress', 'delivered', 'cancelled') DEFAULT 'pending_review'
pickup_code         text            NULL — gerado automaticamente (trigger)
delivery_code       text            NULL — gerado automaticamente (trigger)
picked_up_at        timestamptz     NULL
delivered_at        timestamptz     NULL
created_at          timestamptz     DEFAULT now()
```

**Índices:** `user_id`, `status`, `created_at DESC`

**Regras de negócio — roteamento de encomenda:**
1. Motorista aceita levar a encomenda
2. `package_size = 'grande'` → vai direto para o motorista (nunca preparador)
3. Cidade de origem tem base ativa? → notifica preparadores da base → prazo: 1h antes da viagem
4. Nenhum preparador aceita → redireciona para o motorista buscar
5. Percentuais de bagageira (visual): pequeno=10%, médio=30%, grande=60%

---

### dependent_shipments

Transporte de dependentes (menores/idosos).

```sql
id                  uuid            PK, DEFAULT gen_random_uuid()
user_id             uuid            NOT NULL, FK → auth.users(id) ON DELETE CASCADE
dependent_id        uuid            NULL, FK → dependents(id) ON DELETE SET NULL
full_name           text            NOT NULL
contact_phone       text            NOT NULL
bags_count          integer         DEFAULT 0, CHECK >= 0
instructions        text            NULL
origin_address      text            NOT NULL
origin_lat          double precision NULL
origin_lng          double precision NULL
destination_address text            NOT NULL
destination_lat     double precision NULL
destination_lng     double precision NULL
when_option         text            NOT NULL, CHECK ('now', 'later')
scheduled_at        timestamptz     NULL
payment_method      text            NOT NULL
payment_method_id   uuid            NULL, FK → payment_methods(id) ON DELETE SET NULL
promotion_id        uuid            NULL, FK → promotions(id) ON DELETE SET NULL
amount_cents        integer         NOT NULL, CHECK >= 0
tip_cents           integer         DEFAULT 0
rating              smallint        NULL
receiver_name       text            NULL
status              text            CHECK ('pending_review', 'confirmed', 'in_progress', 'delivered', 'cancelled') DEFAULT 'pending_review'
pickup_code         text            NULL — gerado automaticamente (trigger)
delivery_code       text            NULL — gerado automaticamente (trigger)
picked_up_at        timestamptz     NULL
delivered_at        timestamptz     NULL
created_at          timestamptz     DEFAULT now()
```

**Índices:** `user_id`, `status`, `created_at DESC`

---

### dependents

Dependentes cadastrados pelo cliente.

```sql
id                          uuid        PK, DEFAULT gen_random_uuid()
user_id                     uuid        NOT NULL, FK → auth.users(id) ON DELETE CASCADE
full_name                   text        NOT NULL
age                         text        NULL
document_url                text        NULL
representative_document_url text        NULL
observations                text        NULL
status                      text        CHECK ('pending', 'validated') DEFAULT 'pending'
created_at                  timestamptz DEFAULT now()
updated_at                  timestamptz DEFAULT now()
```

**Índices:** `user_id`
**Triggers:** `on_dependent_inserted_notify`, `on_dependent_validated_notify`

---

### excursion_requests

Solicitações de excursão.

```sql
id                      uuid            PK, DEFAULT gen_random_uuid()
user_id                 uuid            NOT NULL, FK → auth.users(id) ON DELETE CASCADE
destination             text            NOT NULL
excursion_date          date            NOT NULL
people_count            integer         DEFAULT 1, CHECK >= 1
fleet_type              text            CHECK ('carro', 'van', 'micro_onibus', 'onibus')
first_aid_team          boolean         DEFAULT false
recreation_team         boolean         DEFAULT false
children_team           boolean         DEFAULT false
special_needs_team      boolean         DEFAULT false
recreation_items        jsonb           DEFAULT '[]'
observations            text            NULL
status                  text            CHECK ('pending', 'contacted', 'quoted', 'cancelled', 'in_analysis', 'approved', 'scheduled', 'in_progress', 'completed') DEFAULT 'pending'
sub_status              text            NULL
total_amount_cents      integer         NULL, CHECK >= 0
confirmed_at            timestamptz     NULL
scheduled_departure_at  timestamptz     NULL
driver_id               uuid            NULL, FK → auth.users(id) ON DELETE SET NULL
preparer_id             uuid            NULL, FK → auth.users(id) ON DELETE SET NULL
assignment_notes        jsonb           DEFAULT '{}'
vehicle_details         jsonb           NULL
budget_lines            jsonb           DEFAULT '[]'
budget_created_by       uuid            NULL, FK → auth.users(id) ON DELETE SET NULL
budget_created_at       timestamptz     NULL
budget_accepted_at      timestamptz     NULL
payment_method          text            NULL, CHECK ('credit_card', 'debit_card', 'pix', 'cash')
payment_method_id       uuid            NULL, FK → payment_methods(id) ON DELETE SET NULL
promotion_id            uuid            NULL, FK → promotions(id) ON DELETE SET NULL
navigation_phase        text            NULL, CHECK ('outbound', 'return', 'completed')
created_at              timestamptz     DEFAULT now()
```

**Índices:** `user_id`, `created_at DESC`

**Schema do `budget_lines` (JSONB):**
```json
{
  "team": [{ "role": "driver|excursion_preparer", "name": "string", "worker_id": "uuid?", "value_cents": 0 }],
  "basic_items": [{ "name": "string", "quantity": 0, "value_cents": 0 }],
  "additional_services": [{ "name": "string", "quantity": 0, "value_cents": 0 }],
  "recreation_items": [{ "name": "string", "quantity": 0, "value_cents": 0 }],
  "discount": { "type": "percentage|fixed", "value": 0 },
  "total_cents": 0
}
```

**Fluxo de excursão:**
1. Cliente solicita → status `pending`
2. Admin analisa → `in_analysis`
3. Admin elabora orçamento → `quoted` (cliente é notificado)
4. Cliente aceita e paga → `approved`
5. Preparador de excursão é notificado e pode aceitar
6. Excursão agendada → `scheduled`
7. Em andamento → `in_progress` (navigation_phase: outbound → return)
8. Concluída → `completed`

---

### excursion_passengers

Passageiros de uma excursão.

```sql
id                      uuid        PK, DEFAULT gen_random_uuid()
excursion_request_id    uuid        NOT NULL, FK → excursion_requests(id) ON DELETE CASCADE
full_name               text        NOT NULL
cpf                     text        NULL
phone                   text        NULL
age                     text        NULL
gender                  text        NULL
observations            text        NULL
document_url            text        NULL
guardian_document_url    text        NULL
consent_document_url    text        NULL
photo_url               text        NULL
status_departure        text        DEFAULT 'not_embarked', CHECK ('not_embarked', 'embarked', 'disembarked')
status_return           text        DEFAULT 'not_embarked', CHECK ('not_embarked', 'embarked', 'disembarked')
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

**Índices:** `excursion_request_id`

---

### payment_methods

Cartões do usuário (Stripe).

```sql
id              uuid        PK, DEFAULT gen_random_uuid()
user_id         uuid        NOT NULL, FK → auth.users(id) ON DELETE CASCADE
type            text        CHECK ('credit', 'debit')
last_four       char(4)     NULL
brand           text        NULL
expiry_month    smallint    NULL, CHECK 1–12
expiry_year     smallint    NULL
holder_name     text        NULL
provider        text        NULL
provider_id     text        NULL
created_at      timestamptz DEFAULT now()
```

**Índices:** `user_id`

---

### promotions

Promoções automáticas cadastradas pelo admin.

```sql
id                uuid        PK, DEFAULT gen_random_uuid()
title             text        NOT NULL
description       text        NULL
start_at          timestamptz NOT NULL
end_at            timestamptz NOT NULL, CHECK end_at > start_at
target_audiences  text[]      NOT NULL — ('drivers', 'preparers_shipments', 'preparers_excursions', 'passengers')
discount_type     text        NOT NULL, CHECK ('percentage', 'fixed')
discount_value    integer     NOT NULL, CHECK > 0 — percentual ou centavos
applies_to        text[]      NOT NULL — ('bookings', 'shipments', 'dependent_shipments', 'excursions')
is_active         boolean     DEFAULT true
created_by        uuid        NULL, FK → auth.users(id) ON DELETE SET NULL
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```

**Índices:** `(is_active, start_at, end_at)`

**Regra:** Aplicada automaticamente ao calcular valor da transação. Sem cupom. O `promotion_id` é salvo na entidade (booking, shipment, etc.) para rastreabilidade.

---

### pricing_routes

Trechos de precificação definidos pelo admin (por role).

```sql
id                        uuid          PK, DEFAULT gen_random_uuid()
role_type                 text          NOT NULL, CHECK ('driver', 'preparer_excursions', 'preparer_shipments')
title                     text          NULL — título da promoção/trecho (motorista)
origin_address            text          NULL — preparadores usam; motorista usa só destino
destination_address       text          NOT NULL
pricing_mode              text          NOT NULL, CHECK ('daily_rate', 'per_km', 'fixed')
price_cents               integer       NOT NULL, CHECK >= 0
driver_pct                numeric(5,2)  DEFAULT 0, CHECK >= 0
admin_pct                 numeric(5,2)  DEFAULT 0, CHECK >= 0
accepted_payment_methods  text[]        DEFAULT '{}'
departure_at              timestamptz   NULL
return_at                 timestamptz   NULL
is_active                 boolean       DEFAULT true
created_by                uuid          NULL, FK → auth.users(id) ON DELETE SET NULL
created_at                timestamptz   DEFAULT now()
updated_at                timestamptz   DEFAULT now()
```

**Índices:** `role_type`, `is_active` (parcial WHERE true)

**Cálculo de valor da viagem:** `valor do trecho + adicionais + promocional + % admin`
**Split:** motorista/preparador recebe `driver_pct`, admin recebe `admin_pct`

---

### surcharge_catalog

Adicionais globais pré-cadastrados pelo admin.

```sql
id                  uuid        PK, DEFAULT gen_random_uuid()
name                text        NOT NULL
description         text        NULL
default_value_cents integer     DEFAULT 0, CHECK >= 0
surcharge_mode      text        DEFAULT 'manual', CHECK ('automatic', 'manual')
is_active           boolean     DEFAULT true
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

---

### pricing_route_surcharges

Ligação N:N entre trechos de precificação e adicionais do catálogo.

```sql
id                uuid        PK, DEFAULT gen_random_uuid()
pricing_route_id  uuid        NOT NULL, FK → pricing_routes(id) ON DELETE CASCADE
surcharge_id      uuid        NOT NULL, FK → surcharge_catalog(id) ON DELETE CASCADE
value_cents       integer     NULL — sobrescreve default_value_cents se informado
created_at        timestamptz DEFAULT now()

UNIQUE (pricing_route_id, surcharge_id)
```

---

### payouts

Registro de pagamentos aos motoristas/preparadores (split).

```sql
id                      uuid        PK, DEFAULT gen_random_uuid()
worker_id               uuid        NOT NULL, FK → worker_profiles(id) ON DELETE RESTRICT
entity_type             text        NOT NULL, CHECK ('booking', 'shipment', 'dependent_shipment', 'excursion')
entity_id               uuid        NOT NULL
gross_amount_cents      integer     NOT NULL, CHECK >= 0
worker_amount_cents     integer     NOT NULL, CHECK >= 0
admin_amount_cents      integer     NOT NULL, CHECK >= 0
surcharges_cents        integer     DEFAULT 0, CHECK >= 0
promotion_discount_cents integer    DEFAULT 0, CHECK >= 0
payout_method           text        DEFAULT 'pix', CHECK ('pix', 'fixed_monthly', 'fixed_weekly')
status                  text        DEFAULT 'pending', CHECK ('pending', 'processing', 'paid', 'failed')
paid_at                 timestamptz NULL
period_start            date        NULL — para modo fixed_monthly/fixed_weekly
period_end              date        NULL
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

**Índices:** `worker_id`, `status`, `(entity_type, entity_id)`

---

### worker_assignments

Atribuição de trabalho a motorista/preparador.

```sql
id              uuid        PK, DEFAULT gen_random_uuid()
worker_id       uuid        NOT NULL, FK → worker_profiles(id) ON DELETE RESTRICT
entity_type     text        NOT NULL, CHECK ('shipment', 'dependent_shipment', 'booking', 'excursion')
entity_id       uuid        NOT NULL
status          text        DEFAULT 'assigned', CHECK ('assigned', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected', 'expired')
assigned_at     timestamptz DEFAULT now()
accepted_at     timestamptz NULL
completed_at    timestamptz NULL
rejected_at     timestamptz NULL
rejection_reason text       NULL
expires_at      timestamptz NULL — horário da corrida - 30 min
notes           text        NULL
```

**Índices:** UNIQUE parcial `(entity_type, entity_id) WHERE status IN ('assigned', 'accepted', 'in_progress')`, `worker_id`, `(entity_type, entity_id)`, `status`

**Fluxo:**
1. Solicitação criada → status `assigned`, `expires_at` = horário - 30min
2. Motorista aceita → `accepted`
3. Motorista recusa → `rejected` (cancela entidade, estorna cliente)
4. Timeout sem resposta → `expired` (mesma lógica de recusa, via cron `expire-assignments`)

---

### worker_ratings

Avaliações dos motoristas/preparadores.

```sql
id          uuid        PK, DEFAULT gen_random_uuid()
worker_id   uuid        NOT NULL, FK → worker_profiles(id) ON DELETE CASCADE
rated_by    uuid        NOT NULL, FK → auth.users(id) ON DELETE CASCADE
entity_type text        NOT NULL, CHECK ('shipment', 'dependent_shipment', 'booking', 'excursion')
entity_id   uuid        NOT NULL
rating      smallint    NOT NULL, CHECK 1–5
comment     text        NULL
created_at  timestamptz DEFAULT now()

UNIQUE (worker_id, entity_type, entity_id)
```

**Índices:** `worker_id`

---

### booking_ratings / shipment_ratings / dependent_shipment_ratings

Avaliações por tipo de entidade (1 por entidade).

```sql
-- booking_ratings
id          uuid      PK
booking_id  uuid      UNIQUE, FK → bookings(id) ON DELETE CASCADE
rating      smallint  CHECK 1–5
comment     text      NULL
created_at  timestamptz

-- shipment_ratings
id          uuid      PK
shipment_id uuid      UNIQUE, FK → shipments(id) ON DELETE CASCADE
rating      smallint  CHECK 1–5
comment     text      NULL
created_at  timestamptz

-- dependent_shipment_ratings
id                    uuid      PK
dependent_shipment_id uuid      UNIQUE, FK → dependent_shipments(id) ON DELETE CASCADE
rating                smallint  CHECK 1–5
comment               text      NULL
created_at            timestamptz
```

---

### conversations

Chat entre motorista e cliente. Retenção: 3 meses (cron deleta automaticamente).

```sql
id                  uuid        PK, DEFAULT gen_random_uuid()
driver_id           uuid        NOT NULL, FK → auth.users(id) ON DELETE CASCADE
client_id           uuid        NOT NULL, FK → auth.users(id) ON DELETE CASCADE
booking_id          uuid        NULL, FK → bookings(id) ON DELETE SET NULL
status              text        CHECK ('active', 'closed') DEFAULT 'active'
participant_name    text        NULL
participant_avatar  text        NULL
last_message        text        NULL
last_message_at     timestamptz NULL
unread_driver       integer     DEFAULT 0
unread_client       integer     DEFAULT 0
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

**Regra:** Conversa se encerra quando a viagem/encomenda é finalizada. Preparadores podem conversar com clientes e com a base.

---

### messages

Mensagens do chat.

```sql
id              uuid        PK, DEFAULT gen_random_uuid()
conversation_id uuid        NOT NULL, FK → conversations(id) ON DELETE CASCADE
sender_id       uuid        NOT NULL, FK → auth.users(id) ON DELETE CASCADE
content         text        NOT NULL, CHECK content <> ''
created_at      timestamptz DEFAULT now()
read_at         timestamptz NULL
```

**Trigger:** `after_message_insert` → atualiza `conversations` (last_message, unread counts)

---

### notifications

Notificações para usuários.

```sql
id          uuid        PK, DEFAULT gen_random_uuid()
user_id     uuid        NOT NULL, FK → auth.users(id) ON DELETE CASCADE
title       text        NOT NULL
message     text        NULL
category    text        NULL
read_at     timestamptz NULL
created_at  timestamptz DEFAULT now()
```

**Índices:** `user_id`, `(user_id, created_at DESC)`

**Categorias usadas:** `account`, `booking`, `shipment`, `dependent_shipment`, `excursion`, `dependent`

---

### notification_preferences

Preferências de notificação por tipo.

```sql
user_id     uuid        FK → auth.users(id) ON DELETE CASCADE
key         text        NOT NULL
enabled     boolean     DEFAULT true

PK (user_id, key)
```

---

### user_preferences

Preferências genéricas do usuário.

```sql
user_id     uuid        FK → auth.users(id) ON DELETE CASCADE
key         text        NOT NULL
value       jsonb       DEFAULT '{}'
updated_at  timestamptz DEFAULT now()

PK (user_id, key)
```

**Índices:** `user_id`

---

### email_verification_codes

Códigos OTP para verificação de e-mail no cadastro.

```sql
id          uuid        PK, DEFAULT gen_random_uuid()
email       text        NOT NULL
code        char(4)     NOT NULL
expires_at  timestamptz DEFAULT now() + 10 min
created_at  timestamptz DEFAULT now()
```

**Índices:** `(email, expires_at)`

---

### data_export_requests

Rate limit de exportação de dados (1 a cada 5 min).

```sql
user_id     uuid        PK, FK → auth.users(id) ON DELETE CASCADE
last_sent_at timestamptz DEFAULT now()
```

---

### recent_destinations

Destinos recentes do cliente.

```sql
id          uuid            PK, DEFAULT gen_random_uuid()
user_id     uuid            NOT NULL, FK → auth.users(id) ON DELETE CASCADE
address     text            NOT NULL
city        text            NOT NULL
state       text            NULL
cep         text            NULL
latitude    double precision NULL
longitude   double precision NULL
used_at     timestamptz     DEFAULT now()
created_at  timestamptz     DEFAULT now()
```

**Índices:** `user_id`, `(user_id, used_at DESC)`

---

### status_history

Timeline de mudanças de status de todas as entidades.

```sql
id          uuid        PK, DEFAULT gen_random_uuid()
entity_type text        NOT NULL, CHECK ('booking', 'shipment', 'dependent_shipment', 'excursion')
entity_id   uuid        NOT NULL
status      text        NOT NULL
label       text        NULL — texto amigável ex: "Pedido feito"
changed_by  uuid        NULL, FK → auth.users(id) ON DELETE SET NULL
changed_at  timestamptz DEFAULT now()
```

**Índices:** `(entity_type, entity_id, changed_at)`

**Alimentação:** Triggers automáticos em bookings, shipments, dependent_shipments e excursion_requests que inserem registro toda vez que o campo `status` muda.

---

## Views

### driver_conversations

Conversas do ponto de vista do motorista.

```sql
SELECT id, client_id, booking_id, status, participant_name, participant_avatar,
       last_message, last_message_at, unread_driver AS unread_count,
       created_at, updated_at, driver_id
FROM conversations;
```

---

## Funções SQL

### generate_4digit_code()

Gera código aleatório de 4 dígitos (1000–9999).

### search_nearby_trips(p_origin_lat, p_origin_lng, p_dest_lat, p_dest_lng, p_radius_deg, p_limit)

Busca viagens ativas por proximidade geográfica. Usa bounding box + haversine. Retorna viagens com dados do motorista, ordenadas por distância.

```sql
-- Exemplo de uso:
SELECT * FROM search_nearby_trips(-3.7172, -38.5433, -3.1190, -40.1484, 0.15, 20);
```

### is_admin()

Retorna `true` se o JWT do request tem `app_metadata.role = 'admin'`.

### cleanup_old_conversations()

Deleta conversas (e mensagens via CASCADE) com mais de 3 meses. Rodada via cron diário.

---

## Triggers

| Trigger | Tabela | Evento | Função |
|---------|--------|--------|--------|
| `handle_new_user` | `auth.users` | AFTER INSERT | Cria perfil em `profiles` |
| `after_message_insert` | `messages` | AFTER INSERT | Atualiza `conversations` (last_message, unread) |
| `on_dependent_inserted_notify` | `dependents` | AFTER INSERT | Cria notificação "Cadastro enviado" |
| `on_dependent_validated_notify` | `dependents` | AFTER UPDATE | Cria notificação "Dependente aprovado" (quando status → validated) |
| `trg_shipments_generate_codes` | `shipments` | BEFORE INSERT | Gera pickup_code e delivery_code (4 dígitos) |
| `trg_dependent_shipments_generate_codes` | `dependent_shipments` | BEFORE INSERT | Gera pickup_code e delivery_code (4 dígitos) |
| `trg_bookings_status_history` | `bookings` | AFTER INSERT/UPDATE OF status | Registra em status_history |
| `trg_shipments_status_history` | `shipments` | AFTER INSERT/UPDATE OF status | Registra em status_history |
| `trg_dependent_shipments_status_history` | `dependent_shipments` | AFTER INSERT/UPDATE OF status | Registra em status_history |
| `trg_excursion_requests_status_history` | `excursion_requests` | AFTER INSERT/UPDATE OF status | Registra em status_history |

---

## Cron Jobs

| Job | Schedule | Função |
|-----|----------|--------|
| `cleanup-old-conversations` | `0 3 * * *` (diário 03:00 UTC) | Deleta conversas e mensagens > 3 meses |
| `expire-assignments` | `*/5 * * * *` (a cada 5 min) | Edge Function que expira assignments pendentes |

---

## Edge Functions (Deno/TypeScript)

| Função | Método | Auth | Descrição |
|--------|--------|------|-----------|
| `send-email-verification-code` | POST | Público | Gera OTP 4 dígitos, envia via Resend |
| `verify-email-code` | POST | Público | Valida OTP, cria usuário (cliente) ou retorna token HMAC (motorista com `defer_create`) |
| `create-motorista-account` | POST | Público | Cria conta de motorista (token HMAC ou e-mail direto), insere profiles + worker_profiles + vehicles + worker_routes |
| `login-with-phone` | POST | Público | Login por telefone+senha (busca perfil → e-mail → signInWithPassword) |
| `send-welcome-email` | POST | Público | Envia e-mail de boas-vindas via Resend |
| `ensure-stripe-customer` | POST | Bearer JWT | Garante Customer no Stripe, salva stripe_customer_id em profiles |
| `save-payment-method` | POST | Bearer JWT | Salva cartão no Stripe + tabela payment_methods |
| `delete-account` | POST | Bearer JWT | Confirma "EXCLUIR", apaga Storage + Stripe Customer + Auth (cascade) |
| `request-data-export` | POST | Bearer JWT | Exporta dados do usuário em JSON+PDF, envia por e-mail. Rate limit 5 min |
| `respond-assignment` | POST | Bearer JWT | Motorista/preparador aceita ou recusa assignment. Recusa → cancela + estorna + notifica |
| `confirm-code` | POST | Bearer JWT | Valida código 4 dígitos na coleta/entrega (bookings, shipments, dependent_shipments) |
| `manage-promotions` | GET/POST/PUT/DELETE | Bearer JWT (admin) | CRUD de promoções |
| `manage-pricing-routes` | GET/POST/PUT/DELETE | Bearer JWT (admin) | CRUD de trechos de precificação com adicionais |
| `manage-excursion-budget` | POST | Bearer JWT (admin) | Salva rascunho ou finaliza orçamento de excursão |
| `process-refund` | POST | Bearer JWT (admin) | Estorno integral ou parcial via Stripe Refunds |
| `expire-assignments` | POST | Service Role / Admin | Expira assignments pendentes com prazo vencido |
| `geocode` | POST | Bearer JWT | Geocodifica endereço via Nominatim. 4 modos: simples, worker_route, scheduled_trip, criar trip |

---

## Storage Buckets

| Bucket | Prefixo | Uso |
|--------|---------|-----|
| `avatars` | `{user_id}/` | Fotos de perfil |
| `dependent-documents` | `{user_id}/` | Documentos de dependentes |
| `shipment-photos` | `{user_id}/` | Fotos de encomendas |
| `excursion-passenger-docs` | `{user_id}/` | Documentos de passageiros de excursão |

---

## Secrets / Environment Variables

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Sim | Chave anon (público) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave service role (admin) |
| `SUPABASE_JWT_SECRET` | Sim | Secret JWT para validação |
| `STRIPE_SECRET_KEY` | Sim | Chave secreta do Stripe |
| `RESEND_API_KEY` | Sim | Chave da API do Resend (e-mails) |
| `RESEND_FROM_EMAIL` | Não | Remetente dos e-mails (default: `Take Me <onboarding@resend.dev>`) |
| `DRIVER_DEFERRED_SIGNUP_SECRET` | Não | Secret para token HMAC do motorista (fallback: JWT_SECRET) |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Sim (apps) | Token do Mapbox para mapas |
