import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Save } from "lucide-react";
import { EDITOR_THEMES } from "@/hooks/useEditorSettings";
import CodeEditor from "./CodeEditor";
import CppUnsupportedNotice from "./CppUnsupportedNotice";

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
  const [savedAt, setSavedAt] = useState(null);
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

  const handleReset = () => {
    onChange(defaultCode);
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
        <>
          <CppUnsupportedNotice />
          <div className="flex items-center gap-2 flex-wrap">
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
        </>
      )}
    </div>
  );
}