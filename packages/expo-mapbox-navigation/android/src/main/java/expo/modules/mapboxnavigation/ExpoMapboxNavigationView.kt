package expo.modules.mapboxnavigation

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import com.mapbox.api.directions.v5.models.RouteOptions
import com.mapbox.common.MapboxOptions
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.EdgeInsets
import com.mapbox.maps.MapInitOptions
import com.mapbox.maps.MapView
import com.mapbox.maps.Style
import com.mapbox.maps.plugin.animation.camera
import com.mapbox.maps.plugin.locationcomponent.createDefault2DPuck
import com.mapbox.maps.plugin.locationcomponent.location
import com.mapbox.navigation.base.extensions.applyDefaultNavigationOptions
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.base.route.NavigationRouterCallback
import com.mapbox.navigation.base.route.RouterFailure
import com.mapbox.navigation.base.trip.model.RouteProgressState
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.MapboxNavigationProvider
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver
import com.mapbox.navigation.core.trip.session.RouteProgressObserver
import com.mapbox.navigation.ui.maps.camera.NavigationCamera
import com.mapbox.navigation.ui.maps.camera.data.MapboxNavigationViewportDataSource
import com.mapbox.navigation.ui.maps.location.NavigationLocationProvider
import com.mapbox.navigation.ui.maps.route.line.api.MapboxRouteLineApi
import com.mapbox.navigation.ui.maps.route.line.api.MapboxRouteLineView
import com.mapbox.navigation.ui.maps.route.line.model.MapboxRouteLineApiOptions
import com.mapbox.navigation.ui.maps.route.line.model.MapboxRouteLineViewOptions
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * View nativa Android baseada no Mapbox Navigation SDK v3.
 *
 * A UI é composta pelos blocos oficiais do SDK: Maps SDK (`MapView`), route line,
 * navigation camera, location matcher e `MapboxNavigation` para rota/progresso.
 * Os overlays React continuam acima desta view no wrapper JS.
 */
