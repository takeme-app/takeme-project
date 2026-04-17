// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { JWT } from "npm:google-auth-library@9";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_PROJECT_ID = Deno.env.get("GOOGLE_PROJECT_ID");
const GOOGLE_CLIENT_EMAIL = Deno.env.get("GOOGLE_CLIENT_EMAIL");
const GOOGLE_PRIVATE_KEY = (Deno.env.get("GOOGLE_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
/** Opcional: mesmo valor no header `x-webhook-secret` do Database Webhook. */
const NOTIFICATION_FCM_WEBHOOK_SECRET = Deno.env.get("NOTIFICATION_FCM_WEBHOOK_SECRET") || "";

function json(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getRecordFromBody(body: any): Record<string, unknown> | null {
  if (body && typeof body.record === "object" && body.record !== null) {
    return body.record as Record<string, unknown>;
  }
  if (body && typeof body === "object" && !body.type && !body.table) {
    return body as Record<string, unknown>;
  }
  return null;
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const jwtClient = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    jwtClient.authorize((err: unknown, tokens: { access_token?: string } | null | undefined) => {
      if (err) return reject(err);
      if (!tokens?.access_token) return reject(new Error("No access_token"));
      resolve(tokens.access_token);
    });
  });
}

Deno.serve(async (req) => {
  const error_id = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    if (NOTIFICATION_FCM_WEBHOOK_SECRET) {
      const sent = req.headers.get("x-webhook-secret") ?? "";
      if (sent !== NOTIFICATION_FCM_WEBHOOK_SECRET) {
        return json(401, { error: "Unauthorized", error_id });
      }
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase envs", error_id });
    }
    if (!GOOGLE_PROJECT_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return json(500, { error: "Missing Google FCM envs", error_id });
    }

    let payload: any = null;
    try {
      payload = await req.json();
    } catch {
      return json(204, { ok: true, info: "No JSON body", error_id });
    }

    if (payload?.table && payload.table !== "notifications") {
      return json(204, { ok: true, info: "Ignored: other table", error_id });
    }

    const record = getRecordFromBody(payload);
    if (!record) {
      return json(204, { ok: true, info: "No record", error_id });
    }

    const userId = record.user_id as string | undefined;
    if (!userId) {
      return json(400, { error: "No user_id on notification record", error_id });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokenRows, error: tokErr } = await supabase
      .from("profile_fcm_tokens")
      .select("fcm_token")
      .eq("profile_id", userId)
      .eq("app_slug", "cliente");

    if (tokErr) {
      return json(500, { error: `Tokens query: ${tokErr.message}`, error_id });
    }

    const tokens = (tokenRows ?? [])
      .map((r: { fcm_token: string }) => r.fcm_token)
      .filter(Boolean);
    if (tokens.length === 0) {
      return json(204, { ok: true, info: "No FCM tokens for profile", error_id });
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY);
    } catch (e: unknown) {
      return json(500, {
        error: "FCM token error",
        detail: String(e instanceof Error ? e.message : e),
        error_id,
      });
    }

    const title = String(record.title ?? "Nova notificação");
    const bodyText = record.message != null ? String(record.message) : "";
    const customData: Record<string, string> = {
      notification_id: String(record.id ?? ""),
      category: String(record.category ?? ""),
      read_at: record.read_at != null ? String(record.read_at) : "",
      created_at: String(record.created_at ?? ""),
    };

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${GOOGLE_PROJECT_ID}/messages:send`;
    const results: unknown[] = [];

    for (const token of tokens) {
      const messagePayload = {
        message: {
          token,
          notification: { title, body: bodyText },
          data: customData,
          android: { notification: { sound: "default" } },
        },
      };

      const r = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(messagePayload),
      });
      const resText = await r.text();
      let resJson: unknown = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        resJson = resText;
      }
      if (!r.ok) {
        results.push({ token: token.slice(0, 12) + "...", error: resJson });
      } else {
        results.push({ token: token.slice(0, 12) + "...", ok: true });
      }
    }

    const anyFail = results.some((x: any) => x && x.error);
    return json(anyFail ? 502 : 200, {
      ok: !anyFail,
      sent: tokens.length,
      results,
      error_id,
    });
  } catch (e: unknown) {
    console.error("dispatch-notification-fcm", e, error_id);
    return json(500, { error: "Internal Error", error_id });
  }
});
