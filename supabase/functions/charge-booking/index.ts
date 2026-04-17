import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-auth-token, x-client-info, apikey, content-type",
};

const STRIPE_API = "https://api.stripe.com/v1";

type DraftBookingBody = {
  scheduled_trip_id?: string;
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_address?: string;
  destination_lat?: number;
  destination_lng?: number;
  passenger_count?: number;
  bags_count?: number;
  passenger_data?: unknown;
};

async function stripeFetch(
  secretKey: string,
  method: string,
  path: string,
  body?: URLSearchParams
): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${STRIPE_API}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
  };
  if (body && method !== "GET") opts.body = body.toString();
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new Error(err);
  }
  return data;
}

async function stripeRefundPaymentIntent(secretKey: string, paymentIntentId: string): Promise<void> {
  const params = new URLSearchParams({ payment_intent: paymentIntentId });
  await stripeFetch(secretKey, "POST", "/refunds", params);
}

function resolveTripPriceCents(
  trip: {
    route_id?: string | null;
    price_per_person_cents?: number | null;
    amount_cents?: number | null;
  },
  routePriceById: Map<string, number | null>
): number | null {
  const routeId = trip.route_id;
  if (routeId && routePriceById.has(routeId)) {
    const fromRoute = routePriceById.get(routeId);
    if (fromRoute != null && fromRoute >= 0) return fromRoute;
  }
  const tripPpp = trip.price_per_person_cents;
  if (tripPpp != null && tripPpp >= 0) return tripPpp;
  const legacy = trip.amount_cents;
  if (legacy != null && legacy >= 0) return legacy;
  return null;
}

async function resolvePriceCentsForScheduledTrip(
  admin: SupabaseClient,
  scheduledTripId: string
): Promise<{ cents: number | null; error: string | null }> {
  const { data: trip, error: tripErr } = await admin
    .from("scheduled_trips")
    .select("route_id, price_per_person_cents, amount_cents")
    .eq("id", scheduledTripId)
    .maybeSingle();
  if (tripErr) {
    return { cents: null, error: "Não foi possível obter os dados da viagem." };
  }
  if (!trip) {
    return { cents: null, error: "Viagem não encontrada." };
  }
  const routeId = trip.route_id as string | null | undefined;
  const routePriceById = new Map<string, number | null>();
  if (routeId) {
    const { data: route, error: routeErr } = await admin
      .from("worker_routes")
      .select("id, price_per_person_cents")
      .eq("id", routeId)
      .eq("is_active", true)
      .maybeSingle();
    if (routeErr) {
      return { cents: null, error: "Não foi possível obter o preço da rota." };
    }
    if (route) {
      routePriceById.set(route.id as string, (route.price_per_person_cents as number | null) ?? null);
    }
  }
  const cents = resolveTripPriceCents(
    {
      route_id: trip.route_id as string | null | undefined,
      price_per_person_cents: trip.price_per_person_cents as number | null | undefined,
      amount_cents: trip.amount_cents as number | null | undefined,
    },
    routePriceById
  );
  return { cents, error: null };
}

