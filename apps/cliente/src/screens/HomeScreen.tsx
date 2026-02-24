import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';

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
  { id: 'viagens', label: 'Viagens', image: require('../../assets/icon-viagens.png') },
  { id: 'envios', label: 'Envios', image: require('../../assets/icon-envios.png') },
  { id: 'dependentes', label: 'Envios de\ndependentes', image: require('../../assets/icon-excursoes.png') },
  { id: 'excursões', label: 'Excursões', image: require('../../assets/icon-dependentes.png') },
];

type HomeScreenProps = BottomTabScreenProps<MainTabParamList, 'Home'>;

function openTripFlow(navigation: HomeScreenProps['navigation'], screen?: 'SearchTrip' | 'PlanRide') {
  const root = navigation.getParent() as { navigate: (name: string, params?: { screen: string }) => void } | undefined;
  if (root) {
    if (screen) root.navigate('TripStack', { screen });
    else root.navigate('TripStack');
  }
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [whenSheetVisible, setWhenSheetVisible] = useState(false);
  const [whenOption, setWhenOption] = useState<'now' | 'later' | null>(null);

  const openWhenSheet = () => {
    setWhenOption(null);
    setWhenSheetVisible(true);
  };

  const closeWhenSheet = () => {
    setWhenSheetVisible(false);
    setWhenOption(null);
  };

  const handleWhenContinue = () => {
    if (whenOption === 'now') {
      closeWhenSheet();
      openTripFlow(navigation, 'SearchTrip');
    } else if (whenOption === 'later') {
      closeWhenSheet();
      openTripFlow(navigation, 'PlanRide');
    }
  };

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
            <TouchableOpacity style={styles.agendarButton} activeOpacity={0.8} onPress={openWhenSheet}>
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
              onPress={openWhenSheet}
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
                  onPress={() => service.id === 'viagens' && openWhenSheet()}
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

      <Modal
        visible={whenSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeWhenSheet}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeWhenSheet}>
          <Pressable style={styles.sheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Para quando você precisa da viagem?</Text>

            <TouchableOpacity
              style={[styles.sheetOption, whenOption === 'now' && styles.sheetOptionSelected]}
              onPress={() => setWhenOption('now')}
              activeOpacity={0.8}
            >
              <View style={styles.sheetOptionIcon}>
                <MaterialIcons name="schedule" size={28} color={COLORS.black} />
              </View>
              <View style={styles.sheetOptionTextWrap}>
                <Text style={styles.sheetOptionLabel}>Agora</Text>
                <Text style={styles.sheetOptionSubtitle}>Chame um carro imediatamente</Text>
              </View>
              <View style={[styles.sheetRadio, whenOption === 'now' && styles.sheetRadioSelected]}>
                {whenOption === 'now' && <View style={styles.sheetRadioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetOption, whenOption === 'later' && styles.sheetOptionSelected]}
              onPress={() => setWhenOption('later')}
              activeOpacity={0.8}
            >
              <View style={styles.sheetOptionIcon}>
                <MaterialIcons name="event" size={28} color={COLORS.black} />
              </View>
              <View style={styles.sheetOptionTextWrap}>
                <Text style={styles.sheetOptionLabel}>Mais tarde</Text>
                <Text style={styles.sheetOptionSubtitle}>Agende para o horário que preferir</Text>
              </View>
              <View style={[styles.sheetRadio, whenOption === 'later' && styles.sheetRadioSelected]}>
                {whenOption === 'later' && <View style={styles.sheetRadioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetContinueButton, !whenOption && styles.sheetContinueButtonDisabled]}
              onPress={handleWhenContinue}
              disabled={!whenOption}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetContinueButtonText}>Continuar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neutral400,
    alignSelf: 'center',
    marginBottom: 24,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 24,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.neutral400,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sheetOptionSelected: {
    borderColor: COLORS.black,
  },
  sheetOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sheetOptionTextWrap: { flex: 1 },
  sheetOptionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  sheetOptionSubtitle: { fontSize: 14, color: COLORS.neutral700, marginTop: 2 },
  sheetRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.neutral400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRadioSelected: { borderColor: COLORS.black },
  sheetRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.black,
  },
  sheetContinueButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  sheetContinueButtonDisabled: { opacity: 0.5 },
  sheetContinueButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
