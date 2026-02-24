import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackTypes';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Wallet'>;

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral700: '#767676',
};

const CARD_BRAND_LOGO_PNG: Record<string, string> = {
  visa: 'https://img.icons8.com/color/96/visa.png',
  mastercard: 'https://img.icons8.com/color/96/mastercard.png',
  amex: 'https://img.icons8.com/color/96/amex.png',
  elo: 'https://img.icons8.com/color/96/elo.png',
  diners: 'https://img.icons8.com/color/96/diners-club.png',
  discover: 'https://img.icons8.com/color/96/discover.png',
  jcb: 'https://img.icons8.com/color/96/jcb.png',
};

function CardBrandIcon({ brand, size = 40 }: { brand: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const normalized = brand?.toLowerCase().replace(/\s/g, '') ?? '';
  const uri = normalized ? CARD_BRAND_LOGO_PNG[normalized] : null;

  if (!uri || failed) {
    return (
      <View style={[styles.brandIconWrap, { width: size, height: size }]}>
        <MaterialIcons name="credit-card" size={size * 0.6} color={COLORS.black} />
      </View>
    );
  }

  return (
    <View style={[styles.brandIconWrap, { width: size, height: size }]}>
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 8 }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

type PaymentMethod = {
  id: string;
  type: 'credit' | 'debit';
  last_four: string | null;
  holder_name: string | null;
  brand: string | null;
};

export function WalletScreen({ navigation }: Props) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('payment_methods')
      .select('id, type, last_four, holder_name, brand')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setMethods(data ?? []);
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
        <TouchableOpacity
          style={styles.navbarButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="close" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.navbarTitle} numberOfLines={1}>Carteira</Text>
      </View>
      <View style={styles.mainTitleWrap}>
        <Text style={styles.mainTitle}>Carteira</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.black} style={styles.loader} />
        ) : (
          <>
            {methods.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.cardRow}
                onPress={() => navigation.navigate('DeleteCard', { paymentMethodId: m.id })}
                activeOpacity={0.7}
              >
                <CardBrandIcon brand={m.brand} size={40} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardLabel}>
                    {m.type === 'credit' ? '(Crédito)' : '(Débito)'}
                    {m.last_four ? ` •••• ${m.last_four}` : ''}
                  </Text>
                  {m.holder_name ? (
                    <Text style={styles.cardHolder} numberOfLines={1}>{m.holder_name}</Text>
                  ) : null}
                </View>
                <MaterialIcons name="chevron-right" size={24} color={COLORS.neutral700} />
              </TouchableOpacity>
            ))}
            <View style={styles.addLinkWrap}>
              <TouchableOpacity
                style={styles.addLink}
                onPress={() => navigation.navigate('AddPaymentMethod')}
                activeOpacity={0.7}
              >
                <Text style={styles.addLinkText}>Adicionar método de pagamento</Text>
              </TouchableOpacity>
            </View>
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
  navbarTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },
  loader: { marginTop: 24 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  cardInfo: { flex: 1, marginLeft: 0 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: COLORS.black },
  cardHolder: { fontSize: 13, color: COLORS.neutral700, marginTop: 2 },
  addLinkWrap: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLink: { paddingVertical: 8, paddingHorizontal: 16 },
  addLinkText: { fontSize: 15, fontWeight: '500', color: COLORS.black, textDecorationLine: 'underline' },
  mainTitleWrap: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  mainTitle: { fontSize: 22, fontWeight: '700', color: COLORS.black },
  brandIconWrap: {
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
});
