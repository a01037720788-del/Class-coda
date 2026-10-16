import React, { useState, useEffect, useRef } from "react";
import CodeEditor from "./CodeEditor";
import MultiPreview from "./MultiPreview";
import { RefreshCw, Maximize2, Minimize2, ExternalLink } from "lucide-react";
import { storageKeys, storageSave, storageLoad } from "@/lib/storageService";

// ── 기본 코드 (파일 연결 구조 포함) ──
const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CODA HTML Practice</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <h1>Hello CODA</h1>

  <script src="script.js"></script>
</body>
</html>`;

const DEFAULT_CSS = `body {
  font-family: Arial, sans-serif;
  margin: 20px;
}

h1 {
  color: royalblue;
}`;

const DEFAULT_JS = `// JavaScript 코드를 여기에 작성하세요\n`;

// 파일 탭 정의
const TABS = [
  { key: "html", icon: "📄", filename: "index.html", language: "html", dot: "bg-orange-400", color: "text-orange-300" },
  { key: "css",  icon: "🎨", filename: "style.css",  language: "css",  dot: "bg-blue-400",   color: "text-blue-300"   },
  { key: "js",   icon: "⚡", filename: "script.js",  language: "js",   dot: "bg-yellow-400", color: "text-yellow-300" },
];

/**
 * HTML + CSS + JavaScript 3탭 에디터 + 미리보기
 * 실제 파일 구조처럼 동작: link/script 태그로 연결
 */
