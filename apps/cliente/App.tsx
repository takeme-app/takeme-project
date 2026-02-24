import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { RootNavigator } from './src/navigation/RootNavigator';

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function App() {
  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </StripeProvider>
  );
}
