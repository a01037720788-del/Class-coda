import React, { useState, useEffect } from "react";
import { runCpp } from "@/lib/codeRunner";
import { saveExamplePractice } from "@/lib/dataAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RefreshCw, CheckCircle2, ChevronDown, ChevronUp, Eye, CheckSquare } from "lucide-react";
import CppCodeEditor from "./CppCodeEditor";
import CppStdinInput from "./CppStdinInput";
import { storageSave, storageLoad } from "@/lib/storageService";
import { useToast } from "@/components/ui/use-toast";
import { highlightCode } from "@/lib/syntaxHighlight";
import { getSessionToken } from "@/lib/auth";

// C++ 코드 정규화: 공백, 빈 줄, 들여쓰기, 줄 끝 공백 차이 허용
function normalizeCppCode(code) {
  return String(code || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length > 0)
    .join("\n");
}

export default function CppExamplePractice({ exampleCodes = [], user, unitId, unitTitle, progress, onProgressUpdate }) {
  const { toast } = useToast();
  const [studentCodes, setStudentCodes] = useState({});
  const [results, setResults] = useState({});
  const [running, setRunning] = useState({});
  const [checking, setChecking] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const [showCompleted, setShowCompleted] = useState(true);
  const [localCompleted, setLocalCompleted] = useState([]);
  const [stdinValues, setStdinValues] = useState({});

  const sid = user?.student_id;
  const completedIds = [
    ...(progress?.completed_example_ids || []),
    ...localCompleted.filter(id => !(progress?.completed_example_ids || []).includes(id))
  ];

  // localStorage에서 임시 저장 코드 로드
  useEffect(() => {
    if (!sid || !unitId) return;
    const codes = {};
    const res = {};
    exampleCodes.forEach((ec, idx) => {
      const key = `coda_cpp_ex_${sid}_${unitId}_${idx}`;
      const saved = storageLoad(key);
      if (saved) codes[idx] = saved;
      const savedResult = storageLoad(`coda_cpp_res_${sid}_${unitId}_${idx}`);
      if (savedResult) res[idx] = savedResult;
    });
    setStudentCodes(codes);
    setResults(res);
  }, [sid, unitId, exampleCodes.length]);

  useEffect(() => {
    const init = {};
    completedIds.forEach(idx => { init[idx] = true; });
    setCollapsed(init);
  }, [progress?.completed_example_ids?.length]);

  const saveCode = (idx, code) => {
    if (sid && unitId) storageSave(`coda_cpp_ex_${sid}_${unitId}_${idx}`, code);
  };
  const saveResult = (idx, data) => {
    if (sid && unitId) storageSave(`coda_cpp_res_${sid}_${unitId}_${idx}`, data);
  };

  // ── 실행 ──────────────────────────────────────────────────────────────────
  const handleRun = async (idx) => {
    const code = studentCodes[idx] ?? "";
    if (!code.trim()) {
      toast({ title: "코드를 입력해주세요.", variant: "destructive" });
      return;
    }
    setRunning(r => ({ ...r, [idx]: true }));
    try {
      const stdin = stdinValues[idx] || "";
      const data = await runCpp({ code, mode: "simple", stdin });
      const output = data?.output || "";
      const error = data?.error || "";
      const resultData = { output, error };
      setResults(r => ({ ...r, [idx]: resultData }));
      saveResult(idx, resultData);
    } catch (err) {
      const errMsg = err?.message || "실행 중 오류가 발생했습니다.";
      setResults(r => ({ ...r, [idx]: { output: "", error: errMsg } }));
      toast({ title: "코드 실행 실패", description: errMsg, variant: "destructive" });
    } finally {
      setRunning(r => ({ ...r, [idx]: false }));
    }
  };

  // ── 작성 확인 (코드 비교) ──────────────────────────────────────────────────
  const handleCheck = async (idx, ec) => {
    if (!sid) {
      toast({ title: "학생 정보를 찾을 수 없습니다.", variant: "destructive" });
      return;
    }
    if (!getSessionToken()) {
      toast({ title: "세션 만료", description: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.", variant: "destructive" });
      return;
    }
    const code = studentCodes[idx] ?? "";
    if (!code.trim()) {
      toast({ title: "코드를 입력해주세요.", variant: "destructive" });
      return;
    }
    setChecking(c => ({ ...c, [idx]: true }));
    try {
      const referenceCode = ec.reference_code || ec.code || "";
      const isCorrect = normalizeCppCode(code) === normalizeCppCode(referenceCode);

      if (isCorrect && !completedIds.includes(idx)) {
        const newCompleted = [...(progress?.completed_example_ids || []), idx];
        const total = exampleCodes.length;
        const rate = total > 0 ? (newCompleted.length / total) * 100 : 0;
        const progressUpdate = {
          completed_example_ids: newCompleted,
          current_example_index: newCompleted.length,
          example_progress_rate: rate,
          last_studied_at: new Date().toISOString(),
        };

        try {
          await saveExamplePractice(sid, unitId, idx, {
            filename: ec.filename || "",
            typed_code: code,
            stdin: stdinValues[idx] || "",
            execution_result: results[idx]?.output || "",
            expected_output: ec.expected_output || "",
            is_matched: true,
          }, { studentName: user?.name || "", unitTitle: unitTitle || "", unitType: "cpp" }, progressUpdate);
        } catch (dbErr) {
          console.error("[CppExample] 제출 기록 저장 실패:", dbErr);
        }

        setLocalCompleted(prev => [...prev, idx]);
        setCollapsed(c => ({ ...c, [idx]: true }));
        if (onProgressUpdate) onProgressUpdate();
        toast({ title: "✓ 예제를 잘 작성했습니다!", description: "완성 코드와 일치합니다." });
      } else if (isCorrect) {
        toast({ title: "✓ 예제를 잘 작성했습니다!", description: "이미 완료된 예제입니다." });
      } else {
        toast({
          title: "📝 다시 확인해 보세요",
          description: "완성 코드와 다른 부분이 있습니다. 왼쪽 코드를 다시 확인해 보세요.",
          variant: "destructive",
        });
      }
    } finally {
      setChecking(c => ({ ...c, [idx]: false }));
    }
  };

  if (!exampleCodes.length) {
    return <p className="text-gray-400 text-sm text-center py-8">예제 코드가 없습니다.</p>;
  }

  const completedCount = completedIds.length;
  const totalCount = exampleCodes.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          완료 <span className="font-bold text-green-600">{completedCount}</span> / {totalCount}
        </p>
        <div className="flex gap-2">
          {completedCount > 0 && (
            <Button size="sm" variant="outline" className="text-xs gap-1"
              onClick={() => setShowCompleted(v => !v)}>
              <Eye className="w-3 h-3" />
              {showCompleted ? "완료 항목 숨기기" : `완료 항목 보기 (${completedCount})`}
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs gap-1"
            onClick={() => { const a = {}; exampleCodes.forEach((_, i) => { a[i] = false; }); setCollapsed(a); }}>
            <ChevronDown className="w-3 h-3" />전체 펼치기
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1"
            onClick={() => { const a = {}; exampleCodes.forEach((_, i) => { a[i] = true; }); setCollapsed(a); }}>
            <ChevronUp className="w-3 h-3" />전체 접기
          </Button>
        </div>
      </div>

      {exampleCodes.map((ec, idx) => {
        const isCompleted = completedIds.includes(idx);
        const result = results[idx];
        const studentCode = studentCodes[idx] ?? "";
        const isCollapsed = collapsed[idx] ?? false;
        const isRunning = !!running[idx];
        const isChecking = !!checking[idx];
        const referenceCode = ec.reference_code || ec.code || "";
        const starterCode = ec.starter_code || "";

        if (isCompleted && !showCompleted) return null;

        return (
          <div key={idx} className={`border rounded-xl overflow-hidden transition-all ${isCompleted ? "border-green-300" : "border-gray-200"}`}>
            <div
              className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer ${isCompleted ? "bg-green-50" : "bg-gray-50"} border-b border-gray-200`}
              onClick={() => setCollapsed(c => ({ ...c, [idx]: !c[idx] }))}>
              <span className="text-xs font-bold text-gray-500">예제 {idx + 1}.</span>
              <span className="text-xs font-mono text-blue-600 font-bold">{ec.filename}</span>
              {ec.description && <span className="text-xs text-gray-400 ml-1 hidden sm:inline">{ec.description}</span>}
              <div className="ml-auto flex items-center gap-2">
                {isCompleted && (
                  <Badge className="bg-green-100 text-green-700 border-0 gap-1 text-xs">
                    <CheckCircle2 className="w-3 h-3" />확인완료
                  </Badge>
                )}
                {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            {!isCollapsed && (
              <>
                {ec.description && (
                  <div className="px-4 pt-3">
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{ec.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-gray-200">
                  {/* 완성 코드 (읽기 전용, 복사 방지) */}
                  <div className="p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">📖 완성 코드</p>
                    <div
                      className="rounded-lg p-4 font-mono text-sm whitespace-pre overflow-auto border border-gray-700 bg-gray-900 text-gray-100"
                      style={{
                        minHeight: "240px",
                        maxHeight: "420px",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        MozUserSelect: "none",
                        msUserSelect: "none",
                      }}
                      onCopy={e => e.preventDefault()}
                      onCut={e => e.preventDefault()}
                      onContextMenu={e => e.preventDefault()}
                      onDragStart={e => e.preventDefault()}
                      onKeyDown={e => {
                        if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) e.preventDefault();
                        if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) e.preventDefault();
                      }}
                      dangerouslySetInnerHTML={{
                        __html: highlightCode(referenceCode || "// 코드가 없습니다.", "cpp")
                      }}
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5">참고용 코드 — 직접 작성해 보세요</p>
                  </div>

                  {/* 학생 에디터 */}
                  <div className="p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">✏️ 직접 작성하기</p>
                    <CppCodeEditor
                      value={studentCode}
                      onChange={v => { setStudentCodes(c => ({ ...c, [idx]: v })); saveCode(idx, v); }}
                      defaultCode={starterCode}
                      showRunButton={false}
                      height="200px"
                    />
                    <CppStdinInput
                      value={stdinValues[idx] || ""}
                      onChange={v => setStdinValues(s => ({ ...s, [idx]: v }))}
                      code={studentCode}
                      defaultStdin={ec.default_stdin || ""}
                      description={ec.stdin_description || ""}
                    />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Button size="sm" onClick={() => handleRun(idx)} disabled={isRunning || isChecking}
                        className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                        <Play className="w-3.5 h-3.5" />
                        {isRunning ? "실행 중..." : "실행"}
                      </Button>
                      <Button size="sm" onClick={() => handleCheck(idx, ec)} disabled={isRunning || isChecking}
                        className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                        <CheckSquare className="w-3.5 h-3.5" />
                        {isChecking ? "확인 중..." : "작성 확인"}
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => {
                          setStudentCodes(c => ({ ...c, [idx]: starterCode || "" }));
                          setResults(r => ({ ...r, [idx]: null }));
                          saveCode(idx, starterCode || "");
                          saveResult(idx, null);
                        }}>
                        <RefreshCw className="w-3.5 h-3.5" />초기화
                      </Button>
                    </div>

                    {result && (
                      <div className="mt-2 rounded-lg border p-2 text-xs font-mono bg-gray-950 border-gray-700 text-gray-200">
                        <p className={`text-xs font-semibold mb-1 font-sans ${result.error ? "text-red-400" : "text-green-400"}`}>
                          {result.error ? "❌ 에러" : "✅ 실행 결과"}
                        </p>
                        <pre className="whitespace-pre-wrap break-all">{result.error || result.output || "(출력 없음)"}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}