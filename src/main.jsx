import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { appPath } from '@/lib/basePath'

// Service Worker 처리 + React 렌더링
// dev 모드에서 stale SW가 캐시한 청크로 인해 React 중복 로드 → hooks 에러 방지
async function initApp() {
  if ('serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const hasController = !!navigator.serviceWorker.controller;
        const hasCaches = window.caches && (await window.caches.keys()).length > 0;
        if (regs.length > 0 || hasController || hasCaches) {
          await Promise.all(regs.map((r) => r.unregister()));
          if (window.caches) {
            const keys = await window.caches.keys();
            await Promise.all(keys.map((k) => window.caches.delete(k)));
          }
          window.location.reload();
          return;
        }
      } catch (e) {
        // SW 사용 불가 — 렌더링 계속
      }
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(appPath('/sw.js')).catch(() => {});
      });
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}

initApp();