class ExpoMapboxNavigationView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  val onRouteProgress by EventDispatcher()
  val onReroute by EventDispatcher()
  val onArrival by EventDispatcher()
  val onWaypointArrival by EventDispatcher()
  val onOffRoute by EventDispatcher()
  val onCancel by EventDispatcher()
  val onReady by EventDispatcher()

  // Estado pendente (cache até o SDK estar pronto).
  private var pendingWaypoints: List<Map<String, Any?>> = emptyList()
  private var pendingAccessToken: String? = null
  private var pendingProfile: String = "driving-traffic"
  private var pendingVoiceLanguage: String = "pt-BR"
  private var pendingSimulateRoute: Boolean = false
  private var pendingMute: Boolean = false
  private var pendingCameraMode: String = "following"
  private var pendingRouteLineColor: String? = null
  private var pendingHideManeuverBanner: Boolean = false
  private var pendingHideBottomPanel: Boolean = false

  /** Padding lógico em **dp** (valores vindos do RN; multiplicamos por `density`). */
  private var followingPadTopDp: Double = 120.0
  private var followingPadStartDp: Double = 40.0
  private var followingPadBottomDp: Double = 220.0
  private var followingPadEndDp: Double = 40.0
  private var pendingFollowingZoom: Double? = null
  private var lastRecenterRequestKey: Int? = null

  private var mapView: MapView? = null
  private var mapboxNavigation: MapboxNavigation? = null
  private var viewportDataSource: MapboxNavigationViewportDataSource? = null
  private var navigationCamera: NavigationCamera? = null
  private var routeLineApi: MapboxRouteLineApi? = null
  private var routeLineView: MapboxRouteLineView? = null
  private val navigationLocationProvider = NavigationLocationProvider()
  private var lastEnhancedLocation: com.mapbox.common.location.Location? = null
  private var driverFocusModeEnabled = false
  private var lastCompletedLegIndex: Int? = null
  private var didEmitOffRoute = false
  private var hasSetInitialRoute = false

  private val routesObserver = RoutesObserver { routeUpdateResult ->
    val routes = routeUpdateResult.navigationRoutes
    if (routes.isEmpty()) return@RoutesObserver
    if (hasSetInitialRoute) {
      onReroute(mapOf("reason" to "off-route"))
    } else {
      hasSetInitialRoute = true
    }
    val mv = mapView ?: return@RoutesObserver
    routeLineApi?.setNavigationRoutes(routes) { value ->
      mv.mapboxMap.style?.let { style -> routeLineView?.renderRouteDrawData(style, value) }
    }
    viewportDataSource?.onRouteChanged(routes.first())
    viewportDataSource?.evaluate()
    if (!driverFocusModeEnabled) navigationCamera?.requestNavigationCameraToFollowing()
  }

  private val locationObserver = object : LocationObserver {
    override fun onNewRawLocation(rawLocation: com.mapbox.common.location.Location) = Unit

    override fun onNewLocationMatcherResult(locationMatcherResult: LocationMatcherResult) {
      val enhancedLocation = locationMatcherResult.enhancedLocation
      lastEnhancedLocation = enhancedLocation
      navigationLocationProvider.changePosition(
        location = enhancedLocation,
        keyPoints = locationMatcherResult.keyPoints,
      )
      viewportDataSource?.onLocationChanged(enhancedLocation)
      viewportDataSource?.evaluate()
      if (driverFocusModeEnabled) {
        applyDriverFocusCamera(enhancedLocation)
      } else if (pendingCameraMode == "following") {
        navigationCamera?.requestNavigationCameraToFollowing()
      }
    }
  }

  private val routeProgressObserver = RouteProgressObserver { progress ->
    val state = progress.currentState
    if (state == RouteProgressState.OFF_ROUTE || state == RouteProgressState.UNCERTAIN) {
      if (!didEmitOffRoute) {
        didEmitOffRoute = true
        onOffRoute(mapOf("distanceMeters" to 0.0))
      }
    } else {
      didEmitOffRoute = false
    }

    val legIndex = progress.currentLegProgress?.legIndex ?: 0
    if (state == RouteProgressState.COMPLETE && lastCompletedLegIndex != legIndex) {
      lastCompletedLegIndex = legIndex
      val finalLeg = legIndex >= pendingWaypoints.size - 2
      val payload = mapOf(
        "waypointIndex" to (legIndex + 1),
        "isFinalDestination" to finalLeg,
      )
      if (finalLeg) onArrival(payload) else onWaypointArrival(payload)
    }

    val progressPayload = mutableMapOf<String, Any>(
        "distanceRemainingMeters" to progress.distanceRemaining.toDouble(),
        "durationRemainingSeconds" to progress.durationRemaining.toDouble(),
        "distanceTraveledMeters" to progress.distanceTraveled.toDouble(),
        "fractionTraveled" to progress.fractionTraveled.toDouble(),
    )
    progress.currentLegProgress
      ?.currentStepProgress
      ?.distanceRemaining
      ?.toDouble()
      ?.let { progressPayload["upcomingManeuverDistanceMeters"] = it }
    onRouteProgress(progressPayload)
  }

  init {
    setBackgroundColor(Color.BLACK)
    layoutParams = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
    )
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attachNavigationViewIfNeeded()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    detachNavigationView()
  }

  // ----------------------------------------------------------------------
  // Prop setters
  // ----------------------------------------------------------------------

  fun updateWaypoints(raw: List<Map<String, Any?>>) {
    pendingWaypoints = raw
    rebuildRouteIfNeeded()
  }

  fun updateAccessToken(token: String?) {
    pendingAccessToken = token?.trim()?.takeIf { it.isNotBlank() }
    applyAccessToken()
  }

  fun updateProfile(profile: String) {
    pendingProfile = profile
    rebuildRouteIfNeeded()
  }

  fun updateVoiceLanguage(language: String) {
    pendingVoiceLanguage = language
    // navigationView?.api?.routeReplayProgressObserver(...)
  }

  fun updateSimulateRoute(simulate: Boolean) {
    pendingSimulateRoute = simulate
  }

  fun updateMute(mute: Boolean) {
    pendingMute = mute
    // navigationView?.customizeViewOptions { isVoiceInstructionsPlayerEnabled = !mute }
  }

  fun updateCameraMode(mode: String) {
    pendingCameraMode = mode
    if (mode != "idle") driverFocusModeEnabled = false
    when (mode) {
      "following" -> navigationCamera?.requestNavigationCameraToFollowing()
      "overview" -> navigationCamera?.requestNavigationCameraToOverview()
    }
  }

  fun updateRouteLineColor(hex: String?) {
    pendingRouteLineColor = hex
  }

  fun updateHideManeuverBanner(hidden: Boolean) {
    pendingHideManeuverBanner = hidden
    // navigationView?.customizeViewOptions { showManeuvers = !hidden }
  }

  fun updateHideBottomPanel(hidden: Boolean) {
    pendingHideBottomPanel = hidden
    // navigationView?.customizeViewOptions { showInfoPanelInFreeDrive = !hidden }
  }

  fun updateFollowingPaddingTopDp(value: Double?) {
    if (value != null) followingPadTopDp = value
    applyFollowingPaddingInsets()
  }

  fun updateFollowingPaddingBottomDp(value: Double?) {
    if (value != null) followingPadBottomDp = value
    applyFollowingPaddingInsets()
  }

  fun updateFollowingPaddingLeftDp(value: Double?) {
    if (value != null) followingPadStartDp = value
    applyFollowingPaddingInsets()
  }

  fun updateFollowingPaddingRightDp(value: Double?) {
    if (value != null) followingPadEndDp = value
    applyFollowingPaddingInsets()
  }

  fun updateFollowingZoom(value: Double?) {
    pendingFollowingZoom = value
    applyFollowingZoom()
  }

  fun updateRecenterRequestKey(value: Int?) {
    if (value == null || value == lastRecenterRequestKey) return
    lastRecenterRequestKey = value
    driverFocusModeEnabled = true
    pendingCameraMode = "idle"
    applyFollowingZoom()
    viewportDataSource?.evaluate()
    recenterNavigationCamera()
  }

  // ----------------------------------------------------------------------
  // SDK lifecycle
  // ----------------------------------------------------------------------

  private fun applyFollowingPaddingInsets() {
    val ds = viewportDataSource ?: return
    val d = resources.displayMetrics.density.toDouble()
    ds.followingPadding =
      EdgeInsets(
        followingPadTopDp * d,
        followingPadStartDp * d,
        followingPadBottomDp * d,
        followingPadEndDp * d,
      )
    ds.evaluate()
    if (pendingCameraMode == "following") {
      recenterNavigationCamera()
    }
  }

  private fun applyFollowingZoom() {
    val ds = viewportDataSource ?: return
    ds.followingZoomPropertyOverride(pendingFollowingZoom)
    ds.evaluate()
    if (driverFocusModeEnabled) {
      lastEnhancedLocation?.let { applyDriverFocusCamera(it) }
    } else if (pendingCameraMode == "following") {
      recenterNavigationCamera()
    }
  }

  private fun recenterNavigationCamera() {
    if (driverFocusModeEnabled) {
      lastEnhancedLocation?.let { applyDriverFocusCamera(it) }
      return
    }
    val mv = mapView
    val loc = lastEnhancedLocation
    if (mv != null && loc != null) {
      mv.mapboxMap.setCamera(
        CameraOptions.Builder()
          .center(Point.fromLngLat(loc.longitude, loc.latitude))
          .zoom(pendingFollowingZoom ?: 19.4)
          .padding(currentFollowingInsets())
          .build(),
      )
    }
    navigationCamera?.requestNavigationCameraToFollowing()
  }

  private fun applyDriverFocusCamera(location: com.mapbox.common.location.Location) {
    val mv = mapView ?: return
    mv.mapboxMap.setCamera(
      CameraOptions.Builder()
        .center(Point.fromLngLat(location.longitude, location.latitude))
        .zoom(pendingFollowingZoom ?: 19.3)
        .pitch(58.0)
        // Foco manual: o motorista deve ficar no centro físico da tela,
        // sem o recorte usado pelo SDK para desviar do card inferior.
        .padding(EdgeInsets(0.0, 0.0, 0.0, 0.0))
        .build(),
    )
  }

  private fun currentFollowingInsets(): EdgeInsets {
    val d = resources.displayMetrics.density.toDouble()
    return EdgeInsets(
      followingPadTopDp * d,
      followingPadStartDp * d,
      followingPadBottomDp * d,
      followingPadEndDp * d,
    )
  }

  private fun attachNavigationViewIfNeeded() {
    if (mapView != null) return
    applyAccessToken()

    val first = pendingWaypoints.firstValidPoint()
    val mv = MapView(
      context,
      MapInitOptions(
        context,
        cameraOptions = CameraOptions.Builder()
          .center(first ?: Point.fromLngLat(-46.6333, -23.5505))
          .zoom(15.0)
          .build(),
      )
    )
    mv.layoutParams = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
    )
    addView(mv)
    mapView = mv

    mv.location.apply {
      setLocationProvider(navigationLocationProvider)
      locationPuck = createDefault2DPuck()
      enabled = true
      pulsingEnabled = false
      showAccuracyRing = false
    }

    viewportDataSource = MapboxNavigationViewportDataSource(mv.mapboxMap)
    applyFollowingPaddingInsets()
    applyFollowingZoom()
    navigationCamera = NavigationCamera(mv.mapboxMap, mv.camera, viewportDataSource!!)
    routeLineApi = MapboxRouteLineApi(MapboxRouteLineApiOptions.Builder().build())
    routeLineView = MapboxRouteLineView(MapboxRouteLineViewOptions.Builder(context).build())

    mv.mapboxMap.loadStyle(Style.MAPBOX_STREETS) {
      requestRouteIfNeeded()
      onReady(emptyMap<String, Any>())
    }

    try {
      mapboxNavigation = MapboxNavigationProvider.create(NavigationOptions.Builder(context).build())
    } catch (e: Throwable) {
      onCancel(mapOf("reason" to "error", "message" to (e.message ?: "Mapbox Navigation indisponível")))
      return
    }

    mapboxNavigation?.registerRoutesObserver(routesObserver)
    mapboxNavigation?.registerLocationObserver(locationObserver)
    mapboxNavigation?.registerRouteProgressObserver(routeProgressObserver)
    startTripSessionIfPermitted()
    requestRouteIfNeeded()
  }

  private fun detachNavigationView() {
    val nav = mapboxNavigation
    if (nav != null) {
      nav.unregisterRoutesObserver(routesObserver)
      nav.unregisterLocationObserver(locationObserver)
      nav.unregisterRouteProgressObserver(routeProgressObserver)
      nav.stopTripSession()
      nav.setNavigationRoutes(emptyList())
    }
    hasSetInitialRoute = false
    mapboxNavigation = null
    try {
      MapboxNavigationProvider.destroy()
    } catch (_: Throwable) {
      // Provider pode ter sido destruído por outro ciclo de vida.
    }
    routeLineApi?.cancel()
    routeLineApi = null
    routeLineView = null
    viewportDataSource = null
    navigationCamera = null
    mapView?.let { removeView(it) }
    mapView = null
  }

  private fun rebuildRouteIfNeeded() {
    if (mapboxNavigation == null || mapView?.mapboxMap?.style == null) return
    requestRouteIfNeeded()
  }

  private fun applyPendingStyling() {
    updateMute(pendingMute)
    updateCameraMode(pendingCameraMode)
    updateRouteLineColor(pendingRouteLineColor)
    updateHideManeuverBanner(pendingHideManeuverBanner)
    updateHideBottomPanel(pendingHideBottomPanel)
  }

  private fun applyAccessToken() {
    pendingAccessToken?.let { token ->
      MapboxOptions.accessToken = token
      return
    }

    val resId = resources.getIdentifier("mapbox_access_token", "string", context.packageName)
    if (resId == 0) return
    val token = runCatching { resources.getString(resId).trim() }.getOrNull()
    if (!token.isNullOrBlank()) MapboxOptions.accessToken = token
  }

  @SuppressLint("MissingPermission")
  private fun startTripSessionIfPermitted() {
    val fineGranted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    val coarseGranted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_COARSE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    if (!fineGranted && !coarseGranted) {
      onCancel(mapOf("reason" to "error", "message" to "Permissão de localização ausente"))
      return
    }
    mapboxNavigation?.startTripSession()
  }

  private fun requestRouteIfNeeded() {
    val nav = mapboxNavigation ?: return
    val points = pendingWaypoints.toValidPoints()
    if (points.size < 2) return
    lastCompletedLegIndex = null

    val layers = MutableList<Int?>(points.size) { null }
    layers[0] = nav.getZLevel()

    nav.requestRoutes(
      RouteOptions.builder()
        .applyDefaultNavigationOptions()
        .profile(profileFor(pendingProfile))
        .coordinatesList(points)
        .layersList(layers)
        .language(pendingVoiceLanguage)
        .build(),
      object : NavigationRouterCallback {
        override fun onCanceled(routeOptions: RouteOptions, routerOrigin: String) {
          onCancel(mapOf("reason" to "session-end"))
        }

        override fun onFailure(reasons: List<RouterFailure>, routeOptions: RouteOptions) {
          onCancel(
            mapOf(
              "reason" to "error",
              "message" to (reasons.firstOrNull()?.message ?: "Falha ao calcular rota"),
            )
          )
        }

        override fun onRoutesReady(routes: List<NavigationRoute>, routerOrigin: String) {
          nav.setNavigationRoutes(routes)
          applyPendingStyling()
          if (pendingCameraMode == "following") navigationCamera?.requestNavigationCameraToFollowing()
        }
      },
    )
  }

  private fun List<Map<String, Any?>>.firstValidPoint(): Point? = toValidPoints().firstOrNull()

  private fun List<Map<String, Any?>>.toValidPoints(): List<Point> =
    mapNotNull { raw ->
      val lat = (raw["latitude"] as? Number)?.toDouble()
      val lng = (raw["longitude"] as? Number)?.toDouble()
      if (lat == null || lng == null) null else Point.fromLngLat(lng, lat)
    }

  private fun profileFor(raw: String): String =
    when (raw) {
      "driving" -> "driving"
      "cycling" -> "cycling"
      "walking" -> "walking"
      else -> "driving-traffic"
    }
}
