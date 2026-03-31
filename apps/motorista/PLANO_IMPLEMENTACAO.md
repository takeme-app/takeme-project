# Plano de Implementação — App Motorista

> **Versão:** 1.0 | **Data:** 30/03/2026
> **Referências:** PRD Motorista v1.0 · PRD Admin v2.3 · DATABASE.md · ESTADO_DO_PROJETO.md
> **Branch de trabalho:** `motorista/regras-negocio`

---

## Resumo executivo

O app motorista tem navegação, telas e autenticação prontos. O que falta é a **lógica de negócio real**:
confirmação de paradas por `trip_stops`, fluxo de `worker_assignments`, os 2 cenários de encomenda,
dados reais nas telas de excursão, e integração correta com as Edge Functions do backend.

Cada fase abaixo é **independente e pode ser mergeada separadamente**.

---

## Divergências detectadas entre PRDs e banco real

Antes de implementar, alinhar os seguintes pontos com o banco real:

| # | Divergência | PRD Admin diz | DATABASE.md diz | Usar |
|---|-------------|---------------|-----------------|------|
| 1 | `worker_profiles.subtype` | `package_preparer`, `excursion_preparer` | `shipments`, `excursions` | `shipments` / `excursions` (banco) |
| 2 | `worker_profiles.subtype` de motoristas | `take_me`, `partner` | `takeme`, `partner` | `takeme` / `partner` (banco) |
| 3 | `excursion_passengers.status_departure` | `pending`, `boarded` | `not_embarked`, `embarked`, `disembarked` | `not_embarked` / `embarked` / `disembarked` (banco) |
| 4 | `trip_stops` | Definida no PRD Admin v2.3 | Não consta no DATABASE.md | Verificar se migration já foi aplicada |
| 5 | `worker_assignments` | Referenciada no PRD Admin | Não consta no DATABASE.md | Verificar se a tabela existe no Supabase |

> **Ação necessária antes de iniciar:** rodar `SELECT * FROM information_schema.tables WHERE table_schema = 'public'` no Supabase para confirmar quais tabelas existem.

---

## Fase 1 — worker_assignments: aceitar/recusar solicitações

**Prioridade:** 🔴 Crítica — sem isso o motorista não pode aceitar trabalho algum

**Contexto:** O fluxo de atribuição é central para todos os perfis (motorista, preparador encomendas, preparador excursões). O `PendingRequestsScreen` já lista as solicitações, mas provavelmente não chama a Edge Function corretamente.

### 1.1 Verificar existência da tabela

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'worker_assignments';
```

Campos esperados: `id`, `worker_id`, `entity_type`, `entity_id`, `status`, `expires_at`, `created_at`

### 1.2 Atualizar `PendingRequestsScreen`

**Query atual** (revisar): busca bookings/shipments/excursions separadamente.

**Query correta** (se `worker_assignments` existir):
```typescript
const { data } = await supabase
  .from('worker_assignments')
  .select(`
    id, entity_type, entity_id, status, expires_at, created_at,
    worker_id
  `)
  .eq('worker_id', userId)
  .eq('status', 'assigned')
  .order('expires_at', { ascending: true });
```

Depois fazer join manual com `bookings`, `shipments` ou `excursion_requests` por `entity_id` e `entity_type` para obter os dados de exibição.

**Se `worker_assignments` não existir:** continuar com a lógica atual de busca direta por status.

### 1.3 Implementar aceitar/recusar

```typescript
// Aceitar
const res = await fetch(`${supabaseUrl}/functions/v1/respond-assignment`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ assignmentId: item.id, action: 'accepted' }),
});

// Recusar
const res = await fetch(`${supabaseUrl}/functions/v1/respond-assignment`, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ assignmentId: item.id, action: 'rejected' }),
});
```

**Fallback se Edge Function não existir:** update direto no assignment + no entity:
```typescript
await supabase.from('worker_assignments')
  .update({ status: 'accepted' })
  .eq('id', assignmentId);
