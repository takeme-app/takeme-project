import { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '../components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [nameFallback, setNameFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    const nameFromAuth =
      (user.user_metadata?.full_name as string)?.trim() ||
      (user.user_metadata?.name as string)?.trim() ||
      (user.email ? user.email.split('@')[0] : null) ||
      null;
    setNameFallback(nameFromAuth);

    const { data: row } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    setProfile(row ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    const root = navigation.getParent()?.getParent();
    if (root) {
      root.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Splash' }] })
      );
    }
  };

  const displayName = profile?.full_name?.trim() || nameFallback || 'Usuário';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0d0d0d" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <MaterialIcons name="person" size={40} color="#767676" />
          </View>
          <Text style={styles.name}>{displayName}</Text>
        </View>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('PersonalInfo')} activeOpacity={0.7}>
          <MaterialIcons name="person-outline" size={24} color="#0d0d0d" />
          <Text style={styles.menuLabel}>Dados pessoais</Text>
          <MaterialIcons name="chevron-right" size={24} color="#767676" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuRow, styles.logoutRow]} onPress={handleLogout} activeOpacity={0.7}>
          <MaterialIcons name="logout" size={24} color="#b53838" />
          <Text style={[styles.menuLabel, styles.logoutLabel]}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  header: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f1f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: { fontSize: 20, fontWeight: '700', color: '#0d0d0d' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    gap: 12,
  },
  menuLabel: { flex: 1, fontSize: 16, color: '#0d0d0d', fontWeight: '500' },
  logoutRow: { borderBottomWidth: 0, marginTop: 8 },
  logoutLabel: { color: '#b53838' },
});
