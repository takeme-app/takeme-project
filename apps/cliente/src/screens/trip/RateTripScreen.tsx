import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TripStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TripStackParamList, 'RateTrip'>;

export function RateTripScreen({ navigation }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const goToMain = () => {
    navigation.getParent()?.navigate('Main');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Como foi a sua viagem?</Text>
      <Text style={styles.hint}>(1 = muito insatisfeito, 5 = muito satisfeito)</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setRating(n)}
            style={styles.starButton}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={n <= rating ? 'star' : 'star-border'}
              size={40}
              color={n <= rating ? '#EAB308' : '#e2e2e2'}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.commentLabel}>Comentário <Text style={styles.optional}>(Opcional)</Text></Text>
      <TextInput
        style={styles.commentInput}
        placeholder="Descreva algum comentário sobre a entrega..."
        placeholderTextColor="#767676"
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={3}
      />
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={goToMain}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Enviar avaliação</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={goToMain}>
        <Text style={styles.secondaryButtonText}>Agora não</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#0d0d0d', marginTop: 24, marginBottom: 8, textAlign: 'center' },
  hint: { fontSize: 14, color: '#767676', marginBottom: 16, textAlign: 'center' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  starButton: { padding: 4 },
  commentLabel: { fontSize: 14, fontWeight: '600', color: '#0d0d0d', marginBottom: 8 },
  optional: { fontWeight: '400', color: '#767676' },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#0d0d0d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  secondaryButton: { paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { fontSize: 16, fontWeight: '500', color: '#0d0d0d' },
});
