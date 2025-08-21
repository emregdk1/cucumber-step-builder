self.addEventListener('install', e=>{self.skipWaiting();});
self.addEventListener('activate', e=>{clients.claim();});
const CACHE='csb-v1';
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  e.respondWith((async()=>{
    try { const net= await fetch(e.request); const cache=await caches.open(CACHE); cache.put(e.request, net.clone()); return net; } catch(err) {
      const cached = await caches.match(e.request); if(cached) return cached; throw err; }
  })());
});
