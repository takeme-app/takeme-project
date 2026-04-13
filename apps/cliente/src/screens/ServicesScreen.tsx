import { View, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { Text } from '../components/Text';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';
import { useRootNavigation } from '../navigation/RootNavigationContext';

const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const SERVICES = [
  { id: 'viagens', label: 'Viagens', image: require('../../assets/icon-viagens.png') },
  { id: 'envios', label: 'Envios', image: require('../../assets/icon-envios.png') },
  { id: 'dependentes', label: 'Envios de\ndependentes', image: require('../../assets/icon-excursoes.png') },
  { id: 'excursões', label: 'Excursões', image: require('../../assets/icon-dependentes.png') },
];

type ServicesScreenProps = BottomTabScreenProps<MainTabParamList, 'Services'>;

export function ServicesScreen({ navigation }: ServicesScreenProps) {
  const { navigateToTripStack, navigateToShipmentStack, navigateToDependentShipmentStack, navigateToExcursionStack } = useRootNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle} numberOfLines={1} ellipsizeMode="tail">
          Como podemos te ajudar hoje?
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serviços</Text>
          <View style={styles.servicesGrid}>
            <View style={styles.servicesRow}>
              {SERVICES.slice(0, 2).map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (service.id === 'viagens') navigateToTripStack('PlanTrip');
                    if (service.id === 'envios') navigateToShipmentStack('SelectShipmentAddress');
                  }}
                >
                  <View style={styles.serviceIconWrap}>
                    <Image source={service.image} style={styles.serviceImage} resizeMode="contain" />
                  </View>
                  <Text style={styles.serviceLabel}>{service.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.servicesRow}>
              {SERVICES.slice(2, 4).map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (service.id === 'dependentes') navigateToDependentShipmentStack('DependentShipmentForm');
                    if (service.id === 'excursões') navigateToExcursionStack('ExcursionRequestForm');
                  }}
                >
                  <View style={styles.serviceIconWrap}>
                    <Image source={service.image} style={styles.serviceImage} resizeMode="contain" />
                  </View>
                  <Text style={styles.serviceLabel}>{service.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    color: '#0D0D0D',
    textAlign: 'center',
    marginBottom: 32,
  },
  section: {
    gap: 24,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 48,
    color: '#0D0D0D',
  },
  servicesGrid: {
    gap: 12,
  },
  servicesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: COLORS.neutral300,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  serviceIconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceImage: {
    width: 52,
    height: 52,
  },
  serviceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    textAlign: 'center',
  },
});
