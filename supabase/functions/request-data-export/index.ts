import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIVE_MIN_MS = 5 * 60 * 1000;

type ExportPayload = {
  auth: { email: string | undefined; phone: string | undefined };
  profile: unknown;
  recent_destinations: unknown[];
  dependents: unknown[];
  bookings: unknown[];
  shipments: unknown[];
  dependent_shipments: unknown[];
  notification_preferences: unknown[];
  excursion_requests: unknown[];
  exported_at: string;
};

function buildPdfLines(payload: ExportPayload): string[] {
  const lines: string[] = [];
  const push = (arr: string[]) => arr.forEach((s) => lines.push(s));

  lines.push("— CÓPIA DOS SEUS DADOS (Take Me) —");
  lines.push(`Exportado em: ${payload.exported_at}`);
  lines.push("");

  push(["=== CONTA (Auth) ==="]);
  lines.push(`E-mail: ${payload.auth.email ?? "(não informado)"}`);
  lines.push(`Telefone: ${payload.auth.phone ?? "(não informado)"}`);
  lines.push("");

  push(["=== PERFIL ==="]);
  const p = payload.profile as Record<string, unknown> | null;
  if (p) {
    Object.entries(p).forEach(([k, v]) => lines.push(`${k}: ${v === null || v === undefined ? "" : String(v)}`));
  } else {
    lines.push("(sem dados)");
  }
  lines.push("");

  push(["=== DESTINOS RECENTES ==="]);
  if (payload.recent_destinations.length) {
    payload.recent_destinations.forEach((d: unknown, i: number) => {
      const o = d as Record<string, unknown>;
      lines.push(`${i + 1}. ${o.address ?? ""} — ${o.city ?? ""}`);
    });
  } else {
    lines.push("(nenhum)");
  }
  lines.push("");

  push(["=== DEPENDENTES ==="]);
  if (payload.dependents.length) {
    payload.dependents.forEach((d: unknown, i: number) => {
      const o = d as Record<string, unknown>;
      lines.push(`${i + 1}. ${o.full_name ?? ""} — status: ${o.status ?? ""}`);
    });
  } else {
    lines.push("(nenhum)");
  }
  lines.push("");

  push(["=== RESERVAS (Bookings) ==="]);
  if (payload.bookings.length) {
    payload.bookings.forEach((b: unknown, i: number) => {
      const o = b as Record<string, unknown>;
      lines.push(`${i + 1}. ${o.origin_address ?? ""} → ${o.destination_address ?? ""} — status: ${o.status ?? ""}`);
    });
  } else {
    lines.push("(nenhuma)");
  }
  lines.push("");

  push(["=== ENVIOS (Shipments) ==="]);
  if (payload.shipments.length) {
    payload.shipments.forEach((s: unknown, i: number) => {
      const o = s as Record<string, unknown>;
      lines.push(`${i + 1}. ${o.origin_address ?? ""} → ${o.destination_address ?? ""} — status: ${o.status ?? ""}`);
    });
  } else {
    lines.push("(nenhum)");
  }
  lines.push("");

  push(["=== ENVIOS DE DEPENDENTES ==="]);
  if (payload.dependent_shipments.length) {
    payload.dependent_shipments.forEach((s: unknown, i: number) => {
      const o = s as Record<string, unknown>;
      lines.push(`${i + 1}. ${o.full_name ?? ""} — ${o.origin_address ?? ""} → ${o.destination_address ?? ""} — status: ${o.status ?? ""}`);
    });
  } else {
    lines.push("(nenhum)");
  }
  lines.push("");

  push(["=== PREFERÊNCIAS DE NOTIFICAÇÃO ==="]);
  if (payload.notification_preferences.length) {
    payload.notification_preferences.forEach((n: unknown) => {
      const o = n as Record<string, unknown>;
      lines.push(`${o.key ?? ""}: ${o.enabled ? "ativado" : "desativado"}`);
    });
  } else {
    lines.push("(nenhuma)");
  }
  lines.push("");

  push(["=== EXCURSÕES ==="]);
  if (payload.excursion_requests.length) {
    payload.excursion_requests.forEach((er: unknown, i: number) => {
      const o = er as Record<string, unknown>;
      const passengers = (o.excursion_passengers as unknown[]) ?? [];
      lines.push(`${i + 1}. Destino: ${o.destination ?? ""} — Data: ${o.excursion_date ?? ""} — Status: ${o.status ?? ""}`);
      passengers.forEach((p: unknown, j: number) => {
        const pp = p as Record<string, unknown>;
        lines.push(`   Passageiro ${j + 1}: ${pp.full_name ?? ""}`);
      });
    });
  } else {
    lines.push("(nenhuma)");
  }

  return lines;
}

