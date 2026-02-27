import { Platform } from 'react-native';

/**
 * No Android (Google Maps), marcadores com View/SVG customizados costumam
 * aparecer cortados ou piscando. Usamos pinColor (pin nativo) para
 * tamanho e estabilidade corretos. No iOS (Apple Maps) as views customizadas
 * funcionam bem e mantemos o visual atual.
 */
export const useNativePinOnAndroid = Platform.OS === 'android';
