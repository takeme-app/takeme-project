import * as React from 'react';
import { Platform, View, StyleSheet, Text } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';

import type { ExpoMapboxNavigationProps } from './ExpoMapboxNavigation.types';
import ExpoMapboxNavigationModule from './ExpoMapboxNavigationModule';

let NativeView: React.ComponentType<ExpoMapboxNavigationProps> | null = null;
try {
  NativeView = requireNativeViewManager<ExpoMapboxNavigationProps>('ExpoMapboxNavigation');
} catch {
  NativeView = null;
}

/**
 * Renderiza o `MapboxNavigationView` nativo (iOS Swift / Android Kotlin) preenchendo o
 * espaço do pai. Filhos React (`children`) são exibidos por cima do mapa nativo via
 * `pointerEvents='box-none'`, permitindo overlays customizados (sheets, badges, botões).
 *
 * Quando o módulo nativo não está disponível (web, Expo Go, sem rebuild), renderiza um
 * placeholder neutro para evitar crash.
 */
export const ExpoMapboxNavigationView = React.forwardRef<View, ExpoMapboxNavigationProps & { children?: React.ReactNode }>(
  function ExpoMapboxNavigationView(
    {
      children,
      style,
      profile = 'driving-traffic',
      voiceLanguage = 'pt-BR',
      cameraMode = 'following',
      simulateRoute = false,
      mute = false,
      hideManeuverBanner = false,
      hideBottomPanel = false,
      ...props
    },
    ref,
  ) {
    if (!NativeView || !ExpoMapboxNavigationModule.isAvailable()) {
      return (
        <View style={[styles.fallback, style]}>
          <Text style={styles.fallbackTitle}>Navegação nativa indisponível</Text>
          <Text style={styles.fallbackSub}>
            Faça `expo run:{Platform.OS === 'ios' ? 'ios' : 'android'}` para baixar o
            Mapbox Navigation SDK e habilitar a navegação nativa.
          </Text>
        </View>
      );
    }

    return (
      <View ref={ref} style={[styles.root, style]}>
        <NativeView
          style={StyleSheet.absoluteFill}
          profile={profile}
          voiceLanguage={voiceLanguage}
          cameraMode={cameraMode}
          simulateRoute={simulateRoute}
          mute={mute}
          hideManeuverBanner={hideManeuverBanner}
          hideBottomPanel={hideBottomPanel}
          {...props}
        />
        {children ? (
          <View
            pointerEvents="box-none"
            style={StyleSheet.absoluteFill}
          >
            {children}
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 24,
  },
  fallbackTitle: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  fallbackSub: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
