import { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Text } from '../../components/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ShipmentStackParamList } from '../../navigation/types';
import { useAppAlert } from '../../contexts/AppAlertContext';
import * as ImagePicker from 'expo-image-picker';
import { quoteShipmentForClient, type ShipmentQuoteOk } from '../../lib/shipmentQuote';
import { resolveShipmentBaseId } from '../../lib/resolveShipmentBase';

type Props = NativeStackScreenProps<ShipmentStackParamList, 'Recipient'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function RecipientScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const { origin, destination, whenOption, whenLabel, packageSize, packageSizeLabel } = route.params;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<ShipmentQuoteOk | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);
    setQuote(null);
    (async () => {
      const res = await quoteShipmentForClient({
        originAddress: origin.address,
        destinationAddress: destination.address,
        originLat: origin.latitude,
        originLng: origin.longitude,
        destinationLat: destination.latitude,
        destinationLng: destination.longitude,
        packageSize,
      });
      if (cancelled) return;
      if (!res.ok) {
        setQuoteError(res.error);
        setQuote(null);
      } else {
        setQuote(res.quote);
      }
      setQuoteLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    origin.address,
    origin.latitude,
    origin.longitude,
    destination.address,
    destination.latitude,
    destination.longitude,
    packageSize,
  ]);

  const handlePhoneChange = (text: string) => setPhone(formatPhone(text));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permissão', 'Precisamos de acesso à galeria para adicionar uma foto da encomenda.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleFazerPedido = () => {
    const nameTrim = name.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (!nameTrim) {
      showAlert('Atenção', 'Preencha o nome do destinatário.');
      return;
    }
    if (phoneDigits.length < 10) {
      showAlert('Atenção', 'Preencha o telefone do destinatário com DDD e número.');
      return;
    }
    if (!quote) {
      showAlert('Valor', quoteError ?? 'Não foi possível calcular o valor do envio.');
      return;
    }
    const recipientPayload = {
      name: nameTrim,
      phone: phoneDigits,
      instructions: instructions.trim() || undefined,
      photoUri: photoUri ?? undefined,
    };
    const quoteParams = {
      origin,
      destination,
      whenOption,
      whenLabel,
      packageSize,
      packageSizeLabel,
      recipient: recipientPayload,
      amountCents: quote.amountCents,
      pricingSubtotalCents: quote.pricingSubtotalCents,
      platformFeeCents: quote.platformFeeCents,
      priceRouteBaseCents: quote.priceRouteBaseCents,
      pricingRouteId: quote.pricingRouteId,
      adminPctApplied: quote.adminPctApplied,
    };
    setLoading(true);
    void (async () => {
      try {
        const resolvedBaseId = await resolveShipmentBaseId({
          origin: { latitude: origin.latitude, longitude: origin.longitude },
          originAddress: origin.address,
        });
        navigation.navigate('SelectShipmentDriver', {
          ...quoteParams,
          resolvedBaseId: resolvedBaseId ?? null,
        });
      } catch {
        showAlert('Erro', 'Não foi possível verificar a base da região. Tente de novo.');
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.title}>Quem vai receber a encomenda?</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Nome do destinatário</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          placeholderTextColor={COLORS.neutral700}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Telefone do destinatário</Text>
        <TextInput
          style={styles.input}
          placeholder="(00) 00000-0000"
          placeholderTextColor={COLORS.neutral700}
          value={phone}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          maxLength={16}
        />

        <Text style={styles.label}>Instruções para o entregador (opcional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Ex: deixar na portaria..."
          placeholderTextColor={COLORS.neutral700}
          value={instructions}
          onChangeText={setInstructions}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Foto da encomenda (opcional)</Text>
        {photoUri ? (
          <View style={styles.photoPreviewOuter}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.9} style={styles.photoPreviewTouchable}>
              <Image source={{ uri: photoUri }} style={styles.photoThumb} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoRemoveBtn}
              onPress={() => setPhotoUri(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Remover foto"
            >
              <MaterialIcons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.photoHint}>Toque na imagem para trocar · use ✕ para remover</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.8}>
            <MaterialIcons name="camera-alt" size={32} color={COLORS.neutral700} />
            <Text style={styles.photoPlaceholderText}>Toque para adicionar</Text>
          </TouchableOpacity>
        )}

        {quoteLoading ? (
          <View style={styles.quoteRow}>
            <ActivityIndicator size="small" color={COLORS.black} />
            <Text style={styles.quoteHint}>Calculando valor do envio…</Text>
          </View>
        ) : quoteError ? (
          <Text style={styles.quoteError}>{quoteError}</Text>
        ) : quote ? (
          <Text style={styles.quoteHint}>
            Valor estimado: R$ {(quote.amountCents / 100).toFixed(2).replace('.', ',')} (subtotal + taxa da plataforma)
          </Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (loading || quoteLoading || quoteError || !quote) && styles.primaryButtonDisabled,
          ]}
          onPress={handleFazerPedido}
          disabled={loading || quoteLoading || !!quoteError || !quote}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Fazer pedido</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
  backButton: { marginRight: 12 },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.black, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  photoPreviewOuter: { marginBottom: 24, position: 'relative' },
  photoPreviewTouchable: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.neutral400,
  },
  photoThumb: { width: '100%', height: 200, backgroundColor: COLORS.neutral300 },
  photoRemoveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { fontSize: 12, color: COLORS.neutral700, marginTop: 10 },
  photoPlaceholderText: { fontSize: 14, color: COLORS.neutral700, marginTop: 8 },
  quoteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  quoteHint: { fontSize: 13, color: COLORS.neutral700, marginBottom: 16 },
  quoteError: { fontSize: 13, color: '#b53838', marginBottom: 16 },
  primaryButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
