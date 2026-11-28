import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || window.codaInstalled === true;
export default function PWAInstallBanner() {
  const [installed, setInstalled] = useState(standalone);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(standalone());
    window.addEventListener('appinstalled', update);
    media.addEventListener?.('change', update);
    update();
    return () => { window.removeEventListener('appinstalled', update); media.removeEventListener?.('change', update); };
  }, []);
  async function install() {
    const prompt = window.codaInstallPrompt;
    if (!prompt) { setGuide(true); return; }
    window.codaInstallPrompt = null;
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { setGuide(true); }
  }
  if (installed) return null;
  return <>
    <button type="button" onClick={install} className="fixed bottom-24 right-4 z-[100] flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg" aria-label="CODA 앱 설치"><Download size={16}/> 앱 설치</button>
    {guide && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={() => setGuide(false)}>
      <section role="dialog" aria-modal="true" aria-label="CODA 설치 방법" className="w-full max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">CODA 앱 설치 방법</h2><button type="button" aria-label="닫기" onClick={() => setGuide(false)}><X/></button></div>
        <div className="space-y-3 text-sm"><p><strong>Windows / Mac Chrome:</strong> 주소창의 설치 아이콘 또는 메뉴에서 페이지를 앱으로 설치하세요.</p><p><strong>Microsoft Edge:</strong> 메뉴 → 앱 → 이 사이트를 앱으로 설치.</p><p><strong>Mac Safari:</strong> 파일 → Dock에 추가 (지원 버전).</p><p><strong>Android:</strong> Chrome 메뉴 → 홈 화면에 추가 또는 앱 설치.</p><p><strong>iPhone / iPad:</strong> Safari 공유 → 홈 화면에 추가.</p><p className="text-gray-500">메뉴 이름은 브라우저 버전에 따라 다를 수 있습니다. 학습 및 저장에는 인터넷 연결이 필요합니다.</p></div>
        <button type="button" onClick={() => setGuide(false)} className="mt-5 w-full rounded-lg bg-violet-600 py-2 text-white">확인</button>
      </section>
    </div>}
  </>;
}
