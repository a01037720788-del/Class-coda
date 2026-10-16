import React, { useState, useRef, useEffect } from "react";
import CodeEditor from "./CodeEditor";
import MultiPreview from "./MultiPreview";
import { RefreshCw, Maximize2, Minimize2, ExternalLink, Plus, X, FileText, Palette, Zap } from "lucide-react";
import { storageKeys, storageSave, storageLoad } from "@/lib/storageService";

const DEFAULT_HTML_BOILERPLATE = `<!DOCTYPE html>
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

const DEFAULT_FILES = [
  { name: "index.html", language: "html", code: DEFAULT_HTML_BOILERPLATE },
  { name: "style.css",  language: "css",  code: DEFAULT_CSS },
  { name: "script.js",  language: "js",   code: DEFAULT_JS },
];

const FILE_TYPES = [
  { lang: "html", icon: "📄", dot: "bg-orange-400", color: "text-orange-300", defaultNames: ["index.html", "about.html", "contact.html"] },
  { lang: "css",  icon: "🎨", dot: "bg-blue-400",   color: "text-blue-300",   defaultNames: ["style.css", "reset.css", "main.css"] },
  { lang: "js",   icon: "⚡", dot: "bg-yellow-400", color: "text-yellow-300", defaultNames: ["script.js", "app.js", "main.js"] },
];

function getFileIcon(lang) {
  return FILE_TYPES.find(t => t.lang === lang)?.icon || "📄";
}
function getFileDot(lang) {
  return FILE_TYPES.find(t => t.lang === lang)?.dot || "bg-gray-400";
}
function getFileLang(filename) {
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".js")) return "js";
  return "html";
}

// 파일 추가 팝업
function AddFileDialog({ onAdd, onClose, existingNames }) {
  const [lang, setLang] = useState("html");
  const [name, setName] = useState("about.html");

  const handleLangChange = (l) => {
    setLang(l);
    const defaults = FILE_TYPES.find(t => t.lang === l)?.defaultNames || [];
    const available = defaults.find(n => !existingNames.includes(n));
    setName(available || (l === "html" ? "page.html" : l === "css" ? "style2.css" : "app.js"));
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (existingNames.includes(trimmed)) { alert(`"${trimmed}" 파일이 이미 존재합니다.`); return; }
    const defaultCode = lang === "html"
      ? `<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8">\n  <title>${trimmed}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n  <script src="script.js"><\/script>\n</body>\n</html>`
      : lang === "css"
      ? `/* ${trimmed} */\n`
      : `// ${trimmed}\n`;
    onAdd({ name: trimmed, language: lang, code: defaultCode });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">파일 추가</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">파일 타입</label>
            <div className="flex gap-2">
              {FILE_TYPES.map(t => (
                <button key={t.lang} onClick={() => handleLangChange(t.lang)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 text-xs font-medium transition-all ${lang === t.lang ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <span className="text-xl">{t.icon}</span>
                  <span>{t.lang === "html" ? "HTML" : t.lang === "css" ? "CSS" : "JavaScript"}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">파일 이름</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="파일명 입력"
            />
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {(FILE_TYPES.find(t => t.lang === lang)?.defaultNames || []).filter(n => !existingNames.includes(n)).map(n => (
                <button key={n} onClick={() => setName(n)} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">{n}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">취소</button>
            <button onClick={handleAdd} className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600">생성</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 다중 파일 에디터 (파일 추가/삭제 지원)
 * files: [{ name, language, code }]
 * onFilesChange: (files) => void
 */
export default function MultiFileEditor({
  files: filesProp,
  onFilesChange,
  readOnly = false,
  defaultFiles,
  autoSaveKey = null,
  height = "540px",
  showPreview = true,
}) {
  const resolvedDefault = defaultFiles || DEFAULT_FILES;

  // 내부 상태 (controlled or uncontrolled)
  const isControlled = filesProp !== undefined && onFilesChange !== undefined;
  const [internalFiles, setInternalFiles] = useState(() => {
    if (isControlled) return filesProp;
    return resolvedDefault.map(f => ({ ...f }));
  });

  const files = isControlled ? (filesProp || resolvedDefault) : internalFiles;
  const setFiles = (newFiles) => {
    if (isControlled) onFilesChange(newFiles);
    else setInternalFiles(newFiles);
  };

  const [activeFile, setActiveFile] = useState(files[0]?.name || "index.html");
  const [fullscreen, setFullscreen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const autoSaveTimer = useRef(null);

  // 마운트 시 비어있으면 기본값 주입
  useEffect(() => {
    if (!isControlled && files.length === 0) {
      setFiles(resolvedDefault.map(f => ({ ...f })));
    }
  }, []);

  // controlled: filesProp 변경 시 activeFile 유효성 체크
  useEffect(() => {
    if (isControlled && files.length > 0) {
      if (!files.find(f => f.name === activeFile)) {
        setActiveFile(files[0].name);
      }
    }
  }, [JSON.stringify(files?.map(f => f.name))]);

  const updateFileCode = (name, code) => {
    const updated = files.map(f => f.name === name ? { ...f, code } : f);
    setFiles(updated);
    if (autoSaveKey && !readOnly) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      storageSave(storageKeys.multiFileEditorSave(autoSaveKey), updated);
    }, 3000);
    }
  };

  const addFile = (file) => {
    const updated = [...files, file];
    setFiles(updated);
    setActiveFile(file.name);
  };

  const removeFile = (name) => {
    if (files.length <= 1) return;
    if (!confirm(`"${name}" 파일을 삭제하시겠습니까?`)) return;
    const updated = files.filter(f => f.name !== name);
    setFiles(updated);
    if (activeFile === name) setActiveFile(updated[0]?.name || "");
  };

  const resetFile = () => {
    const defFile = resolvedDefault.find(f => f.name === activeFile);
    if (defFile) updateFileCode(activeFile, defFile.code);
  };

  const activeFileDef = files.find(f => f.name === activeFile);
  const editorH = fullscreen ? "calc(100vh - 88px)" : height;

  const editorSection = (
    <div className="flex flex-col h-full">
      {/* 파일 탭 헤더 */}
      <div className="flex items-center bg-gray-900 rounded-t-lg px-1 pt-1 gap-0.5 flex-shrink-0 overflow-x-auto">
        {files.map(f => {
          const isDefault = ["index.html", "style.css", "script.js"].includes(f.name);
          return (
            <div key={f.name} className={`group relative flex items-center gap-1.5 px-3 py-2 rounded-t-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer ${
              activeFile === f.name
                ? "bg-[#1e1e2e] text-white border-t-2 border-orange-400"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`} onClick={() => setActiveFile(f.name)}>
              <span className="text-sm leading-none">{getFileIcon(f.language)}</span>
              <span>{f.name}</span>
              {!readOnly && !isDefault && (
                <button
                  onClick={e => { e.stopPropagation(); removeFile(f.name); }}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                  title="파일 삭제">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        {!readOnly && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-1 px-2 py-2 text-gray-500 hover:text-green-400 hover:bg-gray-800 rounded-t-md transition-colors flex-shrink-0 text-xs"
            title="파일 추가">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">파일 추가</span>
          </button>
        )}
        {!readOnly && activeFileDef && (
          <button
            onClick={resetFile}
            className="ml-auto mr-1 p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
            title="현재 파일 초기화">
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 에디터 본문 */}
      <div className="flex-1 min-h-0">
        {files.map(f => (
          <div key={f.name} style={{ display: activeFile === f.name ? "block" : "none", height: "100%" }}>
            <CodeEditor
              value={f.code}
              onChange={v => updateFileCode(f.name, v)}
              readOnly={readOnly}
              language={f.language}
              height={editorH}
              showCopy={false}
              filename={f.name}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const previewSection = (
    <MultiPreview
      files={files}
      autoPreview
      height={editorH}
    />
  );

  const toolbar = (
    <div className="flex items-center justify-end mb-1 gap-1.5">
      <button
        onClick={() => setFullscreen(f => !f)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-orange-200 font-medium"
        title={fullscreen ? "전체화면 닫기 (Esc)" : "전체화면 실습"}>
        {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        {fullscreen ? "닫기" : "전체화면 실습"}
      </button>
    </div>
  );

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && fullscreen) setFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  if (fullscreen) {
    return (
      <>
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 bg-gray-50">{toolbar}</div>
          <div className="flex-1 flex gap-0 overflow-hidden">
            <div className="w-[60%] min-w-0 flex flex-col border-r border-gray-200">{editorSection}</div>
            {showPreview && <div className="w-[40%] min-w-0">{previewSection}</div>}
          </div>
        </div>
        {showAddDialog && (
          <AddFileDialog
            onAdd={addFile}
            onClose={() => setShowAddDialog(false)}
            existingNames={files.map(f => f.name)}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      {toolbar}
      <div className="flex flex-col lg:flex-row gap-3 w-full" style={{ minHeight: height }}>
        <div className={showPreview ? "lg:w-[65%] w-full flex-shrink-0 flex flex-col" : "w-full flex flex-col"} style={{ height }}>
          {editorSection}
        </div>
        {showPreview && (
          <div className="lg:w-[35%] w-full flex-1" style={{ minHeight: height }}>
            {previewSection}
          </div>
        )}
      </div>
      {showAddDialog && (
        <AddFileDialog
          onAdd={addFile}
          onClose={() => setShowAddDialog(false)}
          existingNames={files.map(f => f.name)}
        />
      )}
    </div>
  );
}