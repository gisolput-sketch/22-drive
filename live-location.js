(() => {
  'use strict';
  const SUPABASE_URL = 'https://mqvumerrkyddootxeziv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Mrx_6uvptQIuy5YiJxVJ6w_h-iZ6Qmf';
  const WATCH_OPTIONS = { enableHighAccuracy:true, maximumAge:3000, timeout:15000 };
  const UPDATE_MIN_MS = 3500;
  const UPDATE_MIN_METERS = 12;
  let shareWatchId = null;
  let sharingRideId = null;
  let lastSentAt = 0;
  let lastSentPosition = null;
  let passengerTrackingMap = null;
  let passengerTrackingMarker = null;
  let trackingChannel = null;

  const $ = id => document.getElementById(id);
  const isDriver = /\/motorista\.html$/i.test(location.pathname);
  const isPassenger = /\/index\.html$|\/$/i.test(location.pathname) && !isDriver;
  const isTrackingPage = /\/acompanhar\.html$/i.test(location.pathname);

  async function updateReservation(id, patch) {
    if (!id) return false;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reservas?id=eq.${encodeURIComponent(id)}`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Prefer':'return=minimal'},
      body:JSON.stringify(patch)
    });
    if (!res.ok) { console.warn('22 DRIVE localização: atualização recusada', res.status, await res.text()); return false; }
    return true;
  }
  function haversine(a,b){
    if(!a||!b)return Infinity; const R=6371000,rad=Math.PI/180;
    const dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad;
    const x=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
  }
  function getRide(id){try{if(typeof window.requests==='function')return window.requests().find(r=>String(r.id)===String(id));}catch(_){}return null;}
  function getTrackingUrl(r){const token=r&&(r.public_token||r.publicToken);return token?new URL('./acompanhar.html?token='+encodeURIComponent(token),location.href).href:'';}
  function openWhatsAppTracking(r){
    const phone=String(r?.passengerPhone||r?.passenger_phone||r?.telefone||r?.whatsapp||'').replace(/\D/g,'');
    const tokenUrl=getTrackingUrl(r); if(!phone||!tokenUrl)return false;
    const n=phone.startsWith('55')?phone:'55'+phone,NL='\n';
    const msg=['🚗 22 DRIVE','','Olá, '+(r.passengerName||r.passenger_name||r.nome||'passageiro')+'! 😊','','🚦 Iniciei a rota até o seu embarque.','📍 A partir de agora você pode acompanhar minha localização em tempo real pelo mapa:',tokenUrl,'','A localização será atualizada enquanto eu estiver em rota. 🚗💨'].join(NL);
    try{window.open('https://wa.me/'+n+'?text='+encodeURIComponent(msg),'_blank');return true;}catch(_){return false;}
  }
  async function stopSharing(clear=true){
    if(shareWatchId!==null&&navigator.geolocation){try{navigator.geolocation.clearWatch(shareWatchId);}catch(_) {}}
    shareWatchId=null;const id=sharingRideId;sharingRideId=null;lastSentAt=0;lastSentPosition=null;
    if(clear&&id)await updateReservation(id,{driver_lat:null,driver_lng:null,driver_location_at:null});
  }
  async function publishPosition(id,pos,force=false){
    const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const point=[lat,lng],now=Date.now();
    if(!force&&now-lastSentAt<UPDATE_MIN_MS&&haversine(point,lastSentPosition)<UPDATE_MIN_METERS)return;
    lastSentAt=now;lastSentPosition=point;
    await updateReservation(id,{driver_lat:lat,driver_lng:lng,driver_location_at:new Date().toISOString()});
    try{if(typeof window.showDriverCurrentLocation==='function')window.showDriverCurrentLocation(lat,lng,false);if(typeof window.followDriverOnMap==='function')window.followDriverOnMap(pos);}catch(_){}
  }
  function startSharing(id,sendWhatsApp=true){
    const ride=getRide(id);if(!ride||!navigator.geolocation)return;
    if(sharingRideId===String(id)&&shareWatchId!==null)return;
    stopSharing(false);sharingRideId=String(id);
    navigator.geolocation.getCurrentPosition(pos=>publishPosition(id,pos,true),()=>{},WATCH_OPTIONS);
    shareWatchId=navigator.geolocation.watchPosition(pos=>publishPosition(id,pos,false),err=>console.warn('22 DRIVE GPS compartilhado:',err),WATCH_OPTIONS);
    try{sessionStorage.setItem('22drive_tracking_started_'+id,'1');}catch(_){}
    if(sendWhatsApp){try{const key='22drive_tracking_whatsapp_'+id;if(!sessionStorage.getItem(key)){const opened=openWhatsAppTracking(ride);if(opened)sessionStorage.setItem(key,'1');}}catch(_){openWhatsAppTracking(ride);}}
  }
  function ensureDriverWrappers(){
    if(!isDriver)return;
    const wrap=(name,handler)=>{const original=window[name];if(typeof original!=='function'||original.__liveWrapped)return false;const fn=function(...args){const result=original.apply(this,args);try{handler(args,result);}catch(e){console.warn('22 DRIVE live wrapper',name,e);}return result;};fn.__liveWrapped=true;window[name]=fn;return true;};
    wrap('startRideRoute',(args)=>startSharing(args[0],true));
    wrap('markDriverArrived',async(args)=>{const id=args[0];if(sharingRideId!==String(id))await updateReservation(id,{driver_lat:null,driver_lng:null,driver_location_at:null});});
    wrap('finishRide',(args)=>stopSharing(true));
    wrap('autoFinishAtDestination',(args)=>{const ride=args[0];if(ride&&ride.id!=null)stopSharing(true);});
    wrap('logout',()=>stopSharing(true));
  }
  function buildPassengerTrackingCard(){
    if(!isPassenger||$('liveTrackingCard'))return;const statusCard=$('tripStatusCard');if(!statusCard)return;
    const card=document.createElement('section');card.className='card';card.id='liveTrackingCard';card.style.display='none';
    card.innerHTML='<h2>🚗 Acompanhar motorista</h2><div id="liveTrackingStatus" class="notice">Aguardando o motorista iniciar a rota.</div><button id="liveTrackingCenter" class="btn primary" type="button" style="margin-top:9px;display:none">📍 Ver motorista no mapa</button>';
    statusCard.insertAdjacentElement('afterend',card);
    $('liveTrackingCenter').addEventListener('click',()=>{if(passengerTrackingMarker&&passengerTrackingMap)passengerTrackingMap.setView(passengerTrackingMarker.getLatLng(),16,{animate:true});else if(window.focusPassengerLocation)window.focusPassengerLocation();});
  }
  function updatePassengerTracking(r){
    if(!isPassenger||!r)return;buildPassengerTrackingCard();const card=$('liveTrackingCard'),status=$('liveTrackingStatus'),center=$('liveTrackingCenter');
    const lat=Number(r.driver_lat),lng=Number(r.driver_lng),sharing=Number.isFinite(lat)&&Number.isFinite(lng)&&String(r.status||'').toLowerCase()!=='finished';
    if(!card||!status)return;card.style.display=(r.status==='accepted'||r.status==='confirmed'||sharing)?'block':'none';
    if(!sharing){status.textContent='⏳ O motorista ainda não iniciou a rota. Assim que ele tocar em “Iniciar percurso”, a localização aparecerá aqui.';if(center)center.style.display='none';return;}
    status.innerHTML='🟢 <b>Motorista em rota</b><br>📍 A localização está sendo atualizada em tempo real.';if(center)center.style.display='block';
    if(typeof window.updatePassengerDriverMap==='function'){try{window.updatePassengerDriverMap(r);}catch(_) {}}
  }
  function watchPassengerReservation(){
    if(!isPassenger||!window.supabase)return;const id=localStorage.getItem('22drive_last_reservation_id');if(!id)return;
    const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    trackingChannel=sb.channel('22drive-live-location-'+id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'reservas',filter:'id=eq.'+id},payload=>updatePassengerTracking(payload.new)).subscribe();
    fetch(`${SUPABASE_URL}/rest/v1/reservas?id=eq.${encodeURIComponent(id)}&select=*`,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY},cache:'no-store'}).then(r=>r.json()).then(rows=>{if(rows&&rows[0])updatePassengerTracking(rows[0]);}).catch(()=>{});
  }
  function initTrackingPage(){
    if(!isTrackingPage)return;const token=new URLSearchParams(location.search).get('token');if(!token)return showTrackingError('Link de acompanhamento inválido.');
    if(!window.supabase||!window.L)return setTimeout(initTrackingPage,300);const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY),map=L.map($('trackingMap'),{zoomControl:true}).setView([-22.73,-42.63],13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);passengerTrackingMap=map;
    const update=r=>{const lat=Number(r?.driver_lat),lng=Number(r?.driver_lng),active=Number.isFinite(lat)&&Number.isFinite(lng)&&String(r?.status||'')!=='finished';$('trackingStatus').textContent=active?'🟢 Motorista em rota — localização atualizada em tempo real.':'⏳ O motorista ainda não iniciou a rota.';if(!active)return;const p=[lat,lng];if(passengerTrackingMarker)passengerTrackingMarker.setLatLng(p);else passengerTrackingMarker=L.marker(p,{icon:L.divIcon({className:'live-driver-marker',html:'<span>🚗</span>',iconSize:[50,50],iconAnchor:[25,25]}),zIndexOffset:1000}).addTo(map);map.setView(p,16,{animate:true});$('trackingUpdated').textContent='Última atualização: '+(r.driver_location_at?new Date(r.driver_location_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'agora');};
    fetch(`${SUPABASE_URL}/rest/v1/reservas?public_token=eq.${encodeURIComponent(token)}&select=id,status,passenger_name,origin,destination,driver_name,driver_lat,driver_lng,driver_location_at,driver_arrived_at&limit=1`,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY},cache:'no-store'}).then(r=>r.json()).then(rows=>{if(!rows||!rows[0])throw new Error('notfound');$('trackingPassenger').textContent=rows[0].passenger_name||'Passageiro';$('trackingRoute').textContent=(rows[0].origin||'')+' → '+(rows[0].destination||'');update(rows[0]);sb.channel('22drive-public-track-'+token).on('postgres_changes',{event:'UPDATE',schema:'public',table:'reservas',filter:'public_token=eq.'+token},payload=>update(payload.new)).subscribe();}).catch(()=>showTrackingError('Não foi possível localizar esta viagem. Verifique se o link ainda é válido.'));
  }
  function showTrackingError(msg){const el=$('trackingStatus');if(el)el.textContent='❌ '+msg;}
  function boot(){
    if(isDriver){const timer=setInterval(()=>{if(typeof window.startRideRoute==='function'){clearInterval(timer);ensureDriverWrappers();}},100);setTimeout(()=>clearInterval(timer),15000);}
    if(isPassenger){buildPassengerTrackingCard();const timer=setInterval(()=>{if(typeof window.showTripStatus==='function'){clearInterval(timer);const original=window.showTripStatus;if(!original.__liveWrapped){const wrapped=function(r){const result=original.apply(this,arguments);try{updatePassengerTracking(r);}catch(_){}return result;};wrapped.__liveWrapped=true;window.showTripStatus=wrapped;}watchPassengerReservation();}},100);setTimeout(()=>clearInterval(timer),15000);}
    if(isTrackingPage)initTrackingPage();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
