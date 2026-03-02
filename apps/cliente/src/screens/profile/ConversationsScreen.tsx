import { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { MaterialIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Conversations'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

export function ConversationsScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'recent' | 'finished'>('recent');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navbarButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle} numberOfLines={1}>Conversas</Text>
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recent' && styles.tabActive]}
          onPress={() => setActiveTab('recent')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>Recentes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'finished' && styles.tabActive]}
          onPress={() => setActiveTab('finished')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'finished' && styles.tabTextActive]}>Finalizadas</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.empty}>
          <MaterialIcons name="chat-bubble-outline" size={48} color={COLORS.neutral700} />
          <Text style={styles.emptyText}>
            {activeTab === 'recent' ? 'Nenhuma conversa recente' : 'Nenhuma conversa finalizada'}
          </Text>
        </View>
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
  tabs: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16 },
  tab: { marginRight: 24, paddingBottom: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.black },
  tabText: { fontSize: 15, color: COLORS.neutral700 },
  tabTextActive: { fontWeight: '700', color: COLORS.black },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  emptyText: { fontSize: 15, color: COLORS.neutral700, marginTop: 12 },
});
