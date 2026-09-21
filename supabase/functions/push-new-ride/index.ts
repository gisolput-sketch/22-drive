// 22 DRIVE — Edge Function para notificação de nova reserva
// Esta função é a camada de servidor. Nunca coloque service-role keys
// ou segredos do provedor de push no GitHub.
//
// O webhook do Supabase deve chamar esta função quando public.reservas
// receber INSERT. A implementação do provedor de push depende das
// credenciais Web Push/FCM escolhidas para o PWA.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload.record ?? payload;

    console.log("22 DRIVE — nova reserva:", {
      id: record.id,
      passenger_name: record.passenger_name,
      travel_date: record.travel_date,
      travel_time: record.travel_time,
    });

    // TODO: enviar Web Push/FCM para os dispositivos do motorista.
    // As credenciais devem ficar nos Secrets da Edge Function.
    // O service worker já possui o listener de 'push'.

    return new Response(
      JSON.stringify({ ok: true, reservation_id: record.id }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
