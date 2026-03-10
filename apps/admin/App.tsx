import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';

type Screen = 'login' | 'forgot' | 'home';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('login');
  const [session, setSession] = useState<unknown>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setScreen(s ? 'home' : 'login');
        setInitialized(true);
      })
      .catch(() => {
        setInitialized(true);
        setScreen('login');
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setScreen(s ? 'home' : 'login');
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!initialized) {
    return (
      <View style={styles.loadingContainer}>
        {Platform.OS !== 'web' && <StatusBar style="light" />}
        <Text style={styles.loadingText}>Carregando…</Text>
      </View>
    );
  }

  if (screen === 'forgot') {
    return (
      <ForgotPasswordScreen
        onBack={() => setScreen('login')}
        onEmailSent={() => setScreen('login')}
      />
    );
  }

  if (screen === 'home') {
    return (
      <View style={styles.container}>
        {Platform.OS !== 'web' && <StatusBar style="dark" />}
        <Text style={styles.welcomeText}>Bem-vindo ao Admin</Text>
      </View>
    );
  }

  return (
    <LoginScreen
      onForgotPassword={() => setScreen('forgot')}
      onLoginSuccess={() => setScreen('home')}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
});
