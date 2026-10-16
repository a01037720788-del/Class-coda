import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, Save } from "lucide-react";
import { runPython } from "@/lib/codeRunner";
import { EDITOR_THEMES } from "@/hooks/useEditorSettings";
import CodeEditor from "./CodeEditor";
import StdinInput from "./StdinInput";

function getStoredEditorSettings() {
  try { const s = localStorage.getItem("coda_editor_settings"); return s ? JSON.parse(s) : null; }
  catch { return null; }
}

export default function PythonCodeEditor({
  value,
  onChange,
  defaultCode = 'print("Hello CODA")',
  readOnly = false,
  showRunButton = true,
  onRun,
  placeholder = "코드를 입력하세요...",
  height = "200px",
  bgColor,
  textColor,
  autoSaveKey = null,
  onAutoSave = null,
  stdinInput = "",      // input() 실행 시 전달할 stdin 값 (레거시)
  stdin,                // input() 실행 시 전달할 표준 입력값 (controlled)
  onStdinChange = null,
  defaultStdin = "",
  stdinDescription = "",
  forceShowStdin = false,
  hideStdin = false,
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const autoSaveTimer = useRef(null);
  const [internalStdin, setInternalStdin] = useState(defaultStdin || "");
  const stdinValue = onStdinChange ? (stdin ?? "") : internalStdin;
  const handleStdinChange = (v) => {
    if (onStdinChange) onStdinChange(v);
    else setInternalStdin(v);
  };

  // 자동 저장: value 변경 후 5초 뒤 저장
  useEffect(() => {
    if (!autoSaveKey || readOnly) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      localStorage.setItem(`autosave_${autoSaveKey}`, value || "");
      setSavedAt(new Date());
      if (onAutoSave) onAutoSave(value);
    }, 5000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [value, autoSaveKey, readOnly]);

  // 페이지 언로드 시 즉시 저장
  useEffect(() => {
    if (!autoSaveKey || readOnly) return;
    const save = () => localStorage.setItem(`autosave_${autoSaveKey}`, value || "");
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [value, autoSaveKey, readOnly]);

  const es = getStoredEditorSettings();
  const themeKey = es?.theme || "vscode-dark";
  const editorTheme = EDITOR_THEMES[themeKey] || EDITOR_THEMES["vscode-dark"];

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const payload = { code: value, mode: "simple" };
      const s = stdinValue || stdinInput || "";
      if (s) payload.stdin = s;
      const data = await runPython(payload);
      setResult(data);
      if (onRun) onRun(data);
    } catch (e) {
      const errData = { error: e.message || "실행 오류" };
      setResult(errData);
      if (onRun) onRun(errData);
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    onChange(defaultCode);
    setResult(null);
    if (autoSaveKey) localStorage.removeItem(`autosave_${autoSaveKey}`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg overflow-hidden border" style={{ minHeight: height, background: editorTheme.bg, borderColor: editorTheme.border }}>
        <div className="flex text-xs px-3 py-1.5 border-b items-center gap-2" style={{ background: editorTheme.toolbar, borderColor: editorTheme.border }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="ml-2 font-mono" style={{ color: editorTheme.lineNum }}>main.py</span>
        </div>
        <CodeEditor
          value={value || ""}
          onChange={onChange}
          language="python"
          readOnly={readOnly}
          height={height}
          placeholder={placeholder}
        />
      </div>

      {!readOnly && !hideStdin && (
        <StdinInput
          value={stdinValue}
          onChange={handleStdinChange}
          code={value}
          defaultStdin={defaultStdin}
          description={stdinDescription}
          forceShow={forceShowStdin}
        />
      )}

      {showRunButton && !readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={handleRun} disabled={running || !value?.trim()}
            className="bg-green-600 hover:bg-green-700 gap-1.5">
            <Play className="w-3.5 h-3.5" />
            {running ? "실행 중..." : "실행하기"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />초기화
          </Button>
          {autoSaveKey && savedAt && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 ml-1">
              <Save className="w-3 h-3" />
              {savedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 자동 저장됨
            </span>
          )}
        </div>
      )}

      {result && (
        <div className={`rounded-lg border text-xs font-mono p-3 ${
          result.error ? "bg-red-950 border-red-800 text-red-300" : "bg-gray-950 border-gray-700 text-gray-200"
        }`}>
          <p className={`text-xs font-semibold mb-1 font-sans ${result.error ? "text-red-400" : "text-green-400"}`}>
            {result.error ? "❌ 에러" : "✅ 실행 결과"}
          </p>
          <pre className="whitespace-pre-wrap break-all">{result.error || result.output || "(출력 없음)"}</pre>
        </div>
      )}
    </div>
  );
}