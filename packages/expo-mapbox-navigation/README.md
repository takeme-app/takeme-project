# @take-me/expo-mapbox-navigation

Expo Module local que expõe o **Mapbox Navigation SDK v3** (iOS Swift +
Android Kotlin) ao app `motorista`. Substitui a navegação caseira em JS
(`apps/motorista/src/lib/navigationCamera.ts` + `routeSnap.ts` + dead-reckoning)
por turn-by-turn nativo com voz, banner de manobras e reroute do SDK.

> Status: **scaffold da Fase 2**. A integração concreta com o SDK está
> pseudo-codada nos arquivos Swift/Kotlin e será concluída no spike da Fase 0.
> Ver `docs/MIGRATION_MAPBOX_NAVIGATION_SDK.md`.

## Uso (JS)

```tsx
import { ExpoMapboxNavigationView } from '@take-me/expo-mapbox-navigation';

<ExpoMapboxNavigationView
  style={{ flex: 1 }}
  waypoints={[
    { latitude: -23.55, longitude: -46.63, name: 'Origem' },
    { latitude: -23.56, longitude: -46.65, name: 'Cliente A' },
    { latitude: -23.58, longitude: -46.67, name: 'Destino' },
  ]}
  profile="driving-traffic"
  voiceLanguage="pt-BR"
  cameraMode="following"
  onRouteProgress={(e) => console.log('progress', e.nativeEvent)}
  onArrival={(e) => console.log('arrival', e.nativeEvent)}
  onReroute={() => console.log('reroute')}
>
  {/* overlays React (sheets, badges, botões) sobre o mapa nativo */}
</ExpoMapboxNavigationView>
```

## Configuração necessária

### iOS

O `Podfile` do app motorista já tem `use_expo_modules!` — o autolinking faz o
resto. Apenas garanta que `MAPBOX_DOWNLOADS_TOKEN` está disponível no
ambiente do build (CocoaPods o lê do `~/.netrc` para baixar o pod
`MapboxNavigation`).

### Android

Adicione ao `~/.gradle/gradle.properties` (e nos secrets do EAS):

```
MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1...
```

E ao `apps/motorista/android/build.gradle` (no `allprojects { repositories }`):

```gradle
maven {
  url 'https://api.mapbox.com/downloads/v2/releases/maven'
  authentication { basic(BasicAuthentication) }
  credentials {
    username 'mapbox'
    password project.findProperty('MAPBOX_DOWNLOADS_TOKEN') ?: ''
  }
}
```

## Eventos

| Evento              | Quando dispara                                                  |
| ------------------- | --------------------------------------------------------------- |
| `onReady`           | View nativa pronta (mapa carregado).                             |
| `onRouteProgress`   | A cada tick GPS / progresso de manobra.                          |
| `onWaypointArrival` | Chegada a uma parada intermediária.                              |
| `onArrival`         | Chegada à parada final.                                          |
| `onReroute`         | SDK detectou off-route e calculou nova rota automaticamente.     |
| `onOffRoute`        | Sinal "soft" antes do reroute consolidar.                        |
| `onCancel`          | Sessão encerrada (botão cancelar / erro).                        |

## Migração a partir do `<GoogleMapsMap>` legado

| Legado JS (`@rnmapbox/maps`)          | Substituto nativo                              |
| ------------------------------------- | ---------------------------------------------- |
| `setNavigationCamera({...})`          | `cameraMode="following"` + SDK gerencia        |
| Polyline manual + dead-reckoning      | Linha de rota + puck nativos                   |
| `routeSnap.ts` (snap caseiro)         | Map matching nativo do SDK                     |
| `useRerouteController` (heurística JS)| `RerouteController` do SDK + evento `onReroute`|
| `MapPolyline` para "trecho imediato"  | Banner de manobra do SDK                        |
| `expo-location` watch GPS             | Continua para **odômetro**; o resto vem do SDK |

## Estrutura do pacote

```
packages/expo-mapbox-navigation/
├── package.json
├── expo-module.config.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts
│   ├── ExpoMapboxNavigation.types.ts
│   ├── ExpoMapboxNavigationModule.ts
│   └── ExpoMapboxNavigationView.tsx
├── ios/
│   ├── ExpoMapboxNavigation.podspec
│   ├── ExpoMapboxNavigationModule.swift
│   └── ExpoMapboxNavigationView.swift
└── android/
    ├── build.gradle
    └── src/main/
        ├── AndroidManifest.xml
        └── java/expo/modules/mapboxnavigation/
            ├── ExpoMapboxNavigationModule.kt
            └── ExpoMapboxNavigationView.kt
```