```

### 1.4 Countdown até `expires_at`

Adicionar `useEffect` com `setInterval(1000)` que recalcula o tempo restante:
```typescript
const remaining = Math.max(0, new Date(item.expiresAt).getTime() - Date.now());
const mins = Math.floor(remaining / 60000);
const secs = Math.floor((remaining % 60000) / 1000);
// Exibir: "14:32" no card
```

Quando `remaining === 0`: desabilitar botões, mostrar badge "Expirado".

### 1.5 Navegação pós-aceite

| entity_type | Destino |
|-------------|---------|
| `booking` | `TripDetail` com `tripId` = `scheduled_trip_id` do booking |
| `shipment` | `ActiveShipmentScreen` (ambiente encomendas) |
| `excursion` | `DetalhesExcursaoScreen` |

### Arquivos a modificar
- `src/screens/PendingRequestsScreen.tsx`

---

## Fase 2 — trip_stops: ActiveTripScreen com paradas reais

**Prioridade:** 🔴 Crítica — sem isso a viagem não reflete os pontos reais dos passageiros

**Contexto:** O PRD Admin v2.3 define `trip_stops` como fonte de verdade. O `ActiveTripScreen` atual monta as paradas manualmente juntando bookings e shipments, ignorando a ordenação por distância.

### 2.1 Verificar existência de `trip_stops`

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trip_stops';
```

Campos esperados: `id`, `scheduled_trip_id`, `stop_type`, `entity_id`, `label`, `address`, `lat`, `lng`, `sequence_order`, `status`

Verificar também se a função existe:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'generate_trip_stops';
```

### 2.2 Criar hook `useTripStops`

Criar `src/hooks/useTripStops.ts`:

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type TripStop = {
  id: string;
  scheduledTripId: string;
  stopType: 'driver_origin' | 'passenger_pickup' | 'shipment_pickup' | 'base_dropoff' | 'trip_destination';
  entityId: string | null;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sequenceOrder: number;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
};

// Cores por stop_type (PRD Admin §6.5)
export const STOP_TYPE_COLORS: Record<TripStop['stopType'], string> = {
  driver_origin:    '#0d0d0d',
  passenger_pickup: '#3b82f6',
  shipment_pickup:  '#f59e0b',
  base_dropoff:     '#22c55e',
  trip_destination: '#ef4444',
};

export function useTripStops(tripId: string) {
  const [stops, setStops] = useState<TripStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Tenta buscar stops existentes
      const { data, error: fetchErr } = await supabase
        .from('trip_stops')
        .select('*')
        .eq('scheduled_trip_id', tripId)
        .order('sequence_order', { ascending: true });

      if (fetchErr) throw fetchErr;

      // Se não existirem, gera via RPC
      if (!data || data.length === 0) {
        const { error: rpcErr } = await supabase.rpc('generate_trip_stops', { trip_id: tripId });
        if (rpcErr) throw rpcErr;

        // Rebusca após geração
        const { data: generated, error: refetchErr } = await supabase
          .from('trip_stops')
          .select('*')
          .eq('scheduled_trip_id', tripId)
          .order('sequence_order', { ascending: true });

        if (refetchErr) throw refetchErr;
        setStops(mapStops(generated ?? []));
      } else {
        setStops(mapStops(data));
      }
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar paradas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tripId]);

  return { stops, loading, error, reload: load };
}

function mapStops(rows: any[]): TripStop[] {
  return rows.map(r => ({
    id: r.id,
    scheduledTripId: r.scheduled_trip_id,
    stopType: r.stop_type,
    entityId: r.entity_id,
    label: r.label,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    sequenceOrder: r.sequence_order,
    status: r.status,
  }));
}
```

**Fallback** (se `trip_stops` não existir): manter a lógica atual de join manual por enquanto.

### 2.3 Refatorar `ActiveTripScreen`

Substituir o join manual de `bookings` + `shipments` por `useTripStops`:

1. Remover query manual de bookings/shipments para montar `stops`
2. Usar `useTripStops(tripId)` e mapear para o formato de `Stop` existente
3. `currentStopIndex` continua o mesmo — avança quando o motorista confirma

**Confirmar parada:**
```typescript
const confirmStop = async (stopId: string) => {
  await supabase
    .from('trip_stops')
    .update({ status: 'completed' })
    .eq('id', stopId);
  setCurrentStopIndex(prev => prev + 1);
};
```

**Finalizar viagem** (todos stops completed):
```typescript
await supabase
  .from('scheduled_trips')
  .update({ status: 'completed' })
  .eq('id', tripId);

// Registrar no histórico
await supabase.from('status_history').insert({
  entity_type: 'trip',
  entity_id: tripId,
  status: 'completed',
  label: 'Viagem concluída',
  changed_by: userId,
});
```

