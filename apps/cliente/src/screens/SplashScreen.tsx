import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { assertClientePassengerOnlyAccount } from '../lib/clientePassengerOnlyGate';
type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const SPLASH_MIN_MS = 500;

/** Usada quando o app redireciona para Splash (ex.: logout). Na abertura do app a splash nativa é usada e vamos direto para Welcome/Main. */
export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    let mounted = true;
    const start = Date.now();

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const elapsed = Date.now() - start;
      const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));

      if (!mounted) return;
      if (session?.user) {
        const gate = await assertClientePassengerOnlyAccount(session.user.id);
        if (!gate.ok) {
          await supabase.auth.signOut();
          navigation.replace('Welcome');
        } else {
          navigation.replace('Main');
        }
      } else {
        navigation.replace('Welcome');
      }
    })();

    return () => { mounted = false; };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 560,
    height: 224,
  },
});