async function resolveStripePaymentMethodId(
  admin: SupabaseClient,
  userId: string,
  paymentMethodIdSupabase: string | undefined,
  stripePaymentMethodIdFromClient: string | undefined
): Promise<{ pm: string } | { error: string; status: number }> {
  if (stripePaymentMethodIdFromClient) {
    return { pm: stripePaymentMethodIdFromClient };
  }
  if (paymentMethodIdSupabase) {
    const { data: pmRow, error: pmErr } = await admin
      .from("payment_methods")
      .select("id, user_id, provider_id")
      .eq("id", paymentMethodIdSupabase)
      .eq("user_id", userId)
      .single();
    if (pmErr || !pmRow?.provider_id) {
      return { error: "Método de pagamento não encontrado", status: 404 };
    }
    return { pm: pmRow.provider_id as string };
  }
  return { error: "Informe stripe_payment_method_id ou payment_method_id", status: 400 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("x-auth-token");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : (authHeader ?? "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string } | undefined;
    const userId = claims?.sub;
    if (claimsError || !userId) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      booking_id?: string;
      draft_booking?: DraftBookingBody;
      payment_method_id?: string;
      stripe_payment_method_id?: string;
    };
    const bookingId = body.booking_id?.trim();
    const paymentMethodIdSupabase = body.payment_method_id?.trim();
    const stripePaymentMethodIdFromClient = body.stripe_payment_method_id?.trim();
    const draft = body.draft_booking;
    const hasDraft = Boolean(draft?.scheduled_trip_id?.trim());
    const hasLegacyBooking = Boolean(bookingId);

    if (hasDraft && hasLegacyBooking) {
      return new Response(
        JSON.stringify({ error: "Envie apenas draft_booking ou apenas booking_id, não os dois." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!hasDraft && !hasLegacyBooking) {
      return new Response(
        JSON.stringify({
          error: "Envie booking_id (reserva já criada) ou draft_booking (checkout com cartão).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const pmRes = await resolveStripePaymentMethodId(
      admin,
      userId,
      paymentMethodIdSupabase,
      stripePaymentMethodIdFromClient
    );
    if ("error" in pmRes) {
      return new Response(JSON.stringify({ error: pmRes.error }), {
        status: pmRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripePaymentMethodId = pmRes.pm;

    const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("id", userId).single();
    const customerId = profile?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Cliente Stripe não encontrado; adicione um método de pagamento primeiro" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Modo: nova reserva (cartão) — cobrar antes de inserir ──
    if (hasDraft && draft) {
      const sid = draft.scheduled_trip_id!.trim();
      const pax = Math.max(1, Math.floor(Number(draft.passenger_count ?? 0)));
      const bags = Math.max(0, Math.floor(Number(draft.bags_count ?? 0)));
      if (!draft.origin_address?.trim() || !draft.destination_address?.trim()) {
        return new Response(JSON.stringify({ error: "Endereços de origem e destino são obrigatórios." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (
        !Number.isFinite(draft.origin_lat) ||
        !Number.isFinite(draft.origin_lng) ||
        !Number.isFinite(draft.destination_lat) ||
        !Number.isFinite(draft.destination_lng)
      ) {
        return new Response(JSON.stringify({ error: "Coordenadas inválidas." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tripRow, error: tripLoadErr } = await admin
        .from("scheduled_trips")
        .select("id, status, seats_available, driver_id")
        .eq("id", sid)
        .maybeSingle();
      if (tripLoadErr || !tripRow) {
        return new Response(JSON.stringify({ error: "Viagem não encontrada." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ((tripRow.status as string) !== "active") {
        return new Response(JSON.stringify({ error: "Esta viagem não está disponível para reserva." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const seatsAvail = Number(tripRow.seats_available ?? 0);
      if (!Number.isFinite(seatsAvail) || seatsAvail < pax) {
        return new Response(JSON.stringify({ error: "Capacidade insuficiente para esta viagem." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { cents: amountCentsResolved, error: priceErr } = await resolvePriceCentsForScheduledTrip(admin, sid);
      if (priceErr) {
        return new Response(JSON.stringify({ error: priceErr }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const amountCents = amountCentsResolved != null ? Number(amountCentsResolved) : NaN;
      if (!Number.isInteger(amountCents) || amountCents < 1) {
        return new Response(JSON.stringify({ error: "Valor da viagem inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Promoção passada pelo cliente
      const promoDiscountCents = Math.max(0, Math.floor(Number(draft.promo_discount_cents ?? 0)));
      const promoAdminPct = Number(draft.admin_pct_applied ?? 0);
      const promoId = (draft.promotion_id as string | undefined)?.trim() ?? null;
      const chargeAmountCents = Math.max(1, amountCents - promoDiscountCents);
      const platformFeeCents = promoAdminPct > 0
        ? Math.round((amountCents - promoDiscountCents) * promoAdminPct / 100)
        : 0;

      const driverId = (tripRow.driver_id as string | undefined)?.trim() ?? "";
      let connectAccountId: string | null = null;
      let applicationFeeCents: number | null = null;
      if (driverId) {
        const { data: wp } = await admin
          .from("worker_profiles")
          .select("stripe_connect_account_id")
          .eq("id", driverId)
          .maybeSingle();
        connectAccountId = (wp?.stripe_connect_account_id as string | null | undefined)?.trim() ?? null;
        const workerPayoutPreview = chargeAmountCents - platformFeeCents;
        const payout = Number.isFinite(workerPayoutPreview) ? Math.max(0, Math.floor(workerPayoutPreview)) : null;
        if (connectAccountId && payout != null) {
          if (payout > amountCents) {
            return new Response(
              JSON.stringify({ error: "Inconsistência de valores da reserva (repasse > total)" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          applicationFeeCents = amountCents - payout;
          if (applicationFeeCents < 0) {
            return new Response(
              JSON.stringify({ error: "Taxa de aplicação inválida para Stripe Connect" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      const piParams = new URLSearchParams({
        amount: String(chargeAmountCents),
        currency: "brl",
        customer: customerId,
        "payment_method": stripePaymentMethodId,
        confirm: "true",
        // Dashboard pode habilitar Link/PIX etc.; sem return_url a Stripe exige desativar redirects.
        "automatic_payment_methods[enabled]": "true",
        "automatic_payment_methods[allow_redirects]": "never",
        "metadata[scheduled_trip_id]": sid,
        "metadata[user_id]": userId,
      });
      if (connectAccountId && applicationFeeCents != null) {
        piParams.set("application_fee_amount", String(applicationFeeCents));
        piParams.set("transfer_data[destination]", connectAccountId);
        piParams.set("metadata[stripe_connect_destination]", connectAccountId);
      }

      let pi: { id?: string; status?: string; amount?: number; last_payment_error?: { message?: string } };
      try {
        pi = await stripeFetch(stripeSecret, "POST", "/payment_intents", piParams) as typeof pi;
      } catch (e) {
        return new Response(
          JSON.stringify({ error: e instanceof Error ? e.message : "Falha ao cobrar no Stripe" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
        const errMsg = pi.last_payment_error?.message ?? "Pagamento não foi aprovado";
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      /** Valor efetivamente debitado (fonte de verdade = Stripe, em centavos). */
      const billedCents =
        typeof pi.amount === "number" && Number.isFinite(pi.amount) && Math.floor(pi.amount) >= 1
          ? Math.floor(pi.amount)
          : chargeAmountCents;
      /** Integridade: amount_cents = pricing_subtotal_cents + platform_fee_cents (ver migration). */
      let feeStored = Math.max(0, Math.floor(platformFeeCents));
      if (feeStored > billedCents) feeStored = 0;
      const subtotalStored = Math.max(0, billedCents - feeStored);

      const passengerDataJson = draft.passenger_data ?? [];
      const insertRow = {
        user_id: userId,
        scheduled_trip_id: sid,
        origin_address: draft.origin_address!.trim(),
        origin_lat: draft.origin_lat!,
        origin_lng: draft.origin_lng!,
        destination_address: draft.destination_address!.trim(),
        destination_lat: draft.destination_lat!,
        destination_lng: draft.destination_lng!,
        passenger_count: pax,
        bags_count: bags,
        passenger_data: passengerDataJson,
        price_route_base_cents: amountCents,
        pricing_subtotal_cents: subtotalStored,
        platform_fee_cents: feeStored,
        pricing_surcharges_cents: 0,
        promo_discount_cents: promoDiscountCents,
        promotion_id: promoId || null,
        admin_pct_applied: promoAdminPct || null,
        amount_cents: billedCents,
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stripe_payment_intent_id: pi.id ?? null,
      };

      const { data: inserted, error: insErr } = await admin
        .from("bookings")
        .insert(insertRow as never)
        .select("id, worker_payout_cents")
        .single();

      if (insErr || !inserted?.id) {
        console.error("[charge-booking] insert após cobrança:", insErr);
        if (pi.id) {
          try {
            await stripeRefundPaymentIntent(stripeSecret, pi.id);
          } catch (re) {
            console.error("[charge-booking] estorno após falha no insert:", re);
          }
        }
        return new Response(
          JSON.stringify({
            error:
              "Pagamento autorizado, mas não foi possível registrar a reserva (capacidade ou dados). O valor será estornado automaticamente; se não refletir em até 5 dias úteis, contate o suporte.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newBookingId = inserted.id as string;

      // Payout é criado automaticamente pelo trigger SQL quando a trip é completada
      // (fn_create_payouts_on_trip_complete). Não criamos aqui no charge.

      return new Response(
        JSON.stringify({ ok: true, booking_id: newBookingId, amount_cents: billedCents }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Modo legado: reserva pending já criada ──
    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select("id, user_id, amount_cents, status, worker_payout_cents, scheduled_trips(driver_id)")
      .eq("id", bookingId)
      .eq("user_id", userId)
      .single();
    if (bookingErr || !booking) {
      return new Response(
        JSON.stringify({ error: "Reserva não encontrada ou não pertence ao usuário" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (booking.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Reserva já foi paga ou cancelada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountCents = Number(booking.amount_cents);
    if (!Number.isInteger(amountCents) || amountCents < 1) {
      return new Response(
        JSON.stringify({ error: "Valor da reserva inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stRaw = booking.scheduled_trips as { driver_id?: string } | { driver_id?: string }[] | null;
    const st = Array.isArray(stRaw) ? stRaw[0] : stRaw;
    const driverId = st?.driver_id?.trim();
    let connectAccountId: string | null = null;
    let applicationFeeCents: number | null = null;

    if (driverId) {
      const { data: wp } = await admin
        .from("worker_profiles")
        .select("stripe_connect_account_id")
        .eq("id", driverId)
        .maybeSingle();
      connectAccountId = (wp?.stripe_connect_account_id as string | null | undefined)?.trim() ?? null;

      const workerPayout = booking.worker_payout_cents;
      const payout =
        workerPayout != null && Number.isFinite(Number(workerPayout))
          ? Math.max(0, Math.floor(Number(workerPayout)))
          : null;

      if (connectAccountId && payout != null) {
        if (payout > amountCents) {
          return new Response(
            JSON.stringify({ error: "Inconsistência de valores da reserva (repasse > total)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        applicationFeeCents = amountCents - payout;
        if (applicationFeeCents < 0) {
          return new Response(
            JSON.stringify({ error: "Taxa de aplicação inválida para Stripe Connect" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const piParams = new URLSearchParams({
      amount: String(amountCents),
      currency: "brl",
      customer: customerId,
      "payment_method": stripePaymentMethodId,
      confirm: "true",
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      "metadata[booking_id]": bookingId,
    });
    if (connectAccountId && applicationFeeCents != null) {
      piParams.set("application_fee_amount", String(applicationFeeCents));
      piParams.set("transfer_data[destination]", connectAccountId);
      piParams.set("metadata[stripe_connect_destination]", connectAccountId);
    }
    const pi = await stripeFetch(stripeSecret, "POST", "/payment_intents", piParams) as {
      id?: string;
      status?: string;
      last_payment_error?: { message?: string };
    };
    if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
      const errMsg = pi.last_payment_error?.message ?? "Pagamento não foi aprovado";
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateErr } = await admin
      .from("bookings")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stripe_payment_intent_id: pi.id ?? null,
      })
      .eq("id", bookingId)
      .eq("user_id", userId);
    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Reserva cobrada mas falha ao atualizar status; contate o suporte" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payout é criado automaticamente pelo trigger SQL quando a trip é completada
    // (fn_create_payouts_on_trip_complete). Não criamos aqui no charge.

    return new Response(
      JSON.stringify({ ok: true, booking_id: bookingId, amount_cents: amountCents }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("charge-booking:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao processar cobrança" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