### 2.4 Marcadores coloridos no mapa por `stop_type`

Substituir a lógica atual (que diferencia só `booking` vs `shipment`) por cores baseadas em `stopType`:

```typescript
import { STOP_TYPE_COLORS } from '../hooks/useTripStops';

// No marcador:
<View style={[styles.mapMarker, { backgroundColor: STOP_TYPE_COLORS[stop.stopType] }]}>
  {stop.stopType === 'passenger_pickup' && <MaterialIcons name="person" size={18} color="#fff" />}
  {stop.stopType === 'shipment_pickup' && <MaterialIcons name="inventory-2" size={18} color="#fff" />}
  {stop.stopType === 'base_dropoff' && <MaterialIcons name="warehouse" size={18} color="#fff" />}
  {stop.stopType === 'trip_destination' && <MaterialIcons name="flag" size={18} color="#fff" />}
</View>
```

### 2.5 Sidebar direita por tipo de stop

Mesma lógica: cor e ícone do botão da sidebar seguem `STOP_TYPE_COLORS[stop.stopType]`.

### Arquivos a criar/modificar
- `src/hooks/useTripStops.ts` (criar)
- `src/screens/ActiveTripScreen.tsx` (modificar)

---

## Fase 3 — Encomendas: 2 cenários de negócio

**Prioridade:** 🔴 Crítica — o fluxo atual ignora a lógica de base intermediária

**Contexto banco:**
- `shipments.base_id`: preenchido quando a encomenda deve passar por uma base
- `worker_profiles.subtype`: `'shipments'` = preparador de encomendas; `'takeme'` ou `'partner'` = motorista
- RPC `nearest_active_base(lat, lng)` retorna a base mais próxima (verificar existência)

### 3.1 Detectar cenário no `ActiveShipmentScreen`

```typescript
// Buscar perfil do worker ao montar a tela
const { data: workerProfile } = await supabase
  .from('worker_profiles')
  .select('role, subtype')
  .eq('id', userId)
  .single();

// Cenário 1: preparador de encomendas (usa base intermediária)
const isScenario1 = workerProfile?.role === 'preparer' && workerProfile?.subtype === 'shipments';

// Cenário 2: motorista (entrega direta)
const isScenario2 = workerProfile?.role === 'driver';
```

### 3.2 Cenário 1 — preparador de encomendas

Fluxo de paradas: `driver_position → pickup_address → base`

```typescript
// Se shipment.base_id já estiver preenchido, usar diretamente
if (shipment.base_id) {
  const { data: base } = await supabase
    .from('bases')
    .select('name, address, lat, lng')
    .eq('id', shipment.base_id)
    .single();
  // montar rota de 3 pontos
}

// Se não estiver preenchido e tiver GPS, buscar base mais próxima
if (!shipment.base_id && driverPosition) {
  const { data: base } = await supabase.rpc('nearest_active_base', {
    lat: driverPosition.latitude,
    lng: driverPosition.longitude,
  });
  // usar base retornada
}
```

**Paradas do Cenário 1:**
```
[0] Você (driver_position) — ponto de partida
[1] Coleta: recipient_name no origin_address — confirmação com pickup_code
[2] Base Take Me: base.name no base.address — dropoff; atualiza shipment.base_id
```

**Ao completar dropoff na base:**
```typescript
await supabase.from('shipments').update({
  status: 'in_progress',  // base assume responsabilidade
  base_id: base.id,
}).eq('id', shipmentId);
```

### 3.3 Cenário 2 — motorista (carro)

Fluxo de paradas: `driver_position → pickup_address → destination_address`

**Paradas do Cenário 2:**
```
[0] Você (driver_position) — ponto de partida
[1] Coleta: recipient_name no origin_address — confirmação com pickup_code
[2] Entrega: recipient_name no destination_address — confirmação com delivery_code
```

**Ao completar entrega:**
```typescript
await supabase.from('shipments').update({
  status: 'delivered',
  delivered_at: new Date().toISOString(),
}).eq('id', shipmentId);
```

### 3.4 Confirmação de códigos via Edge Function

