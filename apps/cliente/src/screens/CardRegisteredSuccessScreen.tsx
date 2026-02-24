import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CardRegisteredSuccess'>;

export function CardRegisteredSuccessScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <View style={styles.cardIcon}>
            <View style={styles.cardChip} />
          </View>
        </View>
        <Text style={styles.message}>Cartão cadastrado com sucesso!</Text>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Main')}
        >
          <Text style={styles.buttonText}>Começar a usar</Text>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#000000',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  cardIcon: {
    width: 40,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  cardChip: {
    position: 'absolute',
    left: 6,
    top: 8,
    width: 10,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  message: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  footer: {
    paddingBottom: 48,
  },
  button: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
