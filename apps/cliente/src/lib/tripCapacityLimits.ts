/**
 * Regras compartilhadas entre corrida comum e envio de dependente:
 * — máximo de malas: 1 por passageiro, sem ultrapassar o teto da viagem (`bags_available`);
 * — contagens de passageiros diferem entre corrida titular (`bookingTotalPassengers`) e envio de dependente (`dependentShipmentTotalPassengers`: só embarcados).
 */

/** Corrida normal: titular + passageiros extras informados na confirmação. */
export function bookingTotalPassengers(extraPassengers: number): number {
  return 1 + Math.max(0, Math.floor(extraPassengers));
}

/**
 * Envio de dependente: só conta quem **embarca** na corrida — o dependente e,
 * opcionalmente, outras pessoas na mesma viagem **com ele**. Quem solicita o envio não viaja e não ocupa lugar.
 */
export function dependentShipmentTotalPassengers(extraCompanionsOnTrip: number): number {
  return 1 + Math.max(0, Math.floor(extraCompanionsOnTrip));
}

/**
 * Teto de malas: min(pessoas no grupo, limite de malas da oferta).
 * `tripBagLimit` ausente, ≤0 ou inválido no payload = sem teto da viagem (só 1 mala por pessoa).
 */
export function maxBagsForTrip(totalPassengers: number, tripBagLimit: number | null | undefined): number {
  const perPersonCap = Math.max(1, Math.floor(totalPassengers));
  const raw = tripBagLimit == null ? null : Math.floor(Number(tripBagLimit));
  const tripCap =
    raw == null || !Number.isFinite(raw) || raw <= 0 ? Number.MAX_SAFE_INTEGER : raw;
  return Math.min(perPersonCap, tripCap);
}