```typescript
const confirmCode = async (type: 'pickup' | 'delivery', code: string) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/confirm-code`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entity_type: 'shipment',
      entity_id: shipmentId,
      code_type: type,
      code,
    }),
  });
  const result = await res.json();
  if (!result.valid) throw new Error('Código inválido');
};
```

**Fallback** (se Edge Function não responder): comparar código localmente com `shipment.pickup_code` / `shipment.delivery_code`.

### 3.5 Roteamento no `HomeEncomendasScreen`

**Regras de roteamento** (DATABASE.md §shipments):
- `package_size === 'grande'` → vai direto para motorista (nunca para preparador)
- Cidade de origem tem base ativa → notifica preparadores da base primeiro
- Nenhum preparador aceita em 1h antes da viagem → redireciona para motorista

O app do preparador deve mostrar apenas encomendas onde:
```typescript
// Para preparador de encomendas (subtype='shipments')
const { data } = await supabase
  .from('shipments')
  .select('*, bases(name, city)')
  .eq('status', 'pending_review')
  .eq('package_size', 'pequeno')  // grandes nunca vão para preparador
  .is('driver_id', null)  // sem motorista atribuído
  // idealmente filtrar por base_id === workerProfile.base_id
  .order('created_at', { ascending: false });
```

### Arquivos a modificar
- `src/screens/encomendas/ActiveShipmentScreen.tsx`
- `src/screens/encomendas/HomeEncomendasScreen.tsx`

---

## Fase 4 — Excursões: dados reais + check-in/check-out

**Prioridade:** 🟡 Média — atualmente usa mock data, bloqueante para preparadores de excursão

### 4.1 `HomeExcursoesScreen` — remover mock data

**Substituir** todo o array `MOCK_EXCURSIONS` por query real:

```typescript
const loadExcursions = useCallback(async () => {
  setLoading(true);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from('excursion_requests')
    .select('id, destination, excursion_date, people_count, fleet_type, status, scheduled_departure_at')
    .eq('preparer_id', user.id)
    .in('status', ['scheduled', 'in_progress', 'approved'])
    .order('excursion_date', { ascending: true });

  setExcursions(data ?? []);
  setLoading(false);
}, []);
```

**Card da excursão:**
- Destino, data, número de pessoas, tipo de frota, status badge
- Botão "Ver detalhes" → navega para `DetalhesExcursaoScreen` com o `id`

### 4.2 `DetalhesExcursaoScreen` — passageiros e check-in/check-out

**Query de passageiros:**
```typescript
const { data: passengers } = await supabase
  .from('excursion_passengers')
  .select('id, full_name, cpf, phone, age, gender, observations, status_departure, status_return')
  .eq('excursion_request_id', excursionId)
  .order('full_name', { ascending: true });
```

**Check-in (embarque):**
```typescript
const checkIn = async (passengerId: string) => {
  await supabase
    .from('excursion_passengers')
    .update({ status_departure: 'embarked' })
    .eq('id', passengerId);
};
```

**Check-out (retorno):**
```typescript
const checkOut = async (passengerId: string) => {
  await supabase
    .from('excursion_passengers')
    .update({ status_return: 'embarked' })  // status: 'embarked' = embarcou no retorno
    .eq('id', passengerId);
};
```

**Nota sobre status** (banco real):
- `status_departure`: `'not_embarked'` → `'embarked'` → `'disembarked'`
- `status_return`: `'not_embarked'` → `'embarked'` → `'disembarked'`

**Toggle "Ordenar por idade":**
```typescript
const sorted = [...passengers].sort((a, b) =>
  sortByAge ? parseInt(a.age) - parseInt(b.age) : 0
);
```

**CPF mascarado** (exibir apenas últimos 2 dígitos):
```typescript
const maskCpf = (cpf: string) => cpf.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '***.***.***-$4');
```

**Contador embarcados:**
```typescript
const boardedCount = passengers.filter(p => p.status_departure === 'embarked').length;
// Exibir: "8 / 24 embarcados"
```

**Alterar status da excursão:**
```typescript
// Iniciar
const startExcursion = async () => {
  await supabase.from('excursion_requests')
    .update({ status: 'in_progress', navigation_phase: 'outbound' })
    .eq('id', excursionId);
};

