// 22 DRIVE — Edge Function de Web Push
//
// Recebe uma nova reserva enviada pelo gatilho do banco,
// consulta as assinaturas do motorista e envia a notificação Web Push.
//
// Secrets esperados no Supabase:
// - VAPID_PUBLIC_KEY
// - VAPID_PRIVATE_KEY
// - VAPID_SUBJECT
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos pelo ambiente
// da Edge Function. Nunca coloque a chave privada VAPID ou uma service key
// diretamente neste arquivo.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
let SERVICE_ROLE_KEY = "";
try {
  const secretKeys = JSON.parse(secretKeysRaw);
  SERVICE_ROLE_KEY = secretKeys.default ?? "";
} catch (_) {
  SERVICE_ROLE_KEY = "";
}
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "BPv-5ZgA0eonKTtctG8P2Zj1sQKZaqKDvgmzPb3oC9ilScCllIpERnY_SPsmieYZgWEV2nhzqqAo8Og_YEnva8M";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:22drive@example.com";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function getRecord(payload: any) {
  return payload?.record ?? payload ?? {};
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL não está disponível.");
    }

    if (!SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY não está disponível no ambiente da Edge Function."
      );
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("As chaves VAPID não estão configuradas.");
    }

    const payload = await req.json();
    const record = getRecord(payload);

    if (!record?.id) {
      throw new Error("Reserva sem id.");
    }

    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const subscriptionsResponse = await fetch(
      SUPABASE_URL +
        "/rest/v1/push_subscriptions?select=endpoint,p256dh,auth",
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: "Bearer " + SERVICE_ROLE_KEY
        }
      }
    );

    if (!subscriptionsResponse.ok) {
      throw new Error(
        "Falha ao consultar assinaturas: " +
          (await subscriptionsResponse.text())
      );
    }

    const subscriptions = await subscriptionsResponse.json();

    const passengerName =
      record.passenger_name ??
      record.nome ??
      "Passageiro";

    const notificationBody = JSON.stringify({
      title: "🚨 Nova viagem — 22 DRIVE",
      body:
        passengerName +
        " solicitou uma nova viagem. Toque para abrir o painel.",
      icon: "./icon-192.svg",
      badge: "./icon-192.svg",
      tag: "22drive-new-ride",
      url: "./motorista.html"
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription: any) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          notificationBody
        )
      )
    );

    const sent = results.filter(
      (result) => result.status === "fulfilled"
    ).length;

    const failed = results.filter(
      (result) => result.status === "rejected"
    ).length;

    const expired = subscriptions.filter(
      (_subscription: any, index: number) => {
        const result = results[index];

        return (
          result.status === "rejected" &&
          [404, 410].includes(
            Number((result.reason as any)?.statusCode ?? 0)
          )
        );
      }
    );

    for (const subscription of expired) {
      await fetch(
        SUPABASE_URL +
          "/rest/v1/push_subscriptions?endpoint=eq." +
          encodeURIComponent(subscription.endpoint),
        {
          method: "DELETE",
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: "Bearer " + SERVICE_ROLE_KEY
          }
        }
      );
    }

    return jsonResponse({
      ok: true,
      reservation_id: record.id,
      subscriptions: subscriptions.length,
      sent,
      failed,
      expired: expired.length
    });
  } catch (error) {
    console.error("22 DRIVE push-new-ride:", error);

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      400
    );
  }
});
