import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import Mapbox from '@rnmapbox/maps';
import { RootNavigator } from './src/navigation/RootNavigator';
import { createSessionFromUrl } from './src/lib/oauth';
import { AppAlertProvider } from './src/contexts/AppAlertContext';
import { CurrentLocationProvider } from './src/contexts/CurrentLocationContext';
import { supabase } from './src/lib/supabase';

const SPLASH_MIN_MS = 500;

SplashScreen.preventAutoHideAsync();

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
if (mapboxToken) Mapbox.setAccessToken(mapboxToken);

function useAuthDeepLink() {
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url || !url.includes('access_token')) return;
      try {
        await createSessionFromUrl(url);
      } catch (_) {
        // ignore
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'Welcome' | 'Main'>('Welcome');
  const startTimeRef = useRef<number>(Date.now());

  useAuthDeepLink();

  // Splash nativa fica visível até: fontes + sessão + tempo mínimo; aí esconde e abre Welcome ou Main
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const elapsed = Date.now() - startTimeRef.current;
      const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));

      if (!mounted) return;
      setInitialRoute(session?.user ? 'Main' : 'Welcome');
      await SplashScreen.hideAsync();
      setReady(true);
    })();

    return () => { mounted = false; };
  }, [fontsLoaded, fontError]);

  if (!ready) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <StripeProvider publishableKey={stripePublishableKey}>
        <SafeAreaProvider>
          <CurrentLocationProvider>
            <AppAlertProvider>
              <RootNavigator initialRouteName={initialRoute} />
            </AppAlertProvider>
          </CurrentLocationProvider>
        </SafeAreaProvider>
      </StripeProvider>
    </View>
  );
}
