import type { ComponentType } from 'react';
import { NativeModules, Platform, Text, TurboModuleRegistry, View } from 'react-native';
import type { CardFieldProps, StripeProviderProps } from '@stripe/stripe-react-native';

/**
 * true apenas quando o binário nativo inclui StripeSdk (ex.: dev build / EAS).
 * No Expo Go ou builds sem o módulo, evita importar @stripe/stripe-react-native,
 * pois o pacote chama TurboModuleRegistry.getEnforcing no load e derruba o app.
 */
export function isStripeNativeAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const mod = TurboModuleRegistry.get('StripeSdk');
    if (mod != null) return true;
  } catch {
    /* ignore */
  }
  return (NativeModules as { StripeSdk?: unknown }).StripeSdk != null;
}

const STRIPE_NATIVE = isStripeNativeAvailable();

const StripeProviderPassthrough = ({ children }: StripeProviderProps) => <>{children}</>;

const CardFieldUnavailable = (_props: CardFieldProps) => (
  <View style={{ padding: 16, justifyContent: 'center' }}>
    <Text style={{ color: '#666', textAlign: 'center', fontSize: 14 }}>
      Cartão indisponível neste ambiente. Use um development build com Stripe (ex.:{' '}
      <Text style={{ fontWeight: '600' }}>npx expo run:android</Text>), não o Expo Go.
    </Text>
  </View>
);

function useStripeUnavailable() {
  return {
    createPaymentMethod: async () => ({
      error: {
        message:
          'Stripe não está neste binário. Gere um development build com o plugin @stripe/stripe-react-native.',
      },
    }),
  };
}

let StripeProviderExport: ComponentType<StripeProviderProps> = StripeProviderPassthrough;
let CardFieldExport: ComponentType<CardFieldProps> = CardFieldUnavailable;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useStripeExport: () => any = useStripeUnavailable;

if (STRIPE_NATIVE) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const stripe = require('@stripe/stripe-react-native') as typeof import('@stripe/stripe-react-native');
  StripeProviderExport = stripe.StripeProvider;
  CardFieldExport = stripe.CardField;
  useStripeExport = stripe.useStripe;
}

export const StripeProvider = StripeProviderExport;
export const CardField = CardFieldExport;
export const useStripe = useStripeExport;
