import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Dependents'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

type Dependent = {
  id: string;
  full_name: string;
  age: string | null;
  status: 'pending' | 'validated';
};

export function DependentsScreen({ navigation }: Props) {
  const [list, setList] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('dependents')
      .select('id, full_name, age, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setList(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbarButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle} numberOfLines={1}>Dependentes</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Dependentes cadastrados</Text>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.black} style={styles.loader} />
        ) : (
          <>
            {list.map((d) => (
              <View key={d.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.statusTag}>
                    {d.status === 'validated' ? (
                      <MaterialIcons name="check-circle" size={16} color="#15803d" />
                    ) : (
                      <MaterialIcons name="schedule" size={16} color={COLORS.neutral700} />
                    )}
                    <Text style={styles.statusText}>
                      {d.status === 'validated' ? 'Validado' : 'Aguardando Validação'}
                    </Text>
                  </View>
                  <Text style={styles.depName}>{d.full_name}</Text>
                  {d.age ? <Text style={styles.depAge}>{d.age} anos</Text> : null}
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('DependentDetail', { dependentId: d.id })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailLink}>Ver detalhes</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddDependent')}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>Adicionar dependente</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navbarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navbarTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.black, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black, marginBottom: 16 },
  loader: { marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  rowLeft: { flex: 1 },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.neutral300,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
  },
  statusText: { fontSize: 12, color: COLORS.black, marginLeft: 4 },
  depName: { fontSize: 15, fontWeight: '700', color: COLORS.black },
  depAge: { fontSize: 14, color: COLORS.neutral700, marginTop: 2 },
  detailLink: { fontSize: 14, color: COLORS.black, textDecorationLine: 'underline', fontWeight: '500' },
  addButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  addButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
