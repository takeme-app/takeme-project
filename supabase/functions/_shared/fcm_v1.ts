// deno-lint-ignore-file no-explicit-any
import { JWT } from "npm:google-auth-library@9";

export async function getFcmAccessToken(
  clientEmail: string,
  privateKey: string,
): Promise<string> {
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

export type FcmV1SendInput = {
  token: string;
  title: string;
  body: string;
  /** Canal Android já criado no app (Notifee). */
  androidChannelId: string;
  /** Mesmo valor entre disparos substitui a notificação no Android (NotificationManager tag). */
  androidNotificationTag?: string;
  collapseKey?: string;
  /** Valores string-only conforme FCM data (concat extras aqui). */
  data?: Record<string, string>;
  /** Omitir payload `notification`: só `data` + priority (foreground/app desenha via Notifee). */
  dataOnly?: boolean;
};

/** POST messages:send JSON para um único token; não insere em public.notifications. */
export async function sendFcmV1Message(
  projectId: string,
  accessToken: string,
  input: FcmV1SendInput,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const data: Record<string, string> = { ...(input.data ?? {}) };
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k];
  }

  const message: Record<string, unknown> = {
    token: input.token,
    data,
    android: {
      priority: "HIGH",
    },
  };

  if (input.dataOnly) {
    if (!data.trip_eta_live) data.trip_eta_live = "1";
    (message.android as Record<string, unknown>).collapse_key = input.collapseKey ??
      input.androidNotificationTag ?? "trip_eta";
  } else {
    message.notification = {
      title: input.title,
      body: input.body,
    };
    (message.android as Record<string, unknown>).notification = {
      sound: "default",
      channel_id: input.androidChannelId,
      ...(input.androidNotificationTag ? { tag: input.androidNotificationTag } : {}),
    };
    if (input.collapseKey) {
      (message.android as Record<string, unknown>).collapse_key = input.collapseKey;
    }
  }

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  });
  const resText = await r.text();
  let resJson: unknown = resText;
  try {
    resJson = JSON.parse(resText);
  } catch {
    /* manter texto */
  }
  return { ok: r.ok, status: r.status, body: resJson };
}
