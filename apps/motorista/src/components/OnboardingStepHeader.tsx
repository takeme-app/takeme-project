import { View, StyleSheet } from 'react-native';
import { Text } from './Text';

/**
 * Indicador visual de progresso do onboarding do motorista / preparador.
 * - Etapa 1: criar conta (e-mail/telefone + senha + PIN)
 * - Etapa 2: completar perfil
 * - Etapa 3: configurar recebimento (Stripe Connect)
 */
export type OnboardingStep = 1 | 2 | 3;

type Props = {
  current: OnboardingStep;
  title: string;
  subtitle?: string;
};

const STEP_LABELS: Record<OnboardingStep, string> = {
  1: 'Criar conta',
  2: 'Completar perfil',
  3: 'Configurar recebimento',
};

export function OnboardingStepHeader({ current, title, subtitle }: Props) {
  const steps: OnboardingStep[] = [1, 2, 3];
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {steps.map((step, idx) => {
          const done = step < current;
          const active = step === current;
          return (
            <View key={step} style={styles.stepRow}>
              <View
                style={[
                  styles.bullet,
                  done && styles.bulletDone,
                  active && styles.bulletActive,
                ]}
              >
                <Text
                  style={[
                    styles.bulletText,
                    done && styles.bulletTextDone,
                    active && styles.bulletTextActive,
                  ]}
                >
                  {done ? '✓' : String(step)}
                </Text>
              </View>
              {idx < steps.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    step < current && styles.connectorDone,
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <Text style={styles.stepsLabel}>{`Etapa ${current} de 3 — ${STEP_LABELS[current]}`}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const SIZE = 28;

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  bullet: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletActive: {
    borderColor: '#000000',
    backgroundColor: '#000000',
  },
  bulletDone: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  bulletText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  bulletTextActive: { color: '#FFFFFF' },
  bulletTextDone: { color: '#FFFFFF' },
  connector: {
    width: 32,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 6,
  },
  connectorDone: { backgroundColor: '#059669' },
  stepsLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 20 },
});
