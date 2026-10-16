import React, { useState, useEffect, useRef } from "react";
import { Eye, RefreshCw, RotateCcw, Maximize2, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 다중 파일 방식 빌드:
 * - files: [{ name, language, code }] 배열
 * - HTML에서 <link href="..."> → 해당 CSS 파일 코드 주입
 * - HTML에서 <script src="..."> → 해당 JS 파일 코드 주입
 * - 존재하지 않는 파일 참조 시 오류 메시지 수집
 * 
 * 하위 호환: html/css/js props도 지원
 */
function buildSrcdocFromFiles(files = []) {
  const errors = [];

  // 메인 HTML 파일 찾기 (index.html 우선, 없으면 첫 번째 html)
  const htmlFile = files.find(f => f.name === "index.html") || files.find(f => f.language === "html");
  if (!htmlFile) return { srcdoc: "", errors: [] };

  let doc = htmlFile.code || "";
  const isFullDoc = /<!DOCTYPE|<html/i.test(doc.trim());

  if (!isFullDoc) {
    // 짧은 스니펫: 다른 파일들의 CSS/JS를 모두 합쳐 인라인 삽입
    const cssCode = files.filter(f => f.language === "css").map(f => f.code || "").join("\n");
    const jsCode  = files.filter(f => f.language === "js").map(f => f.code || "").join("\n");
    return {
      srcdoc: `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:8px;font-family:sans-serif;}\n${cssCode}</style>
</head>
<body>
${doc}
<script>try{\n${jsCode}\n}catch(e){console.error(e);}<\/script>
</body>
</html>`,
      errors: [],
    };
  }

  // <link rel="stylesheet" href="..."> 처리
  doc = doc.replace(/<link([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, href, after) => {
    const isStylesheet = /rel=["']stylesheet["']/i.test(before + after);
    if (!isStylesheet) return match;
    const filename = href.split("/").pop();
    const file = files.find(f => f.name === filename);
    if (file) {
      return `<style>\n/* ${filename} */\n${file.code || ""}\n</style>`;
    } else {
      errors.push(`"${href}" 파일을 찾을 수 없습니다.`);
      return `<!-- CSS 오류: ${href} 없음 -->`;
    }
  });

  // <script src="..."></script> 처리
  doc = doc.replace(/<script([^>]*?)src=["']([^"']+)["']([^>]*?)><\/script>/gi, (match, before, src, after) => {
    const filename = src.split("/").pop();
    const file = files.find(f => f.name === filename);
    if (file) {
      return `<script>\n/* ${filename} */\ntry{\n${file.code || ""}\n}catch(e){console.error(e);}\n<\/script>`;
    } else {
      errors.push(`"${src}" 파일을 찾을 수 없습니다.`);
      return `<!-- JS 오류: ${src} 없음 -->`;
    }
  });

  return { srcdoc: doc, errors };
}

export default function MultiPreview({
  // 새 방식: files 배열
  files,
  // 하위 호환: 기존 html/css/js props
  html = "", css = "", js = "",
  cssFilename = "style.css",
  jsFilename = "script.js",
  autoPreview = true,
  height = "700px",
  onOpenNewWindow,
}) {
  const [srcdoc, setSrcdoc] = useState("");
  const [key, setKey] = useState(0);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [fileErrors, setFileErrors] = useState([]);

  // files prop이 없으면 기존 방식으로 변환
  const resolvedFiles = files || [
    { name: "index.html", language: "html", code: html },
    { name: cssFilename, language: "css", code: css },
    { name: jsFilename, language: "js", code: js },
  ];

  const rebuild = () => {
    const result = buildSrcdocFromFiles(resolvedFiles);
    setSrcdoc(result.srcdoc);
    setFileErrors(result.errors || []);
  };

  useEffect(() => {
    if (!autoPreview) return;
    const t = setTimeout(() => rebuild(), 500);
    return () => clearTimeout(t);
  }, [JSON.stringify(resolvedFiles), autoPreview]);

  const reloadPreview = () => {
    setSrcdoc("");
    setTimeout(() => { rebuild(); setKey(k => k + 1); }, 50);
  };

  const handleOpenNewWindow = () => {
    if (onOpenNewWindow) { onOpenNewWindow(); return; }
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(srcdoc);
    w.document.close();
  };

  const iframeEl = (h) => (
    <iframe
      key={key}
      srcDoc={srcdoc}
      sandbox="allow-scripts allow-same-origin"
      title="Preview"
      className="flex-1 w-full bg-white"
      style={{ height: h, display: "block", border: "none" }}
    />
  );

  const errorBanner = fileErrors.length > 0 && (
    <div className="bg-red-50 border-b border-red-200 px-3 py-1.5 flex-shrink-0">
      {fileErrors.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {e}
        </div>
      ))}
    </div>
  );

  const header = (
    <div className="flex items-center justify-between bg-white border-b border-gray-200 px-3 py-1.5 rounded-t-lg flex-shrink-0">
      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
        <Eye className="w-3.5 h-3.5 text-blue-500" />
        미리보기
        {autoPreview && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full ml-1">실시간</span>}
      </div>
      <div className="flex items-center gap-1">
        {!autoPreview && (
          <Button size="sm" variant="outline" onClick={rebuild} className="h-6 text-xs gap-1 px-2">
            <RefreshCw className="w-3 h-3" />실행
          </Button>
        )}
        <button onClick={reloadPreview} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors" title="새로고침">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleOpenNewWindow} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors" title="새 창으로 보기">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setPreviewFullscreen(f => !f)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors" title="전체화면">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  if (previewFullscreen) {
    return (
      <>
        <div className="flex flex-col h-full rounded-lg border border-gray-200 overflow-hidden">
          {header}
          {errorBanner}
          {iframeEl(height)}
        </div>
        <div className="fixed inset-0 z-[200] bg-white flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Eye className="w-4 h-4 text-blue-500" />미리보기 전체화면
            </div>
            <div className="flex items-center gap-1">
              <button onClick={reloadPreview} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
                <RotateCcw className="w-3.5 h-3.5" />새로고침
              </button>
              <button onClick={() => setPreviewFullscreen(false)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 border border-red-200 ml-1">
                닫기
              </button>
            </div>
          </div>
          {fileErrors.length > 0 && (
            <div className="bg-red-50 border-b border-red-200 px-3 py-1.5 flex-shrink-0">
              {fileErrors.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />{e}
                </div>
              ))}
            </div>
          )}
          <iframe key={key + 100} srcDoc={srcdoc} sandbox="allow-scripts allow-same-origin" title="Preview Fullscreen" className="flex-1 w-full" style={{ border: "none" }} />
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 overflow-hidden" style={{ minHeight: height }}>
      {header}
      {errorBanner}
      {iframeEl(height)}
    </div>
  );
}