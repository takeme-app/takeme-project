# Atualização: atendimento, suporte e apps (admin / cliente / motorista)

Documento de referência do pacote enviado à `main` (commit com atendimento backoffice, tickets de suporte, mapas admin e migrations Supabase).

## Admin (`apps/admin`)

| Área | Arquivos |
|------|-----------|
| Dados / tipos | `src/data/queries.ts`, `src/data/types.ts` |
| Mapa | `src/hooks/useTripMapCoords.ts`, `src/lib/mapCoordUtils.ts`, `src/hooks/useEncomendaMapCoords.ts` (novo) |
| Telas | `src/screens/AtendimentosScreen.tsx`, `AtendimentoDetalheScreen.tsx`, `ConfiguracoesScreen.tsx`, `EncomendasScreen.tsx`, `EncomendaEditScreen.tsx`, `ViagemEditScreen.tsx` |
| E2E | `e2e/admin-lists-data-filters.spec.ts` |

## Cliente (`apps/cliente`)

| Área | Arquivos |
|------|-----------|
| Suporte / tickets | `src/lib/supportTickets.ts` (novo) |
| Fluxos integrados | `src/screens/excursion/ExcursionRequestFormScreen.tsx`, `src/screens/profile/AddDependentScreen.tsx`, `src/screens/shipment/ConfirmShipmentScreen.tsx`, `src/screens/trip/TripDetailScreen.tsx` |

## Motorista (`apps/motorista`)

| Área | Arquivos |
|------|-----------|
| Suporte / tickets | `src/lib/supportTickets.ts` (novo) |
| Cadastro / fluxo | `src/lib/motoristaRegistration.ts` |

> Escopo preparador de encomendas: alterações limitadas ao combinado; não expandir esse ambiente sem pedido explícito.

## Backend Supabase

| Área | Arquivos |
|------|-----------|
| Edge | `supabase/functions/manage-admin-users/index.ts` (subtipos admin / suporte / financeiro) |
| Migrations | `supabase/migrations/20260410200000_admin_shipments_insert_update.sql` (RLS insert/update admin em `shipments`) |
| Migrations | `supabase/migrations/20260411160000_support_atendimento_conversations.sql` (conversas suporte, SLA, RPCs, RLS, storage) |

## Banco remoto (Take Me)

As políticas de admin em `shipments` podem já existir no projeto Supabase; a migration de **suporte / atendimento** foi aplicada via MCP em duas etapas com nomes registrados no histórico remoto. O arquivo local de suporte usa o timestamp **`20260411160000`** para não colidir com `20260411120000_order_pricing_snapshot_and_weekly_adjustments.sql` na mesma `main`.

## Próximos passos opcionais

- Regenerar tipos do Postgrest nos apps para expor `open_support_ticket` sem `as any`, se o fluxo do repo incluir isso.
- Publicar Edge `manage-admin-users` no Supabase se ainda não estiver alinhada ao código local (`supabase functions deploy`).
