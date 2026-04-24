/**
 * Cálculo canônico de preço para pedidos Take Me.
 *
 * Espelha a fórmula do RPC `public.compute_order_pricing` e é a ÚNICA fonte de
 * verdade usada pelos apps (cliente, motorista, admin) para preview de preço.
 *
 * Fórmula do PDF "Fórmulas de Preços App Takeme":
 *   Total = base + ganho_promo%·Total − desconto_promo%·Total + admin%·Total + adicionais
 *   ⇒ Total·(1 − ganho% + desconto% − admin%) = base + adicionais
 *   ⇒ Total = (base + adicionais) / (1 − ganho% + desconto% − admin%)
 *
 * Split (cartão / Pix):
 *   Motorista recebe = base + ganho_promo − desconto_promo
 *   Admin recebe     = admin_fee + adicionais
 *   Motorista + Admin = Total (invariante)
 */

export type PricingInput = {
  baseCents: number;
  surchargesCents?: number;
  adminPct?: number;
  gainPct?: number;
  discountPct?: number;
};

export type PricingResult = {
  totalCents: number;
  baseCents: number;
  surchargesCents: number;
  adminFeeCents: number;
  promoGainCents: number;
  promoDiscountCents: number;
  workerEarningCents: number;
  adminEarningCents: number;
  adminPctApplied: number;
  gainPctApplied: number;
  discountPctApplied: number;
};

export class PricingDenominatorOverflowError extends Error {
  readonly denom: number;
  constructor(denom: number) {
    super(
      `pricing:denominator_overflow — a soma admin+gain+discount supera os limites aceitáveis (denom=${denom.toFixed(4)})`
    );
    this.name = 'PricingDenominatorOverflowError';
    this.denom = denom;
  }
}

const sanitizePct = (value: number | null | undefined): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

const sanitizeCents = (value: number | null | undefined): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

/**
 * Aplica o gross-up literal do PDF.
 *
 * @throws PricingDenominatorOverflowError se a soma de admin + gain − discount
 *   aproxima-se de 100% (denom <= 5%), o que torna o total explosivo.
 */
export function computeOrderPricing(input: PricingInput): PricingResult {
  const base = sanitizeCents(input.baseCents);
  const surcharges = sanitizeCents(input.surchargesCents);
  const adminPct = sanitizePct(input.adminPct);
  const gainPct = sanitizePct(input.gainPct);
  const discountPct = sanitizePct(input.discountPct);

  const denom = 1 - gainPct / 100 + discountPct / 100 - adminPct / 100;

  if (denom <= 0.05) {
    throw new PricingDenominatorOverflowError(denom);
  }

  const total = Math.max(0, Math.round((base + surcharges) / denom));
  const promoGain = Math.round((total * gainPct) / 100);
  const promoDiscount = Math.round((total * discountPct) / 100);
  const adminFee = Math.round((total * adminPct) / 100);

  const workerEarning = base + promoGain - promoDiscount;
  const adminEarning = total - workerEarning;

  return {
    totalCents: total,
    baseCents: base,
    surchargesCents: surcharges,
    adminFeeCents: adminFee,
    promoGainCents: promoGain,
    promoDiscountCents: promoDiscount,
    workerEarningCents: workerEarning,
    adminEarningCents: adminEarning,
    adminPctApplied: adminPct,
    gainPctApplied: gainPct,
    discountPctApplied: discountPct,
  };
}

/**
 * Valor que efetivamente entra no PaymentIntent (o passageiro sempre paga o
 * `total_cents`: o desconto promocional já está embutido no gross-up, não se
 * subtrai de novo na cobrança).
 */
export function chargeAmountCentsOf(r: PricingResult): number {
  return Math.max(1, r.totalCents);
}

/**
 * Comissão da plataforma no `application_fee_amount` do Stripe Connect.
 */
export function applicationFeeCentsOf(r: PricingResult): number {
  return Math.max(0, r.adminEarningCents);
}

const brl = (cents: number): string =>
  (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

/**
 * Linhas de breakdown prontas para UI (cliente, motorista, admin).
 */
export function formatPricingBreakdown(r: PricingResult): Array<{ label: string; valueCents: number; isTotal?: boolean }> {
  const lines: Array<{ label: string; valueCents: number; isTotal?: boolean }> = [
    { label: 'Base', valueCents: r.baseCents },
  ];

  if (r.surchargesCents > 0) {
    lines.push({ label: 'Adicionais', valueCents: r.surchargesCents });
  }

  if (r.promoGainCents > 0) {
    lines.push({
      label: `Ganho promocional (${r.gainPctApplied.toFixed(2).replace(/\.?0+$/, '')}%)`,
      valueCents: r.promoGainCents,
    });
  }

  if (r.promoDiscountCents > 0) {
    lines.push({
      label: `Desconto promocional (${r.discountPctApplied.toFixed(2).replace(/\.?0+$/, '')}%)`,
      valueCents: -r.promoDiscountCents,
    });
  }

  if (r.adminFeeCents > 0) {
    lines.push({
      label: `Taxa da plataforma (${r.adminPctApplied.toFixed(2).replace(/\.?0+$/, '')}%)`,
      valueCents: r.adminFeeCents,
    });
  }

  lines.push({ label: 'Total', valueCents: r.totalCents, isTotal: true });
  return lines;
}

/**
 * Versão compacta em string (ex.: "R$ 35,00 = R$ 30,00 + R$ 5,00 taxa").
 */
export function formatPricingSummary(r: PricingResult): string {
  return `${brl(r.totalCents)} (motorista ${brl(r.workerEarningCents)} + plataforma ${brl(r.adminEarningCents)})`;
}

export type ApplyPromotionResult = {
  promotionId: string | null;
  gainPct: number;
  discountPct: number;
  promoWorkerRouteId: string | null;
};

/**
 * Normaliza o retorno de `apply_active_promotion` do Supabase em formato
 * previsível pelo front-end.
 */
export function normalizeApplyPromotion(
  row:
    | {
        promotion_id?: string | null;
        gain_pct?: number | string | null;
        discount_pct?: number | string | null;
        promo_worker_route_id?: string | null;
      }
    | null
    | undefined
): ApplyPromotionResult {
  if (!row) {
    return { promotionId: null, gainPct: 0, discountPct: 0, promoWorkerRouteId: null };
  }
  return {
    promotionId: row.promotion_id ?? null,
    gainPct: sanitizePct(Number(row.gain_pct ?? 0)),
    discountPct: sanitizePct(Number(row.discount_pct ?? 0)),
    promoWorkerRouteId: row.promo_worker_route_id ?? null,
  };
}