export default function TripleEditor({
  htmlValue,
  cssValue,
  jsValue,
  onHtmlChange,
  onCssChange,
  onJsChange,
  readOnly = false,
  defaultHtml,
  defaultCss,
  defaultJs,
  autoSaveKey = null,
  height = "540px",
  showPreview = true,
}) {
  const [activeTab, setActiveTab] = useState("html");
  const [savedAt, setSavedAt] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const autoSaveTimer = useRef(null);

  const resolvedDefaultHtml = defaultHtml !== undefined ? defaultHtml : DEFAULT_HTML;
  const resolvedDefaultCss  = defaultCss  !== undefined ? defaultCss  : DEFAULT_CSS;
  const resolvedDefaultJs   = defaultJs   !== undefined ? defaultJs   : DEFAULT_JS;

  const effectiveHtml = (htmlValue !== undefined ? htmlValue : "") || "";
  const effectiveCss  = (cssValue  !== undefined ? cssValue  : "") || "";
  const effectiveJs   = (jsValue   !== undefined ? jsValue   : "") || "";

  // 마운트 시 비어있으면 기본값 주입
  useEffect(() => {
    if (!readOnly) {
      if (!effectiveHtml && onHtmlChange) onHtmlChange(resolvedDefaultHtml);
      if (!effectiveCss  && onCssChange)  onCssChange(resolvedDefaultCss);
      if (!effectiveJs   && onJsChange)   onJsChange(resolvedDefaultJs);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 자동 저장
  const triggerAutoSave = () => {
    if (!autoSaveKey || readOnly) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      storageSave(storageKeys.tripleEditorSave(autoSaveKey), {
        html: effectiveHtml, css: effectiveCss, js: effectiveJs,
        updated_at: new Date().toISOString(),
      });
      setSavedAt(new Date());
    }, 5000);
  };

  useEffect(() => { triggerAutoSave(); }, [effectiveHtml, effectiveCss, effectiveJs]);

  useEffect(() => {
    if (!autoSaveKey || readOnly) return;
    const save = () => {
      storageSave(storageKeys.tripleEditorSave(autoSaveKey), {
        html: effectiveHtml, css: effectiveCss, js: effectiveJs,
      });
    };
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [effectiveHtml, effectiveCss, effectiveJs, autoSaveKey]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && fullscreen) setFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // 새 창으로 미리보기 열기 (파일 연결 방식 적용)
  const openNewWindow = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;

    const isFullDoc = /<!DOCTYPE|<html/i.test(effectiveHtml.trim());
    let content = effectiveHtml;

    if (isFullDoc) {
      // link 태그 → style 태그 치환
      content = content.replace(/<link([^>]*?)href=["']style\.css["']([^>]*?)>/gi,
        `<style>\n${effectiveCss}\n</style>`);
      // script src 태그 → script 블록 치환
      content = content.replace(/<script([^>]*?)src=["']script\.js["']([^>]*?)><\/script>/gi,
        `<script>\ntry{${effectiveJs}}catch(e){console.error(e);}\n<\/script>`);
    } else {
      content = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>body{margin:8px;font-family:sans-serif;}\n${effectiveCss}</style></head><body>${effectiveHtml}<script>try{${effectiveJs}}catch(e){console.error(e);}<\/script></body></html>`;
    }
    w.document.write(content);
    w.document.close();
  };

  const editorH = fullscreen ? "calc(100vh - 88px)" : height;
  const activeTabDef = TABS.find(t => t.key === activeTab);

  const editorSection = (
    <div className="flex flex-col h-full">
      {/* 파일 탭 헤더 */}
      <div className="flex items-center bg-gray-900 rounded-t-lg px-1 pt-1 gap-0.5 flex-shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === t.key
                ? "bg-[#1e1e2e] text-white border-t-2 border-orange-400"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`}>
            <span className="text-sm leading-none">{t.icon}</span>
            <span className={activeTab === t.key ? "text-white" : "text-gray-400"}>{t.filename}</span>
          </button>
        ))}
        {!readOnly && (
          <button
            onClick={() => {
              if (activeTab === "html") onHtmlChange && onHtmlChange(resolvedDefaultHtml);
              if (activeTab === "css")  onCssChange  && onCssChange(resolvedDefaultCss);
              if (activeTab === "js")   onJsChange   && onJsChange(resolvedDefaultJs);
            }}
            className="ml-auto mr-1 p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
            title="현재 파일 초기화">
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 에디터 본문 */}
      <div className="flex-1 min-h-0">
        {TABS.map(t => (
          <div key={t.key} style={{ display: activeTab === t.key ? "block" : "none", height: "100%" }}>
            <CodeEditor
              value={t.key === "html" ? effectiveHtml : t.key === "css" ? effectiveCss : effectiveJs}
              onChange={v => {
                if (t.key === "html") onHtmlChange && onHtmlChange(v);
                if (t.key === "css")  onCssChange  && onCssChange(v);
                if (t.key === "js")   onJsChange   && onJsChange(v);
              }}
              readOnly={readOnly}
              language={t.language}
              height={editorH}
              showCopy={false}
              filename={t.filename}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const previewSection = (
    <MultiPreview
      html={effectiveHtml}
      css={effectiveCss}
      js={effectiveJs}
      cssFilename="style.css"
      jsFilename="script.js"
      autoPreview
      height={editorH}
      onOpenNewWindow={openNewWindow}
    />
  );

  const toolbar = (
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2">
        {autoSaveKey && savedAt && (
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5" />
            {savedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 자동저장
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {!readOnly && (
          <button onClick={openNewWindow}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="새 창으로 보기">
            <ExternalLink className="w-3 h-3" />새 창
          </button>
        )}
        <button
          onClick={() => setFullscreen(f => !f)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-orange-200 font-medium"
          title={fullscreen ? "전체화면 닫기 (Esc)" : "전체화면 실습"}>
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {fullscreen ? "닫기" : "전체화면 실습"}
        </button>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col">
        <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 bg-gray-50">
          {toolbar}
        </div>
        <div className="flex-1 flex gap-0 overflow-hidden">
          <div className="w-[60%] min-w-0 flex flex-col border-r border-gray-200">
            {editorSection}
          </div>
          {showPreview && (
            <div className="w-[40%] min-w-0">
              {previewSection}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {toolbar}
      <div className="flex flex-col lg:flex-row gap-3" style={{ minHeight: height }}>
        <div className="lg:w-[60%] flex-shrink-0 flex flex-col" style={{ height }}>
          {editorSection}
        </div>
        {showPreview && (
          <div className="lg:w-[40%] flex-1" style={{ minHeight: height }}>
            {previewSection}
          </div>
        )}
      </div>
    </div>
  );
}