import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

// Tokens do Figma: neutral-100 white, black-500 #0d0d0d, neutral-300 #f1f1f1, neutral-400 #e2e2e2, neutral-700 #767676
const COLORS = {
  background: '#FFFFFF',
  black: '#0d0d0d',
  neutral300: '#f1f1f1',
  neutral400: '#e2e2e2',
  neutral700: '#767676',
};

const RECENT_DESTINATIONS = [
  { address: 'Alameda Ribeirão Preto, 225', city: 'São Paulo - SP' },
  { address: 'Rua Rego Freitas, 370', city: 'São Paulo - SP' },
];

const SERVICES = [
  { id: 'viagens', label: 'Viagens', icon: 'directions-car' as const },
  { id: 'envios', label: 'Envios', icon: 'local-shipping' as const },
  { id: 'dependentes', label: 'Envios de\ndependentes', icon: 'accessible' as const },
  { id: 'excursões', label: 'Excursões', icon: 'groups' as const },
];

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Barra de busca */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <MaterialIcons name="search" size={24} color={COLORS.black} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Para onde?"
              placeholderTextColor={COLORS.neutral700}
              editable={false}
            />
            <TouchableOpacity style={styles.agendarButton} activeOpacity={0.8}>
              <MaterialIcons name="event" size={24} color={COLORS.black} />
              <Text style={styles.agendarText}>Agendar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Destinos recentes */}
        <View style={styles.recentCard}>
          {RECENT_DESTINATIONS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.recentRow}
              activeOpacity={0.7}
            >
              <View style={styles.recentIconWrap}>
                <MaterialIcons name="access-time" size={24} color={COLORS.black} />
              </View>
              <View style={styles.recentTextWrap}>
                <Text style={styles.recentAddress} numberOfLines={1}>{item.address}</Text>
                <Text style={styles.recentCity}>{item.city}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Serviços disponíveis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serviços disponíveis</Text>
          <View style={styles.servicesGrid}>
            <View style={styles.servicesRow}>
              {SERVICES.slice(0, 2).map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceCard}
                  activeOpacity={0.8}
                >
                  <View style={styles.serviceIconWrap}>
                    <MaterialIcons name={service.icon} size={52} color={COLORS.black} />
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
                >
                  <View style={styles.serviceIconWrap}>
                    <MaterialIcons name={service.icon} size={52} color={COLORS.black} />
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
    paddingTop: 16,
    paddingBottom: 24,
    gap: 32,
  },
  searchRow: {
    marginBottom: 0,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.black,
    backgroundColor: COLORS.background,
    paddingLeft: 16,
    paddingRight: 8,
  },
  searchIcon: {
    marginRight: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    paddingVertical: 12,
  },
  agendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 90,
    backgroundColor: COLORS.neutral300,
    gap: 6,
  },
  agendarText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.black,
    marginLeft: 4,
  },
  recentCard: {
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    padding: 16,
    gap: 24,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTextWrap: {
    flex: 1,
    gap: 2,
  },
  recentAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  recentCity: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.neutral700,
  },
  section: {
    gap: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
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
  serviceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    textAlign: 'center',
  },
});
