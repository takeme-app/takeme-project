/**
 * Opções de data para o carrossel: Hoje + 7 dias.
 * Cada item tem dia em cima (Hoje / Amanhã / Seg...) e mês + data embaixo (Out 03).
 */
export type DateCarouselOption = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  date: Date;
};

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

export function getDateCarouselOptions(): DateCarouselOption[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const options: DateCarouselOption[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const id = toISODate(d);
    let dayLabel: string;
    if (i === 0) dayLabel = 'Hoje';
    else if (i === 1) dayLabel = 'Amanhã';
    else dayLabel = WEEKDAY_SHORT[d.getDay()];
    const dateLabel = `${MONTH_SHORT[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
    options.push({ id, dayLabel, dateLabel, date: d });
  }
  return options;
}

export type TimeSlotOption = { label: string; startMinutes: number };

/**
 * Gera todos os intervalos de 30 min do dia: "00:00 - 00:30", "00:30 - 01:00", ... "23:30 - 24:00".
 * 48 slots no total.
 */
function buildAllTimeSlots(): TimeSlotOption[] {
  const slots: TimeSlotOption[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const startMinutes = h * 60 + m;
      const endH = m === 30 ? h + 1 : h;
      const endM = m === 30 ? 0 : 30;
      const endLabel = endH >= 24 ? '24:00' : `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} - ${endLabel}`;
      slots.push({ label, startMinutes });
    }
  }
  return slots;
}

export const ALL_TIME_SLOTS: TimeSlotOption[] = buildAllTimeSlots();

/**
 * Retorna os horários disponíveis para o dia selecionado.
 * Se for hoje, apenas intervalos cujo início é maior que o horário atual.
 */
export function getAvailableTimeSlots(
  selectedDateId: string,
  allSlots: TimeSlotOption[]
): TimeSlotOption[] {
  const now = new Date();
  const todayId = toISODate(now);
  const isToday = selectedDateId === todayId;
  if (!isToday) return allSlots;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return allSlots.filter((s) => s.startMinutes > currentMinutes);
}

export { isSameDay, toISODate };
