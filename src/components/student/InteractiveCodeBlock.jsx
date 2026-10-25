import React, { useState, useEffect } from "react";
import { runPython, runCpp } from "@/lib/codeRunner";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Play, RotateCcw } from "lucide-react";
import StdinInput from "./StdinInput";
import { CPP_UNSUPPORTED_SHORT } from "./CppUnsupportedNotice";

const LS_KEY = (blockId) => `interactive_block_${blockId}`;

export default function InteractiveCodeBlock({ ic, blockId, language = "python" }) {
  // blockId: 고유 식별자 (unitId + sectionIdx 조합)
  // language: "python" | "cpp" — 실행 러너 선택
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY(blockId)) || "{}"); } catch { return {}; } })();

  const originalCode = ic.code || "";
  const [code, setCode] = useState(saved.code ?? originalCode);
  const [result, setResult] = useState(saved.result ?? null);
  const [running, setRunning] = useState(false);
  const [compared, setCompared] = useState(saved.compared ?? null); // null | "match" | "mismatch"
  const [stdin, setStdin] = useState(saved.stdin ?? "");

  // 로컬스토리지에 저장
  const persist = (updates) => {
    const current = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY(blockId)) || "{}"); } catch { return {}; } })();
    try { localStorage.setItem(LS_KEY(blockId), JSON.stringify({ ...current, ...updates, savedAt: new Date().toISOString() })); } catch {}
  };

  const reset = () => {
    setCode(originalCode);
    setResult(null);
    setCompared(null);
    setStdin("");
    persist({ code: originalCode, stdin: "", result: null, compared: null });
  };

  const isCpp = language === "cpp" || ic.language === "cpp";

  const run = async () => {
    // C++ 은 실행을 지원하지 않습니다 (외부 실행 서비스도 사용하지 않음)
    if (isCpp) {
      setResult(CPP_UNSUPPORTED_SHORT);
      setCompared(null);
      return;
    }
    setRunning(true);
    setCompared(null);
    try {
      const runner = language === "cpp" ? runCpp : runPython;
      const data = await runner({ code, stdin });
      const output = data?.output ?? data?.result ?? "";
      const error = data?.error ?? "";
      const displayResult = error ? `오류: ${error}` : String(output);
      setResult(displayResult);
      let newCompared = null;
      if (!error && ic.compare_result !== false && ic.expected_output) {
        const expected = (ic.expected_output || "").trim();
        newCompared = String(output).trim() === expected ? "match" : "mismatch";
      }
      setCompared(newCompared);
      persist({ code, stdin, result: displayResult, compared: newCompared });
    } catch (e) {
      const errMsg = "오류: " + (e.message || "실행 실패");
      setResult(errMsg);
      persist({ code, result: errMsg, compared: null });
    }
    setRunning(false);
  };

  const handleCodeChange = (val) => {
    setCode(val);
    setResult(null);
    setCompared(null);
    persist({ code: val, result: null, compared: null });
  };

  const isEditable = ic.allow_edit !== false;
  const title = ic.title || "실행 가능 코드";
  const lang = ic.language || "python";

  return (
    <div className="border border-purple-200 rounded-xl overflow-hidden mt-3">
      <div className="bg-purple-600 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white text-xs font-medium">▶ {title}</span>
          <span className="text-purple-300 text-xs uppercase">{lang}</span>
        </div>
        {isEditable && <span className="text-purple-200 text-xs">수정 가능</span>}
      </div>

      <div className="bg-gray-950 p-3">
        {isEditable ? (
          <textarea
            value={code}
            onChange={e => handleCodeChange(e.target.value)}
            className="w-full bg-transparent text-green-300 font-mono text-sm outline-none resize-none leading-6 min-h-[80px]"
            style={{ caretColor: "#86efac", tabSize: 4 }}
            spellCheck={false}
            onKeyDown={e => {
              // Tab 키 처리
              if (e.key === "Tab") {
                e.preventDefault();
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const newVal = code.substring(0, start) + "    " + code.substring(end);
                handleCodeChange(newVal);
                requestAnimationFrame(() => {
                  e.target.selectionStart = e.target.selectionEnd = start + 4;
                });
              }
            }}
          />
        ) : (
          <pre className="text-green-300 font-mono text-sm select-none whitespace-pre-wrap"
            onCopy={e => e.preventDefault()}>{code}</pre>
        )}
      </div>

      {!isCpp && (
        <StdinInput
          value={stdin}
          onChange={setStdin}
          code={code}
          forceShow={ic.uses_input === true}
          defaultStdin={ic.default_stdin || ""}
          description={ic.stdin_description || ""}
        />
      )}

      <div className="bg-gray-900 px-3 py-2 flex items-center gap-2 border-t border-gray-800">
        {isCpp ? (
          <span className="text-xs text-amber-400">{CPP_UNSUPPORTED_SHORT}</span>
        ) : (
          <Button size="sm" onClick={run} disabled={running}
            className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1">
            <Play className="w-3 h-3" />{running ? "실행 중..." : "실행"}
          </Button>
        )}
        {isEditable && originalCode && (
          <button onClick={reset} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            <RotateCcw className="w-3 h-3" />원본 복원
          </button>
        )}
        {ic.description && (
          <span className="text-xs text-gray-500 ml-auto truncate max-w-[60%]">{ic.description}</span>
        )}
      </div>

      {result !== null && (
        <div className="border-t border-gray-700 bg-gray-950 px-3 py-2">
          <p className="text-xs text-gray-400 mb-1">실행 결과:</p>
          <pre className="text-yellow-300 font-mono text-sm whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      {compared === "match" && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border-t border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">확인되었습니다 ✓</span>
        </div>
      )}
      {compared === "mismatch" && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-200">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700 font-medium">결과가 다릅니다. 다시 확인해 주세요.</span>
          </div>
          {ic.expected_output && (
            <p className="text-xs text-gray-500">예상 출력: <code className="font-mono bg-white px-1 rounded">{ic.expected_output}</code></p>
          )}
        </div>
      )}
    </div>
  );
}