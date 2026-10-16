import React, { useRef, useState, memo, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "javascript", label: "JavaScript" },
];

const DEFAULT_CODES = {
  python: `print("Hello CODA")`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}`,
  javascript: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();`,
};

const CodeEditor = memo(function CodeEditor({ value, language, onValueChange, onLanguageChange }) {
  const textareaRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleLanguageChange = useCallback((lang) => {
    onLanguageChange(lang);
    if (!value || value === DEFAULT_CODES[language]) {
      onValueChange(DEFAULT_CODES[lang] || "");
    }
  }, [language, value, onLanguageChange, onValueChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = value.substring(0, start) + "    " + value.substring(end);
      onValueChange(newVal);
      setTimeout(() => { el.selectionStart = el.selectionEnd = start + 4; }, 0);
    }
  }, [value, onValueChange]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  const lineNumbers = useMemo(() => {
    const count = Math.max((value || "").split("\n").length, 5);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [value]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-[#1e1e2e]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#181825] border-b border-[#313244]">
        <div className="flex gap-1">
          {LANGUAGES.map(l => (
            <button key={l.value} onClick={() => handleLanguageChange(l.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${language === l.value ? "bg-[#7c3aed] text-white" : "text-gray-400 hover:text-gray-200 hover:bg-[#313244]"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-[#313244]">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex">
        {/* Line numbers */}
        <div className="select-none bg-[#181825] text-[#6c7086] text-right text-xs leading-6 px-3 py-3 font-mono border-r border-[#313244] min-w-[2.5rem]">
          {lineNumbers.map(n => <div key={n}>{n}</div>)}
        </div>
        {/* Code area */}
        <textarea
          ref={textareaRef}
          value={value || ""}
          onChange={e => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="flex-1 bg-transparent text-[#cdd6f4] text-sm font-mono leading-6 p-3 resize-none focus:outline-none min-h-[200px]"
          style={{ tabSize: 4 }}
          placeholder={DEFAULT_CODES[language] || "코드를 입력하세요..."}
        />
      </div>
    </div>
  );
});

export default CodeEditor;