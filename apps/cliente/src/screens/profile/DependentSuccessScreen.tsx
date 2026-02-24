import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DependentSuccess'>;

export function DependentSuccessScreen({ navigation }: Props) {
  const goToActivities = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'ProfileMain' }],
      })
    );
    const tab = navigation.getParent();
    if (tab && typeof (tab as any).navigate === 'function') {
      (tab as any).navigate('Activities');
    }
  };

  const goToProfileStart = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'ProfileMain' }],
      })
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>✓</Text>
        </View>
        <Text style={styles.title}>Cadastro enviado com sucesso!</Text>
        <Text style={styles.subtitle}>
          Nossa equipe vai verificar os documentos e você receberá uma notificação assim que o processo for concluído.
        </Text>
        <Text style={styles.hint}>Enquanto isso, você pode acompanhar o status em Atividades.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={goToActivities} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Ver em Atividades</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToProfileStart} activeOpacity={0.8}>
          <Text style={styles.link}>Voltar para Início</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 48, alignItems: 'center' },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: { fontSize: 40, color: '#FFFFFF', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#0d0d0d', textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 14, color: '#767676', textAlign: 'center', marginBottom: 8 },
  hint: { fontSize: 14, color: '#0d0d0d', textAlign: 'center', marginBottom: 24 },
  primaryButton: {
    backgroundColor: '#0d0d0d',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  link: { fontSize: 15, color: '#0d0d0d', fontWeight: '500' },
});
