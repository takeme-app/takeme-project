import { useEffect } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { createSessionFromUrl } from './src/lib/oauth';

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

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
  useAuthDeepLink();
  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </StripeProvider>
  );
}
