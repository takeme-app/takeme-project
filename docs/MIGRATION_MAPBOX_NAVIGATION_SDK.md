# Migração para Mapbox Navigation SDK v3 — App Motorista

Este documento é o **guia de execução** da migração da navegação caseira (JS) para o Mapbox Navigation SDK v3 nativo no app `motorista`. Acompanha o plano `migracao mapbox navigation sdk` em `.cursor/plans/`.

> Escopo: `ActiveTripScreen.tsx` (passageiro) + `ActiveShipmentScreen.tsx` (motorista de encomendas).
> Fora de escopo (regra de workspace): qualquer fluxo do **preparador de encomendas** (`preparer_*`, `preparer_shipment_queue`, RPCs do preparador).

## Estado por fase

| Fase | Descrição                                                                             | Status              |
| ---- | -------------------------------------------------------------------------------------- | ------------------- |
| 0    | Spike, billing, decisão A/B/C                                                          | Documentado         |
| 1    | Hooks `useDriverFix`, `useNavigationCamera`, `useRerouteController`, `useTripRoute`    | Implementado        |
| 2    | Native bridge `packages/expo-mapbox-navigation/` (iOS Swift + Android Kotlin)          | Scaffold pronto     |
| 3    | Wrapper `<NavigationView>` com feature flag em `ActiveTripScreen`                       | Wrapper + flag      |
| 4    | Mesmo wrapper em `ActiveShipmentScreen`                                                 | Wrapper + flag      |
| 5    | `.env.example` + QA matrix + documentação de toggle                                     | Concluído           |

## Fase 0 — Decisão chave: como integrar

Não existe wrapper RN oficial. Caminhos:

### A. Expo Module próprio (recomendado, escolhido)
- Embrulha `MapboxNavigationView` (iOS, Swift) + `NavigationView`/`MapboxNavigationApp` (Android, Kotlin).
- Permite `children` React sobrepostos (sheets de coleta, badges custom).
- Custo: ~5-7 dias de spike + 1 sprint para hardening.
- Pacote local: [packages/expo-mapbox-navigation/](../packages/expo-mapbox-navigation/).

### B. Drop-in UI do SDK v3 (descartado)
- UI do SDK ocupa tela cheia; nossas confirmações de coleta/entrega exigem overlays customizados.

### C. `@pawan-pk/react-native-mapbox-navigation` (descartado como solução final)
- Comunidade. Útil como referência durante o spike, mas waypoints encadeados de pickup/delivery em `ActiveShipmentScreen` exigem `setRoute` dinâmico que o pacote não expõe.

## Checklist do spike

- [ ] Confirmar plano de billing Mapbox (Maps SDK + Navigation SDK = sessões ativas faturadas).
- [ ] Criar **secret token** `MAPBOX_DOWNLOADS_TOKEN` com escopo `Downloads:Read` em https://account.mapbox.com/access-tokens/ (necessário para o SDK Android baixar artefatos do registry Mapbox).
- [ ] Adicionar o secret token no `~/.gradle/gradle.properties` (dev) e nos secrets do EAS (build).
- [ ] Confirmar suporte a Fabric/New Architecture — `app.json` já tem `newArchEnabled: true`.
- [ ] Spike: rodar `expo run:ios` e `expo run:android` com o módulo `packages/expo-mapbox-navigation/` plugado, validando:
  - [ ] `<ExpoMapboxNavigationView>` carrega o mapa e a rota.
  - [ ] `onRouteProgress`, `onArrival`, `onReroute` disparam.
  - [ ] Voz pt-BR funciona em ambos OS.
  - [ ] Overlay React (botão back custom, sheet de coleta) é interativo sobre o mapa nativo.
  - [ ] `setRoute(newWaypoints)` recalcula a rota sem recriar a view nativa.
- [ ] Filmar viagem real navegando como critério de saída.

## Variáveis de ambiente novas

Adicionar em `.env.example` da raiz:
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` — já existe (token público).
- `MAPBOX_DOWNLOADS_TOKEN` — **novo, secreto**. NÃO é `EXPO_PUBLIC_`. Usado apenas no host (gradle/CocoaPods) para autenticar o download do SDK.

## Feature flag

A migração é gateada por `EXPO_PUBLIC_USE_NATIVE_NAVIGATION`. Durante o rollout:
- `EXPO_PUBLIC_USE_NATIVE_NAVIGATION=0` (default) → usa o caminho legado JS (mapa Mapbox + câmera caseira).
- `EXPO_PUBLIC_USE_NATIVE_NAVIGATION=1` → usa `<ExpoMapboxNavigationView>`.

Implementação em [apps/motorista/src/lib/navigationFeatureFlag.ts](../apps/motorista/src/lib/navigationFeatureFlag.ts).

## Matriz de QA (Fase 5)

| Cenário                                         | Android baixo-tier | iPhone bateria fraca | Túnel longo | Modo avião mid-trip |
| ----------------------------------------------- | ------------------ | -------------------- | ----------- | ------------------- |
| Início de viagem → primeira parada               |                    |                      |             |                     |
| Reroute manual (saída da rota)                   |                    |                      |             |                     |
| Múltiplas paradas com `setRoute`                 |                    |                      |             |                     |
| Voz pt-BR de manobra                             |                    |                      |             |                     |
| Chegada à última parada (`onArrival`)            |                    |                      |             |                     |
| Volta à tela após background 2+ minutos          |                    |                      |             |                     |
| `ActiveShipmentScreen` com pickup/delivery alternados |                |                      |             |                     |

Marque cada célula com ✅ / ❌ + link para vídeo/issue.

## Reversão

Se algo regredir em produção, basta `EXPO_PUBLIC_USE_NATIVE_NAVIGATION=0` + republicar o JS bundle (OTA via EAS Update). Os arquivos legados (`navigationCamera.ts`, `routeSnap.ts`, `MapPolyline`, dead-reckoning loop) só são removidos na Fase 5 **após** a flag ficar 100% verde por 2 semanas em produção.