async function createPdf(payload: ExportPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const lineHeight = fontSize * 1.3;
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  let y = pageHeight - margin;
  let page = doc.addPage([pageWidth, pageHeight]);

  const lines = buildPdfLines(payload);
  const maxWidth = pageWidth - 2 * margin;

  for (const line of lines) {
    if (y < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      const chunks = trimmed.length > 90 ? trimmed.match(/.{1,90}(\s|$)/g) ?? [trimmed] : [trimmed];
      for (const chunk of chunks) {
        if (y < margin) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(chunk, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
          maxWidth,
        });
        y -= lineHeight;
      }
    } else {
      y -= lineHeight;
    }
  }

  return doc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user: authUser }, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user = authUser;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const email = user.email?.trim();
    if (!email) {
      return new Response(
        JSON.stringify({ error: "E-mail não cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lastExport } = await admin
      .from("data_export_requests")
      .select("last_sent_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (lastExport?.last_sent_at) {
      const lastSent = new Date(lastExport.last_sent_at).getTime();
      const elapsed = Date.now() - lastSent;
      if (elapsed < FIVE_MIN_MS) {
        const retryAfterMinutes = Math.ceil((FIVE_MIN_MS - elapsed) / 60000);
        return new Response(
          JSON.stringify({
            error: "rate_limited",
            message: `Você já solicitou uma cópia. Tente novamente em ${retryAfterMinutes} minuto(s).`,
            retryAfterMinutes,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const [
      { data: profile },
      { data: recent_destinations },
      { data: dependents },
      { data: bookings },
      { data: shipments },
      { data: dependent_shipments },
      { data: notification_preferences },
      { data: excursion_requests },
    ] = await Promise.all([
      userClient.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      userClient.from("recent_destinations").select("*").order("used_at", { ascending: false }),
      userClient.from("dependents").select("*").order("created_at", { ascending: true }),
      userClient.from("bookings").select("*").order("created_at", { ascending: false }),
      userClient.from("shipments").select("*").order("created_at", { ascending: false }),
      userClient.from("dependent_shipments").select("*").order("created_at", { ascending: false }),
      userClient.from("notification_preferences").select("*"),
      userClient.from("excursion_requests").select("*, excursion_passengers(*)").order("created_at", { ascending: false }),
    ]);

    const exported_at = new Date().toISOString();
    const payload: ExportPayload = {
      auth: { email: user.email ?? undefined, phone: user.phone ?? undefined },
      profile: profile ?? null,
      recent_destinations: recent_destinations ?? [],
      dependents: dependents ?? [],
      bookings: bookings ?? [],
      shipments: shipments ?? [],
      dependent_shipments: dependent_shipments ?? [],
      notification_preferences: notification_preferences ?? [],
      excursion_requests: excursion_requests ?? [],
      exported_at,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const pdfBytes = await createPdf(payload);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Take Me <onboarding@resend.dev>";
    if (!resendKey) {
      console.error("[request-data-export] RESEND_API_KEY não definida");
      return new Response(
        JSON.stringify({ error: "Configuração de e-mail indisponível" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jsonBase64 = btoa(String.fromCharCode(...new TextEncoder().encode(jsonString)));
    let pdfBinary = "";
    for (let i = 0; i < pdfBytes.length; i++) pdfBinary += String.fromCharCode(pdfBytes[i]);
    const pdfBase64 = btoa(pdfBinary);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Cópia dos seus dados — Take Me",
        text: "Segue em anexo a cópia dos seus dados: um arquivo JSON e um PDF para leitura. Se não solicitou, ignore este e-mail.",
        attachments: [
          { filename: "meus-dados-takeme.json", content: jsonBase64, content_type: "application/json" },
          { filename: "meus-dados-takeme.pdf", content: pdfBase64, content_type: "application/pdf" },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[request-data-export] Resend error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "Não foi possível enviar o e-mail. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await admin.from("data_export_requests").upsert(
      { user_id: user.id, last_sent_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[request-data-export]", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