// Concluir
const finishExcursion = async () => {
  await supabase.from('excursion_requests')
    .update({ status: 'completed', navigation_phase: 'completed' })
    .eq('id', excursionId);
  await supabase.from('status_history').insert({
    entity_type: 'excursion',
    entity_id: excursionId,
    status: 'completed',
    label: 'Excursão concluída',
    changed_by: userId,
  });
};
```

### 4.3 `ColetasExcursoesScreen` — conectar filtro

```typescript
// Filtro atual não funciona; implementar:
const [filterStatus, setFilterStatus] = useState<string>('all');

const filtered = excursions.filter(e =>
  filterStatus === 'all' || e.status === filterStatus
);
```

### Arquivos a modificar
- `src/screens/excursoes/HomeExcursoesScreen.tsx`
- `src/screens/excursoes/DetalhesExcursaoScreen.tsx`
- `src/screens/excursoes/ColetasExcursoesScreen.tsx`

---

## Fase 5 — Mapas reais nas telas de detalhe

**Prioridade:** 🟡 Média — melhoria visual importante

### 5.1 `DetalhesEncomendaScreen` — substituir placeholder

O mapa atual é um ícone estático. Substituir por `GoogleMapsMap` real:

```typescript
// Após buscar a encomenda:
const originLL = latLngFromDbColumns(shipment.origin_lat, shipment.origin_lng);
const destLL = latLngFromDbColumns(shipment.destination_lat, shipment.destination_lng);

// No render, substituir o placeholder:
{originLL && destLL && (
  <View style={styles.mapContainer}>
    <GoogleMapsMap
      style={{ width: '100%', height: '100%' }}
      initialRegion={regionFromLatLngPoints([originLL, destLL])}
      scrollEnabled={false}
    >
      <MapMarker id="origin" coordinate={originLL} pinColor="#111827" />
      <MapMarker id="dest" coordinate={destLL} pinColor="#C9A227" />
      {/* Opcional: traçar rota */}
    </GoogleMapsMap>
  </View>
)}
```

### 5.2 `DetalhesExcursaoScreen` — verificar se usa Mapbox

O arquivo usa `GoogleMapsMap` (wrapper Mapbox) ou a antiga `react-native-maps`? Se usar react-native-maps, migrar para o wrapper `GoogleMapsMap` do motorista.

### Arquivos a modificar
- `src/screens/encomendas/DetalhesEncomendaScreen.tsx`
- `src/screens/excursoes/DetalhesExcursaoScreen.tsx` (verificar)

---

## Fase 6 — Notificações e status_history

**Prioridade:** 🟡 Média

### 6.1 `NotificationsScreen` — query real

```typescript
const { data } = await supabase
  .from('notifications')
  .select('id, title, message, category, read_at, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50);
```

**Marcar como lida:**
```typescript
await supabase.from('notifications')
  .update({ read_at: new Date().toISOString() })
  .eq('id', notificationId);
```

### 6.2 Badge de não lidas na navbar

No `HomeScreen` ou no navigator raiz, manter um estado global com a contagem:

```typescript
const { count } = await supabase
  .from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .is('read_at', null);
```

Exibir como badge no tab "Home" ou como número no botão de sino no header.

### 6.3 `status_history` — inserir ao mudar status

Em qualquer tela que muda status de uma entidade, inserir registro:

```typescript
const insertHistory = async (entityType: string, entityId: string, status: string, label: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('status_history').insert({
    entity_type: entityType,
    entity_id: entityId,
    status,
    label,
    changed_by: user?.id,
  });
};
```

Chamadas obrigatórias:
- Viagem concluída: `insertHistory('trip', tripId, 'completed', 'Viagem concluída pelo motorista')`
- Encomenda coletada: `insertHistory('shipment', shipmentId, 'in_progress', 'Encomenda coletada')`
- Encomenda entregue: `insertHistory('shipment', shipmentId, 'delivered', 'Encomenda entregue')`
- Excursão iniciada: `insertHistory('excursion', excursionId, 'in_progress', 'Excursão iniciada')`
- Excursão concluída: `insertHistory('excursion', excursionId, 'completed', 'Excursão concluída')`

### Arquivos a modificar
- `src/screens/NotificationsScreen.tsx`
- Criar utilitário `src/lib/statusHistory.ts`

---

## Fase 7 — Realtime (opcional mas recomendado)

**Prioridade:** 🟢 Baixa — melhoria de UX

### 7.1 `PendingRequestsScreen` — novos assignments em tempo real

```typescript
useEffect(() => {
  const channel = supabase
    .channel('pending-requests')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'worker_assignments',
      filter: `worker_id=eq.${userId}`,
    }, () => { load(); })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [userId]);
