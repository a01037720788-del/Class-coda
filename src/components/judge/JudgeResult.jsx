import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, Cpu, AlertTriangle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const VERDICT_CONFIG = {
  AC: { label: "맞았습니다!", color: "text-green-600", bg: "bg-green-50 border-green-200", icon: CheckCircle2 },
  WA: { label: "틀렸습니다", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: XCircle },
  CE: { label: "컴파일 오류", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: AlertTriangle },
};

function TestCaseRow({ tc, index, revealed }) {
  const [open, setOpen] = useState(false);

  if (!revealed) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
        <div className="w-5 h-5 rounded-full border-2 border-gray-200 bg-gray-100 animate-pulse" />
        <span className="text-sm text-gray-400">케이스 #{index + 1}</span>
        <div className="ml-auto w-16 h-3 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const Icon = tc.passed ? CheckCircle2 : XCircle;
  const color = tc.passed ? "text-green-500" : "text-red-500";
  const rowBg = tc.passed ? "bg-white" : "bg-red-50/40";

  return (
    <div className={`border-b border-gray-100 last:border-0 ${rowBg}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/80 transition-colors"
        onClick={() => !tc.passed && setOpen(o => !o)}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
        <span className="text-sm font-medium text-gray-700">케이스 #{index + 1}</span>
        {tc.error && <span className="text-xs text-orange-500 font-mono truncate max-w-[200px]">{tc.error}</span>}
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{tc.time_ms}ms</span>
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{tc.memory_kb >= 1024 ? `${(tc.memory_kb/1024).toFixed(1)}MB` : `${tc.memory_kb}KB`}</span>
          {!tc.passed && (
            <span className="text-gray-300">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
          )}
        </div>
      </div>

      {!tc.passed && open && (
        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <DiffBlock label="입력" value={tc.input} color="blue" />
          <DiffBlock label="예상 출력" value={tc.expected_output} color="green" />
          <DiffBlock label="실제 출력" value={tc.error || tc.actual_output} color="red" />
        </div>
      )}
    </div>
  );
}

function DiffBlock({ label, value, color }) {
  const colors = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
  };
  const textColors = {
    blue: "text-blue-700",
    green: "text-green-700",
    red: "text-red-700",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className={`text-xs font-semibold mb-1.5 ${textColors[color]}`}>{label}</div>
      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
        {value || "(없음)"}
      </pre>
    </div>
  );
}

export default function JudgeResult({ result, judging }) {
  const [revealedCount, setRevealedCount] = useState(0);

  // Animate revealing test cases one by one as judging proceeds
  useEffect(() => {
    if (!judging || !result) return;
    setRevealedCount(0);
    const total = result.total || 0;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setRevealedCount(i);
      if (i >= total) clearInterval(interval);
    }, 280);
    return () => clearInterval(interval);
  }, [judging, result?.total]);

  useEffect(() => {
    if (!judging && result) {
      setRevealedCount(result.total || 0);
    }
  }, [judging, result]);

  if (!result && !judging) return null;

  // Compile error state
  if (result?.has_compile_error) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-orange-200">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-orange-700">컴파일 오류</span>
        </div>
        <pre className="px-4 py-3 text-sm font-mono text-orange-800 whitespace-pre-wrap">{result.compile_error}</pre>
      </div>
    );
  }

  const verdict = result?.verdict;
  const vc = verdict ? VERDICT_CONFIG[verdict] : null;
  const VIcon = vc?.icon;
  const passedCount = result?.passed ?? 0;
  const totalCount = result?.total ?? 0;
  const cases = result?.results ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header / verdict */}
      <div className={`px-5 py-4 flex items-center gap-3 border-b ${vc ? vc.bg : "bg-gray-50 border-gray-200"}`}>
        {judging || !verdict ? (
          <>
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <div>
              <div className="font-bold text-blue-700">채점 중...</div>
              <div className="text-xs text-blue-500 mt-0.5">
                {totalCount > 0 ? `${Math.min(revealedCount, totalCount)} / ${totalCount} 케이스 진행 중` : "테스트 케이스 실행 중"}
              </div>
            </div>
          </>
        ) : (
          <>
            {VIcon && <VIcon className={`w-6 h-6 flex-shrink-0 ${vc.color}`} />}
            <div>
              <div className={`font-bold text-base ${vc.color}`}>{vc.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {passedCount} / {totalCount} Passed
              </div>
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {result.max_time_ms}ms
              </span>
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                {result.max_memory_kb >= 1024
                  ? `${(result.max_memory_kb / 1024).toFixed(1)} MB`
                  : `${result.max_memory_kb} KB`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full transition-all duration-300 ${verdict === 'AC' ? 'bg-green-400' : verdict === 'WA' ? 'bg-red-400' : 'bg-blue-400'}`}
            style={{ width: `${(Math.min(revealedCount, totalCount) / totalCount) * 100}%` }}
          />
        </div>
      )}

      {/* Test case list */}
      {totalCount > 0 && (
        <div>
          {cases.map((tc, i) => (
            <TestCaseRow key={i} tc={tc} index={i} revealed={i < revealedCount} />
          ))}
          {/* Remaining pending rows */}
          {Array.from({ length: Math.max(0, totalCount - cases.length) }).map((_, i) => (
            <TestCaseRow key={`pending-${i}`} tc={null} index={cases.length + i} revealed={false} />
          ))}
        </div>
      )}
    </div>
  );
}