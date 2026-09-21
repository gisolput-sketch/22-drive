// 22 DRIVE — envio real de Web Push para o motorista
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:22drive@example.com";

webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);

serve(async (req)=>{
  if(req.method!=="POST") return new Response("Method Not Allowed",{status:405});
  try{
    const payload=await req.json();
    const record=payload.record??payload;
    if(!record?.id) throw new Error("Reserva sem id.");

    const response=await fetch(
      SUPABASE_URL+"/rest/v1/push_subscriptions?select=endpoint,p256dh,auth",
      {headers:{apikey:SERVICE_ROLE_KEY,Authorization:"Bearer "+SERVICE_ROLE_KEY}}
    );
    if(!response.ok) throw new Error("Falha ao consultar assinaturas: "+await response.text());
    const subscriptions=await response.json();

    const body=JSON.stringify({
      title:"🚨 Nova viagem — 22 DRIVE",
      body:(record.passenger_name||"Passageiro")+" solicitou uma nova viagem. Toque para abrir o painel.",
      icon:"./icon-192.svg",
      badge:"./icon-192.svg",
      tag:"22drive-new-ride",
      url:"./motorista.html"
    });

    const results=await Promise.allSettled(subscriptions.map((s:any)=>
      webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},body)
    ));

    const expired=subscriptions.filter((_:any,i:number)=>{
      const r=results[i];
      return r.status==="rejected" && [404,410].includes((r.reason as any)?.statusCode);
    });
    for(const s of expired){
      await fetch(SUPABASE_URL+"/rest/v1/push_subscriptions?endpoint=eq."+encodeURIComponent(s.endpoint),{
        method:"DELETE",headers:{apikey:SERVICE_ROLE_KEY,Authorization:"Bearer "+SERVICE_ROLE_KEY}
      });
    }

    return Response.json({ok:true,reservation_id:record.id,sent:results.filter(r=>r.status==="fulfilled").length,expired:expired.length});
  }catch(error){
    console.error(error);
    return Response.json({ok:false,error:String(error)},{status:400});
  }
});