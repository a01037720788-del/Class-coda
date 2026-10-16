import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw, Save } from "lucide-react";
import { runCpp } from "@/lib/codeRunner";
import { EDITOR_THEMES } from "@/hooks/useEditorSettings";
import CodeEditor from "./CodeEditor";
import CppStdinInput from "./CppStdinInput";

function getStoredEditorSettings() {
  try { const s = localStorage.getItem("coda_editor_settings"); return s ? JSON.parse(s) : null; }
  catch { return null; }
}

const DEFAULT_CPP = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello CODA";
    return 0;
}`;

export default function CppCodeEditor({
  value,
  onChange,
  defaultCode = DEFAULT_CPP,
  readOnly = false,
  showRunButton = true,
  onRun,
  placeholder = "코드를 입력하세요...",
  height = "200px",
  autoSaveKey = null,
  onAutoSave = null,
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [stdin, setStdin] = useState("");
  const autoSaveTimer = useRef(null);

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
      const data = await runCpp({ code: value, stdin });
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
    setStdin("");
    if (autoSaveKey) localStorage.removeItem(`autosave_${autoSaveKey}`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg overflow-hidden border" style={{ minHeight: height, background: editorTheme.bg, borderColor: editorTheme.border }}>
        <div className="flex text-xs px-3 py-1.5 border-b items-center gap-2" style={{ background: editorTheme.toolbar, borderColor: editorTheme.border }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="ml-2 font-mono" style={{ color: editorTheme.lineNum }}>main.cpp</span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ background: "#2563EB22", color: "#60A5FA" }}>C++17</span>
        </div>
        <CodeEditor
          value={value || ""}
          onChange={onChange}
          language="cpp"
          readOnly={readOnly}
          height={height}
          placeholder={placeholder}
        />
      </div>

      {showRunButton && !readOnly && (
        <CppStdinInput value={stdin} onChange={setStdin} code={value || ""} />
      )}
      {showRunButton && !readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={handleRun} disabled={running || !value?.trim()}
            className="bg-blue-600 hover:bg-blue-700 gap-1.5">
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
          <p className={`text-xs font-semibold mb-1 font-sans ${result.error ? "text-red-400" : "text-blue-400"}`}>
            {result.error ? "❌ 에러" : "✅ 실행 결과 (C++17)"}
          </p>
          <pre className="whitespace-pre-wrap break-all">{result.error || result.output || "(출력 없음)"}</pre>
        </div>
      )}
    </div>
  );
}