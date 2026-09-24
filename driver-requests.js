(() => {
  'use strict';
  if (!/\/motorista\.html$/i.test(location.pathname)) return;
  if (window.__22DriveRequestsOverlay) return;
  window.__22DriveRequestsOverlay = true;

  const SUPABASE_URL = 'https://mqvumerrkyddootxeziv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Mrx_6uvptQIuy5YiJxVJ6w_h-iZ6Qmf';
  const POLL_MS = 1200;
  let lastIds = new Set();
  let busy = new Set();

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const money = v => Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const val = (r,...keys) => { for(const k of keys){ if(r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return r[k]; } return ''; };

  function driver(){ try{return JSON.parse(localStorage.getItem('22drive_driver')||'null')||{};}catch(_){return {};} }

  function ensureStyle(){
    if(document.getElementById('22drive-request-overlay-style')) return;
    const s=document.createElement('style'); s.id='22drive-request-overlay-style';
    s.textContent=`
      #22drive-live-requests{position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-height:calc(100dvh - 100px);overflow:auto;padding-bottom:2px;pointer-events:none}
      .dreq-card{pointer-events:auto;background:#050b14;color:#fff;border:2px solid #ffc700;border-radius:18px;padding:14px;box-shadow:0 10px 35px #000c,0 0 20px #ffc70028;font-family:Inter,Roboto,Arial,sans-serif}
      .dreq-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.dreq-badge{background:#ffc700;color:#111;padding:6px 9px;border-radius:999px;font-size:12px;font-weight:900}.dreq-price{font-size:24px;font-weight:900;color:#ffc700}
      .dreq-passenger{margin:8px 0;font-size:15px;font-weight:800}.dreq-row{display:flex;gap:8px;margin:8px 0;font-size:13px;line-height:1.35}.dreq-label{color:#8e8e93;min-width:72px}.dreq-value{font-weight:700;word-break:break-word}.dreq-actions{display:flex;gap:9px;margin-top:12px}.dreq-btn{flex:1;border:0;border-radius:12px;padding:13px 10px;font-size:15px;font-weight:900;cursor:pointer}.dreq-accept{background:#00c853;color:#fff}.dreq-reject{background:#ff3b30;color:#fff}.dreq-btn:disabled{opacity:.55;cursor:wait}
      @media(min-width:700px){#22drive-live-requests{left:auto;width:min(460px,calc(100vw - 20px));right:15px;bottom:15px}}
    `; document.head.appendChild(s);
  }

  function root(){let el=document.getElementById('22drive-live-requests');if(!el){el=document.createElement('div');el.id='22drive-live-requests';document.body.appendChild(el);}return el;}

  async function fetchNew(){
    try{
      const res=await fetch(SUPABASE_URL+'/rest/v1/reservas?select=*&status=eq.new&order=created_at.asc&limit=50',{cache:'no-store',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}});
      if(!res.ok) return;
      const rows=await res.json();
      const current=new Set(rows.map(r=>String(r.id)));
      for(const id of lastIds){if(!current.has(id)){const old=document.querySelector('[data-ride-id="'+CSS.escape(id)+'"]');if(old)old.remove();}}
      rows.forEach(renderCard);
      lastIds=current;
    }catch(e){console.warn('22 DRIVE solicitações:',e);}
  }

  function renderCard(r){
    const id=String(r.id); let card=document.querySelector('[data-ride-id="'+CSS.escape(id)+'"]');
    if(!card){card=document.createElement('div');card.className='dreq-card';card.dataset.rideId=id;root().appendChild(card);}
    const name=val(r,'passenger_name','nome')||'Passageiro';
    const phone=val(r,'passenger_phone','whatsapp');
    const origin=val(r,'origin','embarque')||'Não informado';
    const destination=val(r,'destination','destino')||'Não informado';
    const price=val(r,'total_value','trip_value','valor');
    const date=val(r,'travel_date','data_ida'); const time=val(r,'travel_time','hora_ida');
    card.innerHTML=`<div class="dreq-head"><span class="dreq-badge">🚨 NOVA SOLICITAÇÃO</span><span class="dreq-price">${money(price)}</span></div>
      <div class="dreq-passenger">👤 ${esc(name)}${phone?` • ${esc(phone)}`:''}</div>
      <div class="dreq-row"><span class="dreq-label">📍 Embarque</span><span class="dreq-value">${esc(origin)}</span></div>
      <div class="dreq-row"><span class="dreq-label">🏁 Destino</span><span class="dreq-value">${esc(destination)}</span></div>
      ${date||time?`<div class="dreq-row"><span class="dreq-label">🗓️ Horário</span><span class="dreq-value">${esc(date)} ${esc(time)}</span></div>`:''}
      <div class="dreq-actions"><button class="dreq-btn dreq-reject" data-action="reject">Recusar</button><button class="dreq-btn dreq-accept" data-action="accept">Aceitar corrida</button></div>`;
    card.querySelector('[data-action="accept"]').onclick=()=>changeStatus(r,'accepted');
    card.querySelector('[data-action="reject"]').onclick=()=>changeStatus(r,'cancelled');
  }

  async function changeStatus(r,status){
    const id=String(r.id); if(busy.has(id))return; busy.add(id);
    const card=document.querySelector('[data-ride-id="'+CSS.escape(id)+'"]');
    if(card)card.querySelectorAll('button').forEach(b=>b.disabled=true);
    const d=driver();
    const patch=status==='accepted'?{status:'accepted',driver_name:d.name||'Motorista',driver_phone:d.phone||'',accepted_at:new Date().toISOString()}:{status:'cancelled',cancelled_at:new Date().toISOString(),cancelled_by:'driver'};
    try{
      const res=await fetch(SUPABASE_URL+'/rest/v1/reservas?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Prefer:'return=minimal'},body:JSON.stringify(patch)});
      if(!res.ok)throw new Error(await res.text());
      if(card)card.remove();
      lastIds.delete(id);
      if(status==='accepted' && typeof window.render==='function')setTimeout(()=>{try{window.render();}catch(_){ }},100);
    }catch(e){
      console.error('22 DRIVE status:',e);
      if(card){const b=card.querySelector('.dreq-actions');if(b)b.insertAdjacentHTML('beforebegin','<div style="color:#ff6b6b;font-weight:800;margin-top:8px">Não foi possível atualizar a corrida. Tente novamente.</div>');card.querySelectorAll('button').forEach(x=>x.disabled=false);}
    }finally{busy.delete(id);}
  }

  function start(){ensureStyle();root();fetchNew();setInterval(fetchNew,POLL_MS);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
