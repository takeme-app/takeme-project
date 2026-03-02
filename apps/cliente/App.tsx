import { useEffect, useCallback } from 'react';
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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useAuthDeepLink();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StripeProvider publishableKey={stripePublishableKey}>
        <SafeAreaProvider>
          <AppAlertProvider>
            <RootNavigator />
          </AppAlertProvider>
        </SafeAreaProvider>
      </StripeProvider>
    </View>
  );
}
