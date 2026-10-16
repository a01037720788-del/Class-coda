import React, { useState, useEffect } from "react";
import { X, Download, Smartphone, Share } from "lucide-react";

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isAndroid = /android/i.test(navigator.userAgent);
const isInStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [iconUrl, setIconUrl] = useState(null);

  useEffect(() => {
    // Use canvas-generated icon if available
    const icon = sessionStorage.getItem("pwa-icon-192");
    if (icon) setIconUrl(icon);
  }, []);

  useEffect(() => {
    if (isInStandalone) return;
    if (localStorage.getItem("pwa-dismissed-v2")) return;

    if (isIOS) {
      const timer = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(timer);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-dismissed-v2", "1");
  };

  if (!show) return null;

  return (
    <>
      {/* 설치 배너 */}
      <div className="fixed bottom-20 left-3 right-3 z-[100] md:left-auto md:right-6 md:w-80 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex items-center gap-3">
          {/* App Icon */}
          <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden shadow-md">
            {iconUrl ? (
              <img src={iconUrl} alt="CODA" className="w-full h-full" />
            ) : (
              <div className="w-full h-full bg-[#7c3aed] flex items-center justify-center">
                <span className="text-white font-black text-lg">C</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">홈 화면에 추가</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              앱처럼 빠르게 접근할 수 있어요
            </p>
            <button
              onClick={handleInstall}
              className="mt-2 flex items-center gap-1.5 bg-[#7c3aed] text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-[#6d28d9] transition-colors"
            >
              {isIOS ? <Share className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              {isIOS ? "설치 방법 보기" : "홈 화면에 추가"}
            </button>
          </div>

          <button
            onClick={dismiss}
            className="p-1.5 hover:bg-gray-100 active:bg-gray-200 rounded-lg flex-shrink-0 self-start"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* iOS 설치 가이드 모달 */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 pb-8">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-base">iPhone/iPad 설치 방법</p>
              <button
                onClick={() => { setShowIOSGuide(false); dismiss(); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { step: "1", text: <>Safari 하단의 <strong className="text-[#7c3aed]">공유 버튼 (□↑)</strong>을 탭하세요</> },
                { step: "2", text: <>스크롤하여 <strong className="text-[#7c3aed]">"홈 화면에 추가"</strong>를 선택하세요</> },
                { step: "3", text: <>오른쪽 상단 <strong className="text-[#7c3aed]">"추가"</strong>를 탭하면 완료!</> },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="w-7 h-7 bg-[#7c3aed] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {step}
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setShowIOSGuide(false); dismiss(); }}
              className="mt-6 w-full bg-[#7c3aed] text-white py-3 rounded-xl font-semibold text-sm active:bg-[#6d28d9] transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}