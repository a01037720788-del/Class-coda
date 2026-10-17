import React, { useState, useEffect } from "react";
import { runPython } from "@/lib/codeRunner";
import { saveExamplePractice } from "@/lib/dataAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronUp, Eye, Send, Maximize2, Minimize2 } from "lucide-react";
import PythonCodeEditor from "./PythonCodeEditor";
import { useTheme, DEFAULT_THEME } from "@/hooks/useTheme";
import { storageKeys, storageSave, storageLoad } from "@/lib/storageService";
import { useToast } from "@/components/ui/use-toast";
import { compareOutput, countInputCalls } from "@/lib/stdinUtils";
import StdinInput from "./StdinInput";
import { getSessionToken } from "@/lib/auth";

// 학생·유닛별 완료 예제 목록 (저장 성공한 항목만 보관)
const exampleCompletionKey = (sid, unitId) => `coda_example_completed_${sid}_${unitId}`;
const normalizeIds = (ids) => (Array.isArray(ids) ? ids : [])
  .map(Number).filter(Number.isInteger);

export default function ExampleCodePanel({ exampleCodes = [], user, unitId, unitTitle, progress, onProgressUpdate, unitType }) {
  const { toast } = useToast();
  const [studentCodes, setStudentCodes] = useState({});
  const [results, setResults] = useState({});
  const [running, setRunning] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const [showCompleted, setShowCompleted] = useState(true);
  const [localCompleted, setLocalCompleted] = useState([]);
  const [stdinValues, setStdinValues] = useState({});
  const [expandedEditors, setExpandedEditors] = useState({});
  useEffect(() => {
    if (!Object.values(expandedEditors).some(Boolean)) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setExpandedEditors({});
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [expandedEditors]);


  const sid = user?.student_id;
  const { theme } = useTheme(sid);

  const completedIds = [...new Set([
    ...normalizeIds(progress?.completed_example_ids),
    ...normalizeIds(localCompleted),
  ])].filter(idx => idx >= 0 && idx < exampleCodes.length);

  useEffect(() => {
    if (!sid || !unitId) return;
    const codes = {};
    const res = {};
    exampleCodes.forEach((_, idx) => {
      const saved = storageLoad(storageKeys.pythonExampleCode(sid, unitId, idx));
      if (saved) codes[idx] = saved;
      const savedResult = storageLoad(storageKeys.pythonExampleResult(sid, unitId, idx));
      if (savedResult) res[idx] = savedResult;
    });
    setStudentCodes(codes);
    setResults(res);
    setLocalCompleted(normalizeIds(storageLoad(exampleCompletionKey(sid, unitId), [])));
  }, [sid, unitId, exampleCodes.length]);

  useEffect(() => {
    const init = {};
    completedIds.forEach(idx => { init[idx] = true; });
    setCollapsed(init);
  }, [sid, unitId, progress?.completed_example_ids, localCompleted]);

  const saveCode = (idx, code) => {
    if (sid && unitId) storageSave(storageKeys.pythonExampleCode(sid, unitId, idx), code);
  };
  const saveResult = (idx, data) => {
    if (sid && unitId) storageSave(storageKeys.pythonExampleResult(sid, unitId, idx), data);
  };

  // ── 실행 ──────────────────────────────────────────────────────────────────
  const handleRun = async (idx, ec) => {
    const code = studentCodes[idx] ?? "";
    if (!code.trim()) {
      toast({ title: "코드를 입력해주세요.", variant: "destructive" });
      return;
    }
    setRunning(r => ({ ...r, [idx]: true }));
    try {
      const stdin = stdinValues[idx] || "";
      const data = await runPython({ code, mode: "simple", stdin });
      const output = data?.output || "";
      const error = data?.error || "";

      // input()이 있거나 stdin이 있으면 원본 코드를 같은 stdin으로 실행하여 동적 expected_output 생성
      let expected = ec.expected_output || "";
      const inputCount = countInputCalls(ec.code || "");
      if ((inputCount > 0 || stdin) && ec.code) {
        try {
          const origData = await runPython({ code: ec.code, mode: "simple", stdin });
          if (!origData?.error) {
            expected = origData.output || "";
          }
        } catch (e) {
          // 원본 실행 실패 시 저장된 expected_output 사용
        }
      }

      const isCorrect = !error && (!expected || compareOutput(output, expected, "normalize", code));
      const matchStatus = error ? "error" : expected ? (isCorrect ? "match" : "mismatch") : "none";
      const resultData = { output, error, matchStatus, isCorrect };

      setResults(r => ({ ...r, [idx]: resultData }));
      saveResult(idx, resultData);
    } catch (error) {
      console.error("예제 코드 실행 실패:", error);
      const errMsg = error?.response?.data?.error || error?.message || "실행 중 오류가 발생했습니다.";
      setResults(r => ({ ...r, [idx]: { output: "", error: errMsg, matchStatus: "error", isCorrect: false } }));
      toast({ title: "코드 실행 실패", description: errMsg, variant: "destructive" });
    } finally {
      setRunning(r => ({ ...r, [idx]: false }));
    }
  };

  // ── 제출 ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (idx, ec) => {
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
    const stdin = stdinValues[idx] || "";

    setSubmitting(s => ({ ...s, [idx]: true }));
    try {
      // 아직 실행 결과가 없으면 자동 실행
      let resultData = results[idx];
      let expected = ec.expected_output || "";

      // input()이 있거나 stdin이 있으면 원본 코드를 같은 stdin으로 실행하여 동적 expected_output 생성
      const inputCount = countInputCalls(ec.code || "");
      if ((inputCount > 0 || stdin) && ec.code) {
        try {
          const origData = await runPython({ code: ec.code, mode: "simple", stdin });
          if (!origData?.error) {
            expected = origData.output || "";
          }
        } catch (e) {
          // 원본 실행 실패 시 저장된 expected_output 사용
        }
      }

      if (!resultData) {
        setRunning(r => ({ ...r, [idx]: true }));
        try {
          const data = await runPython({ code, mode: "simple", stdin });
          const output = data?.output || "";
          const error = data?.error || "";

          const isCorrect = !error && (!expected || compareOutput(output, expected, "normalize", code));
          const matchStatus = error ? "error" : expected ? (isCorrect ? "match" : "mismatch") : "none";
          resultData = { output, error, matchStatus, isCorrect };
          setResults(r => ({ ...r, [idx]: resultData }));
          saveResult(idx, resultData);
        } catch (runErr) {
          const errMsg = runErr?.response?.data?.error || runErr?.message || "실행 오류";
          toast({ title: "코드 실행 실패", description: errMsg, variant: "destructive" });
          return;
        } finally {
          setRunning(r => ({ ...r, [idx]: false }));
        }
      }

      const output = resultData?.output || "";
      const error = resultData?.error || "";
      const isCorrect = !error && (!expected || compareOutput(output, expected, "normalize", code));

      // 정답이면 진행도 데이터 준비 (단일 RPC로 submission + progress 저장)
      let progressUpdate = null;
      if (isCorrect && !completedIds.includes(idx)) {
        const newCompleted = [...new Set([...completedIds, idx])];
        const total = exampleCodes.length;
        const rate = total > 0 ? (newCompleted.length / total) * 100 : 0;
        progressUpdate = {
          completed_example_ids: newCompleted,
          current_example_index: newCompleted.length,
          example_progress_rate: rate,
          last_studied_at: new Date().toISOString(),
        };
      }

      // UnitExamplePractice 저장 + 진행도 업데이트 (단일 RPC)
      try {
        await saveExamplePractice(sid, unitId, idx, {
          filename: ec.filename || "",
          typed_code: code,
          stdin: stdin,
          execution_result: error || output,
          expected_output: expected,
          is_matched: isCorrect,
        }, { studentName: user?.name || "", unitTitle: unitTitle || "", unitType }, progressUpdate);
      } catch (dbErr) {
        console.error("[ExampleCodePanel] 제출 기록 저장 실패:", {
          errorMessage: dbErr?.message,
          studentId: sid, unitId, exampleIndex: idx,
          itemType: "example",
          hasSessionToken: !!getSessionToken(),
        });
        const isMismatch = (dbErr?.message || "").includes("일치하지 않습니다");
        toast({
          title: isMismatch ? "계정 연결 오류" : "저장 실패",
          description: isMismatch
            ? "학생 계정 연결 정보가 일치하지 않습니다."
            : isCorrect
              ? "정답입니다. 다만 제출 기록 저장에 실패했습니다."
              : "코드 실행은 완료되었지만 제출 기록 저장에 실패했습니다. 다시 시도해 주세요.",
          variant: "destructive",
        });
        return;
      }

      // 정답이면 로컬 완료 상태 업데이트
      if (isCorrect && !completedIds.includes(idx)) {
        setLocalCompleted(prev => {
          const next = [...new Set([...normalizeIds(prev), idx])];
          storageSave(exampleCompletionKey(sid, unitId), next);
          return next;
        });
        setCollapsed(c => ({ ...c, [idx]: true }));
        if (onProgressUpdate) onProgressUpdate();
        toast({ title: "✅ 제출 완료!", description: "정답입니다! 예제를 완료했습니다." });
      } else if (isCorrect) {
        toast({ title: "✅ 제출 완료!", description: "이미 완료된 예제입니다." });
      } else {
        toast({ title: "📝 제출 완료", description: error ? "에러가 있습니다. 다시 확인해 주세요." : "결과가 다릅니다. 다시 확인해 주세요." });
      }
    } finally {
      setSubmitting(s => ({ ...s, [idx]: false }));
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
        const isSubmitting = !!submitting[idx];
        const isExpanded = !!expandedEditors[idx];

        if (isCompleted && !showCompleted) return null;

        return (
          <div key={idx} className={`border rounded-xl overflow-hidden transition-all ${isCompleted ? "border-green-300" : "border-gray-200"}`}>
            <div
              className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer ${isCompleted ? "bg-green-50" : "bg-gray-50"} border-b border-gray-200`}
              onClick={() => setCollapsed(c => ({ ...c, [idx]: !c[idx] }))}>
              <span className="text-xs font-bold text-gray-500">예제 {idx + 1}.</span>
              <span className="text-xs font-mono text-blue-600 font-bold">{ec.filename}</span>
              {ec.description && <span className="text-xs text-gray-400 ml-1">{ec.description}</span>}
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
              <div className={`grid grid-cols-1 ${isExpanded ? "fixed inset-0 z-[9999] bg-white grid-cols-2 gap-0 divide-x divide-gray-200 pt-12 overflow-hidden" : "md:grid-cols-2 gap-0 md:divide-x divide-gray-200"}`}>
                {isExpanded && <div className="absolute inset-x-0 top-0 h-12 bg-slate-900 text-white flex items-center justify-between px-4 z-10"><span className="font-semibold text-sm">예제 {idx + 1} · 전체 화면 (원본 코드 50% / 작성 코드 50%)</span><Button type="button" size="sm" variant="outline" className="bg-white text-slate-900" onClick={() => setExpandedEditors(v => ({ ...v, [idx]: false }))}><Minimize2 className="w-4 h-4 mr-1" />전체 화면 닫기</Button></div>}
                {/* 원본 코드 */}
                <div className={`p-4 ${isExpanded ? "min-w-0 h-full overflow-y-auto" : ""}`}>
                  <div className="flex items-center justify-between gap-2 mb-2"><p className="text-xs font-semibold text-gray-500">📖 원본 코드</p><Button type="button" size="sm" variant="outline" onClick={() => setExpandedEditors(s => ({...s, [idx]: !s[idx]}))} className="gap-1 text-xs">{isExpanded ? <Minimize2 className="w-3.5 h-3.5"/> : <Maximize2 className="w-3.5 h-3.5"/>}{isExpanded ? "전체 화면 닫기" : "전체 화면"}</Button></div>
                  <div
                    className="rounded-lg p-4 font-mono text-sm whitespace-pre overflow-auto"
                    style={{
                      minHeight: isExpanded ? "65vh" : "160px",
                      maxHeight: isExpanded ? "75vh" : "300px",
                      backgroundColor: theme.example_code_bg || DEFAULT_THEME.example_code_bg,
                      color: theme.example_code_text || DEFAULT_THEME.example_code_text,
                      userSelect: "none", WebkitUserSelect: "none",
                    }}
                    onCopy={e => e.preventDefault()}
                    onCut={e => e.preventDefault()}
                    onContextMenu={e => e.preventDefault()}
                  >
                    {ec.code || "# 코드가 없습니다."}
                  </div>
                  <div className="mt-2">
                    <StdinInput
                      value={stdinValues[idx] || ""}
                      onChange={v => {
                        setStdinValues(s => ({ ...s, [idx]: v }));
                        setResults(r => ({ ...r, [idx]: null }));
                      }}
                      code={ec.code || ""}
                      defaultStdin={ec.default_stdin || ""}
                      description={ec.stdin_description || ""}
                      forceShow={ec.uses_input === true}
                    />
                  </div>
                </div>

                {/* 학생 에디터 */}
                <div className={`p-4 ${isExpanded ? "min-w-0 h-full overflow-y-auto" : ""}`}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">✏️ 직접 따라쓰기</p>
                  <PythonCodeEditor
                    value={studentCode}
                    onChange={v => {
                      setStudentCodes(c => ({ ...c, [idx]: v }));
                      setResults(r => ({ ...r, [idx]: null }));
                      saveCode(idx, v);
                    }}
                    defaultCode=""
                    showRunButton={false}
                    height={isExpanded ? "70vh" : "160px"}
                    bgColor={theme.student_code_bg}
                    textColor={theme.student_code_text}
                    hideStdin
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => handleRun(idx, ec)} disabled={isRunning || isSubmitting}
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                      <Play className="w-3.5 h-3.5" />
                      {isRunning ? "실행 중..." : "실행"}
                    </Button>
                    <Button size="sm" onClick={() => handleSubmit(idx, ec)} disabled={isRunning || isSubmitting}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                      <Send className="w-3.5 h-3.5" />
                      {isSubmitting ? "제출 중..." : "제출"}
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => {
                        setStudentCodes(c => ({ ...c, [idx]: "" }));
                        setResults(r => ({ ...r, [idx]: null }));
                        saveCode(idx, "");
                        saveResult(idx, {});
                      }}>
                      <RefreshCw className="w-3.5 h-3.5" />초기화
                    </Button>
                  </div>

                  {result && (
                    <div className="mt-2 space-y-2">
                      <div className="rounded-lg border p-2 text-xs font-mono"
                        style={{ backgroundColor: theme.result_bg || DEFAULT_THEME.result_bg, color: theme.result_text || DEFAULT_THEME.result_text }}>
                        <p className={`text-xs font-semibold mb-1 font-sans ${result.error ? "text-red-400" : "text-green-400"}`}>
                          {result.error ? "❌ 에러" : "✅ 실행 결과"}
                        </p>
                        <pre className="whitespace-pre-wrap">{result.error || result.output || "(출력 없음)"}</pre>
                      </div>
                      {result.matchStatus && result.matchStatus !== "none" && (
                        <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-semibold ${
                          result.matchStatus === "match" ? "bg-green-50 text-green-700 border border-green-200"
                          : result.matchStatus === "error" ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                        }`}>
                          {result.matchStatus === "match" && <><CheckCircle2 className="w-4 h-4" />확인되었습니다 ✅</>}
                          {result.matchStatus === "mismatch" && <><XCircle className="w-4 h-4" />결과가 다릅니다. 다시 확인해 주세요.</>}
                          {result.matchStatus === "error" && <><XCircle className="w-4 h-4" />에러가 발생했습니다.</>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}