```

### 7.2 `ActiveTripScreen` — atualizações de `trip_stops`

Para refletir mudanças feitas pelo admin (ex.: adicionar passageiro em tempo real):
```typescript
const channel = supabase
  .channel('trip-stops')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'trip_stops',
    filter: `scheduled_trip_id=eq.${tripId}`,
  }, () => { reloadStops(); })
  .subscribe();
```

---

## Ordem de execução recomendada

```
Fase 1 (assignments)  ──┐
                        ├──> Branch: motorista/assignments
Fase 2 (trip_stops)   ──┘

Fase 3 (encomendas)   ──── Branch: motorista/cenarios-encomenda

Fase 4 (excursoes)    ──── Branch: motorista/excursoes-reais

Fase 5 (mapas)        ──── Branch: motorista/mapas-detalhe   (paralelo com Fase 4)

Fase 6 (notificações) ──── Branch: motorista/notificacoes    (mais tarde)

Fase 7 (realtime)     ──── Branch: motorista/realtime        (opcional)
```

---

## Checklist de validação antes do merge de cada fase

### Fase 1
- [ ] `worker_assignments` existe no banco
- [ ] Aceitar assignment chama endpoint correto (Edge Function ou update direto)
- [ ] Recusar assignment dispara estorno (verificar com admin)
- [ ] Countdown funciona sem travar a UI
- [ ] Assignment expirado não permite aceite
- [ ] Navegação pós-aceite leva para a tela correta por `entity_type`

### Fase 2
- [ ] `trip_stops` existe no banco
- [ ] `generate_trip_stops()` existe como RPC
- [ ] Paradas exibidas na ordem correta (`sequence_order`)
- [ ] Confirmar parada atualiza `trip_stops.status = 'completed'`
- [ ] Finalizar viagem atualiza `scheduled_trips.status = 'completed'`
- [ ] Marcadores coloridos por `stop_type` no mapa
- [ ] Fallback para join manual funciona se `trip_stops` não existir

### Fase 3
- [ ] Subtype detectado corretamente (`'shipments'` vs `'takeme'`/`'partner'`)
- [ ] Cenário 1: rota de 3 pontos com base correta
- [ ] Cenário 2: rota de 2 pontos direto ao destino
- [ ] Confirmação de código via `confirm-code` ou fallback local
- [ ] `HomeEncomendasScreen` não mostra encomendas `package_size='grande'` para preparadores
- [ ] Status da shipment atualizado corretamente

### Fase 4
- [ ] `HomeExcursoesScreen` busca dados reais (sem mock)
- [ ] Check-in atualiza `status_departure = 'embarked'`
- [ ] Check-out atualiza `status_return = 'embarked'`
- [ ] Contador de embarcados correto
- [ ] Toggle ordenar por idade funciona
- [ ] CPF mascarado na lista

### Fase 5
- [ ] Mapa aparece em `DetalhesEncomendaScreen` com origin e dest
- [ ] Coordenadas (0,0) não passam pela validação

### Fase 6
- [ ] `NotificationsScreen` mostra dados reais
- [ ] Marcar como lida funciona
- [ ] `status_history` inserido em todas as mudanças de status

---

## Observações finais

1. **Migrations necessárias:** Confirmar com o time de backend se `trip_stops` e `worker_assignments` já existem no banco de produção. Se não existirem, precisam de migrations antes de qualquer implementação no app.

2. **Edge Functions:** `respond-assignment` e `confirm-code` precisam estar deployadas. Verificar no dashboard Supabase → Edge Functions.

3. **Subtypes divergentes:** O banco usa `subtype = 'shipments'`/`'excursions'` mas o PRD Admin usa `package_preparer`/`excursion_preparer`. Usar sempre os valores reais do banco. Mesma divergência para motoristas: banco usa `'takeme'`, não `'take_me'`.

4. **`status_history`:** Verificar se a tabela existe no banco antes de implementar a Fase 6.
