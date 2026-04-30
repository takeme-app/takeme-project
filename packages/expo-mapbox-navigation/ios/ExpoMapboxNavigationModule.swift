import ExpoModulesCore
#if canImport(MapboxNavigationCore)
import MapboxNavigationCore
#endif

/**
 * Módulo Expo que expõe o `MapboxNavigationView` (Mapbox Navigation SDK v3) ao
 * React Native. A `View` em si fica em `ExpoMapboxNavigationView.swift`; aqui
 * só registramos as funções globais (versão do SDK, disponibilidade) e fazemos
 * o binding do view manager.
 *
 * Spike (Fase 0): este módulo é o ponto de entrada para validar billing,
 * voice pt-BR e setRoute dinâmico. Ver `docs/MIGRATION_MAPBOX_NAVIGATION_SDK.md`.
 */
public class ExpoMapboxNavigationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoMapboxNavigation")

    Function("isAvailable") { () -> Bool in
      #if canImport(MapboxNavigationCore) && canImport(MapboxNavigationUIKit)
      return true
      #else
      return false
      #endif
    }

    Function("getSdkVersion") { () -> String in
      #if canImport(MapboxNavigationCore) && canImport(MapboxNavigationUIKit)
      return "3.5.0"
      #else
      return "unavailable"
      #endif
    }

    View(ExpoMapboxNavigationView.self) {
      Events(
        "onRouteProgress",
        "onReroute",
        "onArrival",
        "onWaypointArrival",
        "onOffRoute",
        "onCancel",
        "onReady"
      )

      Prop("waypoints") { (view: ExpoMapboxNavigationView, waypoints: [[String: Any]]) in
        view.updateWaypoints(waypoints)
      }
      Prop("accessToken") { (view: ExpoMapboxNavigationView, token: String?) in
        view.updateAccessToken(token)
      }
      Prop("profile") { (view: ExpoMapboxNavigationView, profile: String) in
        view.updateProfile(profile)
      }
      Prop("voiceLanguage") { (view: ExpoMapboxNavigationView, language: String) in
        view.updateVoiceLanguage(language)
      }
      Prop("simulateRoute") { (view: ExpoMapboxNavigationView, simulate: Bool) in
        view.updateSimulateRoute(simulate)
      }
      Prop("mute") { (view: ExpoMapboxNavigationView, mute: Bool) in
        view.updateMute(mute)
      }
      Prop("cameraMode") { (view: ExpoMapboxNavigationView, mode: String) in
        view.updateCameraMode(mode)
      }
      Prop("routeLineColor") { (view: ExpoMapboxNavigationView, color: String?) in
        view.updateRouteLineColor(color)
      }
      Prop("hideManeuverBanner") { (view: ExpoMapboxNavigationView, hidden: Bool) in
        view.updateHideManeuverBanner(hidden)
      }
      Prop("hideBottomPanel") { (view: ExpoMapboxNavigationView, hidden: Bool) in
        view.updateHideBottomPanel(hidden)
      }
    }
  }
}
