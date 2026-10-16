import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function TypingPractice({ typingCode, onAttempt }) {
  const [userCode, setUserCode] = useState("");
  const [result, setResult] = useState(null);

  const handleCheck = () => {
    if (!userCode.trim()) return;
    const referenceLines = typingCode.split("\n");
    const userLines = userCode.split("\n");
    const maxLen = Math.max(referenceLines.length, userLines.length);
    const diffLines = [];

    for (let i = 0; i < maxLen; i++) {
      const ref = referenceLines[i] ?? "";
      const usr = userLines[i] ?? "";
      if (ref !== usr) diffLines.push(i + 1);
    }

    // Check whitespace-only differences
    const refTrimmed = referenceLines.map(l => l.trimEnd());
    const usrTrimmed = userLines.map(l => l.trimEnd());
    const maxT = Math.max(refTrimmed.length, usrTrimmed.length);
    const whitespaceDiff = [];
    for (let i = 0; i < maxT; i++) {
      if (refTrimmed[i] !== usrTrimmed[i]) whitespaceDiff.push(i + 1);
    }

    let status, message, lineDiffs;
    if (diffLines.length === 0) {
      status = "perfect";
      message = "완벽하게 일치합니다! 훌륭해요! 🎉";
      lineDiffs = [];
    } else if (whitespaceDiff.length === 0) {
      status = "whitespace";
      message = "내용은 일치하지만 공백 차이가 있습니다.";
      lineDiffs = diffLines;
    } else {
      status = "wrong";
      message = `${diffLines.length}개 줄에서 차이가 있습니다.`;
      lineDiffs = diffLines.slice(0, 5);
    }

    setResult({ status, message, lineDiffs });
    if (onAttempt) onAttempt(userCode, status === "perfect");
  };

  const handleReset = () => {
    setUserCode("");
    setResult(null);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Reference code (no copy) */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">📖 따라쓰기 코드 (복사 불가)</p>
          <div
            className="bg-gray-900 rounded-lg p-4 min-h-[200px] font-mono text-sm text-green-300 whitespace-pre overflow-auto"
            style={{ userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none" }}
            onCopy={e => e.preventDefault()}
            onCut={e => e.preventDefault()}
            onContextMenu={e => e.preventDefault()}
            onSelectStart={e => e.preventDefault()}
            onDragStart={e => e.preventDefault()}
            onMouseDown={e => { if (e.detail > 1) e.preventDefault(); }}
          >
            {typingCode || "// 따라쓰기 코드가 없습니다."}
          </div>
        </div>

        {/* Right: User input */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">✏️ 직접 입력하세요</p>
          <textarea
            value={userCode}
            onChange={e => { setUserCode(e.target.value); setResult(null); }}
            placeholder="왼쪽 코드를 보고 여기에 직접 입력하세요..."
            className="w-full bg-gray-900 rounded-lg p-4 min-h-[200px] font-mono text-sm text-white resize-none outline-none border-2 border-transparent focus:border-blue-500 transition-colors"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-lg border flex items-start gap-3 ${
          result.status === "perfect" ? "bg-green-50 border-green-200"
          : result.status === "whitespace" ? "bg-yellow-50 border-yellow-200"
          : "bg-red-50 border-red-200"
        }`}>
          {result.status === "perfect" && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
          {result.status === "whitespace" && <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />}
          {result.status === "wrong" && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
          <div>
            <p className={`text-sm font-semibold ${
              result.status === "perfect" ? "text-green-700"
              : result.status === "whitespace" ? "text-yellow-700"
              : "text-red-700"
            }`}>{result.message}</p>
            {result.lineDiffs.length > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                {result.lineDiffs.join(", ")}번째 줄을 확인해 주세요.
                {result.status === "whitespace" && " 정확한 들여쓰기를 확인해 주세요."}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleCheck} className="bg-blue-600 hover:bg-blue-700" disabled={!userCode.trim()}>
          확인
        </Button>
        <Button variant="outline" onClick={handleReset}>초기화</Button>
      </div>
    </div>
  );
}