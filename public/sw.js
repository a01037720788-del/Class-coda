// Dev 모드 감지: localhost 또는 127.0.0.1에서는 SW가 캐시하지 않고 즉시 언등록
const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

if (isDev) {
  // Dev 모드: 모든 캐시 비우고 즉시 언등록. fetch 이벤트 처리 안 함 (네트워크 전용).
  // stale 캐시 청크로 인한 React 중복 로드 → hooks(null) 에러 방지.
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => {
    e.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
  });
  // fetch 이벤트 리스너 없음 — 모든 요청이 네트워크로 직행
} else {
  const CACHE = 'coda-v3';
  const PRECACHE = ['/', '/index.html'];

  self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
    self.skipWaiting();
  });

  self.addEventListener('activate', (e) => {
    e.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ).then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // GET 요청만 처리
    if (e.request.method !== 'GET') return;
    // 외부 API / base44 → 네트워크 전용
    if (url.hostname !== self.location.hostname) return;
    // 내부 API → 네트워크 전용
    if (url.pathname.startsWith('/api/')) return;

    // Vite dev 경로는 절대 캐시하지 않음 (stale 청크로 React 중복 로드 방지)
    const path = url.pathname;
    if (path.startsWith('/src/') || path.startsWith('/@vite') || path.startsWith('/@react-refresh') || path.includes('/node_modules/.vite/')) return;
    // Vite 캐시 버스팅 쿼리 (?v=, ?t=)가 있으면 캐시하지 않음
    if (url.searchParams.has('v') || url.searchParams.has('t')) return;

    // 페이지 이동 (HTML) → 네트워크 우선, 실패 시 index.html (SPA 지원)
    if (e.request.mode === 'navigate') {
      e.respondWith(
        fetch(e.request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
            return res;
          })
          .catch(() => caches.match('/index.html'))
      );
      return;
    }

    // 정적 에셋 → 캐시 우선, 백그라운드 업데이트
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fresh = fetch(e.request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  });
}
