import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  LogBox,
} from 'react-native';

// @rnmapbox/maps v10 + Fabric: aviso não fatal sobre nós de texto — suprime overlay vermelho.
LogBox.ignoreLogs(['Text strings must be rendered within a <Text> component.']);

import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppAlertProvider } from './src/contexts/AppAlertContext';
import { RegistrationFormProvider } from './src/contexts/RegistrationFormContext';
import { DeferredDriverSignupProvider } from './src/contexts/DeferredDriverSignupContext';
import { supabase } from './src/lib/supabase';
import { checkMotoristaCanAccessApp, subtypeToMainRoute } from './src/lib/motoristaAccess';

/** Igual ao cliente: nomes literais em process.env para o Metro embutir o valor no bundle. */
const mapboxToken =
  (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim() ||
  (process.env.EXPO_PUBLIC_MAPBOX_ACESS_TOKEN ?? '').trim();
if (mapboxToken) {
  Mapbox.setAccessToken(mapboxToken);
}

type InitialRouteName =
  | 'Welcome'
  | 'Main'
  | 'MainExcursoes'
  | 'MainEncomendas'
  | 'MotoristaPendingApproval';

const SPLASH_MIN_MS = 500;
/** Se as fontes não carregarem (rede/emulador), segue com fonte do sistema. */
const FONT_STALL_MS = 5000;
/** Evita ficar preso em getSession / Supabase sem resposta. */
const SESSION_INIT_MS = 8000;
/** Último recurso: tela “Não foi possível conectar”. */
const HARD_STALL_MS = 20000;

SplashScreen.preventAutoHideAsync();

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [fontBypass, setFontBypass] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontBypass(true), FONT_STALL_MS);
    return () => clearTimeout(t);
  }, []);

  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<InitialRouteName>('Welcome');
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const runSessionInit = useCallback(async (): Promise<InitialRouteName> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return 'Welcome';

    const gate = await checkMotoristaCanAccessApp(session.user.id);
    if (gate.kind === 'error' || gate.kind === 'missing_profile') {
      await supabase.auth.signOut();
      return 'Welcome';
    }
    if (gate.kind === 'pending') return 'MotoristaPendingApproval';
    return subtypeToMainRoute(gate.subtype);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!ready) {
        SplashScreen.hideAsync().catch(() => {});
        setSplashTimedOut(true);
        setReady(true);
      }
    }, HARD_STALL_MS);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (!fontsLoaded && !fontError && !fontBypass) return;

    let mounted = true;
    const timeoutId = setTimeout(() => {
      if (!mounted) return;
      mounted = false;
      SplashScreen.hideAsync().catch(() => {});
      setSplashTimedOut(true);
      setInitialRoute('Welcome');
      setReady(true);
    }, SESSION_INIT_MS);

    (async () => {
      try {
        const route = await withTimeout(runSessionInit(), SESSION_INIT_MS, 'Welcome' as InitialRouteName);
        const elapsed = Date.now() - startTimeRef.current;
        const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
        await new Promise((r) => setTimeout(r, wait));

        if (!mounted) return;
        setInitialRoute(route);
        await SplashScreen.hideAsync();
        setReady(true);
      } catch (_) {
        if (!mounted) return;
        setInitialRoute('Welcome');
        await SplashScreen.hideAsync().catch(() => {});
        setReady(true);
      } finally {
        mounted = false;
        clearTimeout(timeoutId);
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [fontsLoaded, fontError, fontBypass, runSessionInit]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const route = await runSessionInit();
      setInitialRoute(route);
      setSplashTimedOut(false);
    } catch (_) {
      setInitialRoute('Welcome');
      setSplashTimedOut(false);
    } finally {
      setRetrying(false);
    }
  }, [runSessionInit]);

  if (!ready) {
    return null;
  }

  if (splashTimedOut) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.avisoWrap} edges={['top', 'bottom']}>
          <Text style={styles.avisoTitle}>Não foi possível conectar</Text>
          <Text style={styles.avisoMessage}>
            Verifique sua internet e tente novamente. O app precisa de conexão para funcionar.
          </Text>
          <TouchableOpacity
            style={[styles.avisoButton, retrying && styles.avisoButtonDisabled]}
            onPress={handleRetry}
            disabled={retrying}
            activeOpacity={0.8}
          >
            {retrying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.avisoButtonText}>Tentar novamente</Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppAlertProvider>
          <DeferredDriverSignupProvider>
            <RegistrationFormProvider>
              <RootNavigator initialRouteName={initialRoute} />
            </RegistrationFormProvider>
          </DeferredDriverSignupProvider>
        </AppAlertProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  avisoWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  avisoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0d0d0d',
    marginBottom: 12,
    textAlign: 'center',
  },
  avisoMessage: {
    fontSize: 16,
    color: '#767676',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  avisoButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  avisoButtonDisabled: {
    opacity: 0.7,
  },
  avisoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
