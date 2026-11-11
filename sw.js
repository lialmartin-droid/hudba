const CACHE='moje-hudba-shell-v1.1';
const SHELL=['./','./index.html','./css/style.css','./js/app.js','./js/store.js','./js/tags.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin) return;
  // Never cache media files; audio offline blobs are managed explicitly in IndexedDB.
  if(/\.(mp3|m4a|mp4|flac|ogg|wav|aac|opus)$/i.test(u.pathname))return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',c));return r;}).catch(()=>caches.match('./index.html')));return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});
