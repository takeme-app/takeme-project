import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { SCREEN_TOP_EXTRA_PADDING } from '../../theme/screenLayout';
import { supabase } from '../../lib/supabase';

export function PerfilExcursoesScreen() {
  const navigation = useNavigation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Welcome' }] }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}><Text style={styles.title}>Perfil</Text></View>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}><MaterialIcons name="person" size={40} color="#FFFFFF" /></View>
        <Text style={styles.userName}>Preparador de Excursões</Text>
        <Text style={styles.userStatus}>Conta ativa</Text>
      </View>
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
          <MaterialIcons name="person-outline" size={22} color="#111827" />
          <Text style={styles.menuLabel}>Dados pessoais</Text>
          <MaterialIcons name="chevron-right" size={22} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <View style={styles.sep} />
        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
          <MaterialIcons name="account-balance" size={22} color="#111827" />
          <Text style={styles.menuLabel}>Dados bancários</Text>
          <MaterialIcons name="chevron-right" size={22} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <View style={styles.sep} />
        <TouchableOpacity style={styles.menuRow} onPress={handleLogout} activeOpacity={0.7}>
          <MaterialIcons name="logout" size={22} color="#111827" />
          <Text style={styles.menuLabel}>Sair</Text>
        </TouchableOpacity>
        <View style={styles.sep} />
        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
          <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
          <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Excluir conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 12 + SCREEN_TOP_EXTRA_PADDING, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  avatarSection: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  userName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  userStatus: { fontSize: 13, color: '#22C55E', fontWeight: '600' },
  menu: { paddingHorizontal: 20 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  menuLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  sep: { height: 1, backgroundColor: '#F3F4F6' },
});
