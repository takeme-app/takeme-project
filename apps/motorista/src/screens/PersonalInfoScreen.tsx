import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'PersonalInfo'>;

export function PersonalInfoScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>Dados pessoais</Text>
        <Text style={styles.placeholder}>Edição de nome, e-mail e telefone em breve.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 24,
  },
  backArrow: { fontSize: 22, color: '#000000', fontWeight: '600' },
  content: { paddingHorizontal: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 16 },
  placeholder: { fontSize: 15, color: '#767676' },
});
