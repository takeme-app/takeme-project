<<<<<<< HEAD
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
=======
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppAlertProvider } from './src/contexts/AppAlertContext';
import { RegistrationFormProvider } from './src/contexts/RegistrationFormContext';
import { DeferredDriverSignupProvider } from './src/contexts/DeferredDriverSignupContext';
import { supabase } from './src/lib/supabase';
import { checkMotoristaCanAccessApp } from './src/lib/motoristaAccess';

const SPLASH_MIN_MS = 500;
const SPLASH_MAX_MS = 10000;

SplashScreen.preventAutoHideAsync();
>>>>>>> 954664b (feat(motorista): cadastro completo do motorista - telas e migration)

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'Welcome' | 'Main' | 'MotoristaPendingApproval'>('Welcome');
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const runSessionInit = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return 'Welcome' as const;

    const gate = await checkMotoristaCanAccessApp(session.user.id);
    if (gate.kind === 'error' || gate.kind === 'missing_profile') {
      await supabase.auth.signOut();
      return 'Welcome' as const;
    }
    if (gate.kind === 'pending') return 'MotoristaPendingApproval' as const;
    return 'Main' as const;
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!ready) {
        SplashScreen.hideAsync().catch(() => {});
        setSplashTimedOut(true);
        setReady(true);
      }
    }, 12000);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    let mounted = true;
    const timeoutId = setTimeout(() => {
      if (!mounted) return;
      mounted = false;
      SplashScreen.hideAsync().catch(() => {});
      setSplashTimedOut(true);
      setInitialRoute('Welcome');
      setReady(true);
    }, SPLASH_MAX_MS);

    (async () => {
      try {
        const route = await runSessionInit();
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
  }, [fontsLoaded, fontError, runSessionInit]);

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
<<<<<<< HEAD
    <View style={styles.container}>
      <Text>Take Me - Motorista</Text>
      {Platform.OS !== 'web' && <StatusBar style="auto" />}
=======
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
>>>>>>> 954664b (feat(motorista): cadastro completo do motorista - telas e migration)
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
