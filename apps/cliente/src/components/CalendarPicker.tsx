import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), 1);
  out.setHours(0, 0, 0, 0);
  return out;
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Retorna o dia da semana (0 = Domingo). */
function getDayOfWeek(d: Date): number {
  return d.getDay();
}

type Props = {
  /** Data inicial exibida (mês) e seleção inicial; usar data atual ou filtro aplicado */
  initialDate: Date;
  /** Data atualmente selecionada (pode ser undefined) */
  selectedDate?: Date | null;
  onSelectDate: (date: Date) => void;
  /** Cor do círculo do dia selecionado */
  accentColor?: string;
};

export function CalendarPicker({
  initialDate,
  selectedDate = null,
  onSelectDate,
  accentColor = '#b45309',
}: Props) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initialDate));

  const monthLabel = `${MONTH_NAMES[viewMonth.getMonth()]} - ${viewMonth.getFullYear()}`;

  const goPrevMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const selectedIso = selectedDate ? toISODate(selectedDate) : null;

  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const totalDays = daysInMonth(viewMonth);
    const startPad = getDayOfWeek(first);
    const cells: { type: 'prev' | 'current' | 'next'; date: Date; day: number }[] = [];

    const prevMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1);
    const prevDays = daysInMonth(prevMonth);
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevDays - i);
      cells.push({ type: 'prev', date: d, day: d.getDate() });
    }
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      cells.push({ type: 'current', date: d, day });
    }
    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, day);
      cells.push({ type: 'next', date: d, day: d.getDate() });
    }
    return cells;
  }, [viewMonth]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goPrevMonth} style={styles.arrowButton} hitSlop={12}>
          <MaterialIcons name="chevron-left" size={28} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.monthYear}>{monthLabel}</Text>
        <TouchableOpacity onPress={goNextMonth} style={styles.arrowButton} hitSlop={12}>
          <MaterialIcons name="chevron-right" size={28} color={COLORS.black} />
        </TouchableOpacity>
      </View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <Text key={i} style={styles.weekdayCell}>
            {letter}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {grid.map((cell, index) => {
          const iso = toISODate(cell.date);
          const isSelected = iso === selectedIso;
          const isOtherMonth = cell.type !== 'current';
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayCell,
                isOtherMonth && styles.dayCellOther,
                isSelected && [styles.dayCellSelected, { backgroundColor: accentColor }],
              ]}
              onPress={() => onSelectDate(cell.date)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayText,
                  isOtherMonth && styles.dayTextOther,
                  isSelected && styles.dayTextSelected,
                ]}
              >
                {cell.day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const COLORS = {
  black: '#0d0d0d',
  neutral400: '#a3a3a3',
  neutral600: '#525252',
};

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  arrowButton: { padding: 4 },
  monthYear: { fontSize: 18, fontWeight: '700', color: COLORS.black },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutral600,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  dayCellOther: {},
  dayCellSelected: {},
  dayText: { fontSize: 16, fontWeight: '500', color: COLORS.black },
  dayTextOther: { color: COLORS.neutral400 },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '600' },
});
