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
import { sendPushNotification, WebPushError } from "npm:@mmmike/web-push@1.0.1/send";

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

    const subscriptionsResponse = await fetch(
      SUPABASE_URL +
        "/rest/v1/push_subscriptions?select=endpoint,p256dh,auth",
      {
        headers: {
          apikey: SERVICE_ROLE_KEY
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

    const sent: string[] = [];
    const failed: Array<{statusCode: number; message: string}> = [];
    const expired: string[] = [];

    for (const subscription of subscriptions) {
      try {
        const delivered = await sendPushNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          {
            title: "🚨 Nova viagem — 22 DRIVE",
            body:
              passengerName +
              " solicitou uma nova viagem. Toque para abrir o painel.",
            url: "./motorista.html",
            tag: "22drive-new-ride"
          },
          {
            subject: VAPID_SUBJECT,
            publicKey: VAPID_PUBLIC_KEY,
            privateKey: VAPID_PRIVATE_KEY
          },
          {
            ttl: 86400,
            urgency: "high"
          }
        );

        if (delivered) {
          sent.push(subscription.endpoint);
        } else {
          expired.push(subscription.endpoint);
        }
      } catch (error) {
        const statusCode =
          error instanceof WebPushError
            ? error.statusCode
            : Number((error as any)?.statusCode ?? 0);

        if (statusCode === 404 || statusCode === 410) {
          expired.push(subscription.endpoint);
        } else {
          failed.push({
            statusCode,
            message:
              error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    for (const endpoint of expired) {
      await fetch(
        SUPABASE_URL +
          "/rest/v1/push_subscriptions?endpoint=eq." +
          encodeURIComponent(endpoint),
        {
          method: "DELETE",
          headers: {
            apikey: SERVICE_ROLE_KEY
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
