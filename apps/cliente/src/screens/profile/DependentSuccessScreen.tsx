import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { useRootNavigation } from '../../navigation/RootNavigationContext';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DependentSuccess'>;

/** Detecta se esta tela está dentro do DependentShipmentStack (fluxo Envio de dependentes). */
function isInDependentShipmentStack(navigation: Props['navigation']): boolean {
  const state = navigation.getState() as { routeNames?: string[] } | undefined;
  return state?.routeNames?.includes('DependentShipmentForm') ?? false;
}

export function DependentSuccessScreen({ navigation }: Props) {
  const inDependentShipmentFlow = isInDependentShipmentStack(navigation);
  const { navigateToMainTab } = useRootNavigation();

  const goToHome = () => {
    if (!inDependentShipmentFlow) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'ProfileMain' }],
        }),
      );
    }
    /** Ref raiz do `NavigationContainer`: evita depender de quantos `getParent()` existem até o Tab Navigator. */
    queueMicrotask(() => {
      navigateToMainTab('Home');
    });
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
        <Text style={styles.hint}>
          Você também poderá acompanhar o status na aba Atividades quando quiser.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={goToHome} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Ir para Início</Text>
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
  hint: { fontSize: 14, color: '#767676', textAlign: 'center', marginBottom: 24 },
  primaryButton: {
    backgroundColor: '#0d0d0d',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
