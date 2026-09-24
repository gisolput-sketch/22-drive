(() => {
  'use strict';

  const SUPABASE_URL = 'https://mqvumerrkyddootxeziv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Mrx_6uvptQIuy5YiJxVJ6w_h-iZ6Qmf';
  const VAPID_PUBLIC_KEY = 'BPv-5ZgA0eonKTtctG8P2Zj1sQKZaqKDvgmzPb3oC9ilScCllIpERnY_SPsmieYZgWEV2nhzqqAo8Og_YEnva8M';
  const DRIVER_KEY = '22drive_driver';

  if (!/\/motorista\.html$/i.test(location.pathname)) return;

  // Carrega o painel de novas solicitações diretamente, sem depender do Service Worker.
  // Isso garante que uma corrida apareça mesmo quando Push não estiver disponível.
  function loadLiveRequests() {
    if (document.querySelector('script[data-22drive-live-requests]')) return;
    const script = document.createElement('script');
    script.src = './driver-requests.js?v=20260924';
    script.async = false;
    script.dataset['22driveLiveRequests'] = '1';
    script.onload = () => console.log('22 DRIVE: painel de novas solicitações carregado diretamente.');
    script.onerror = () => console.warn('22 DRIVE: não foi possível carregar driver-requests.js');
    (document.head || document.documentElement).appendChild(script);
  }

  function base64ToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function getDriver() {
    try {
      return JSON.parse(localStorage.getItem(DRIVER_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  async function registerAutomatically() {
    const driver = getDriver();
    if (!driver) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const json = subscription.toJSON();
      const endpoint = json.endpoint || subscription.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) throw new Error('Assinatura Push incompleta.');

      const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          endpoint,
          p256dh,
          auth,
          driver_name: driver.name || 'Motorista',
          driver_phone: driver.phone || '',
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error(await response.text());

      const status = document.getElementById('notificationStatus');
      if (status) status.textContent = '✅ Dispositivo do motorista registrado para receber novas viagens.';
      console.log('22 DRIVE: dispositivo do motorista registrado no push_subscriptions.');
    } catch (error) {
      console.warn('22 DRIVE: cadastro automático do Push falhou:', error);
    }
  }

  function boot() {
    loadLiveRequests();
    setTimeout(loadLiveRequests, 1500);
    setTimeout(registerAutomatically, 1200);
    window.addEventListener('focus', loadLiveRequests);
    window.addEventListener('focus', registerAutomatically);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadLiveRequests();
        registerAutomatically();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
