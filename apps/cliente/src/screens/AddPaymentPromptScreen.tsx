import { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../components/Text';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPaymentPrompt'>;

export function AddPaymentPromptScreen({ navigation }: Props) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;
      await supabase.functions.invoke('ensure-stripe-customer', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>
          Quer adicionar um método de pagamento agora?
        </Text>
        <Text style={styles.subtitle}>
          Assim você estará pronto para sua primeira viagem em segundos.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AddPaymentMethod')}
        >
          <Text style={styles.continueButtonText}>Continuar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipLink}
          onPress={() => navigation.navigate('Main')}
        >
          <Text style={styles.skipLinkText}>Pular por enquanto</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    marginBottom: 24,
  },
  backArrow: {
    fontSize: 22,
    color: '#000000',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingBottom: 48,
  },
  continueButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipLinkText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
});
