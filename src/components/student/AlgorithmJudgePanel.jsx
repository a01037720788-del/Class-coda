import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  CheckCircle, XCircle, AlertTriangle, Clock, Terminal, Play, Send, Loader2,
  ChevronLeft, ChevronRight, Eye, EyeOff
} from "lucide-react";
import { runPython } from "@/lib/codeRunner";
import { useToast } from "@/components/ui/use-toast";

const VERDICT_INFO = {
  AC: { label: "✅ 정답", color: "text-green-600", bg: "bg-green-50", icon: CheckCircle },
  WA: { label: "❌ 틀렸습니다", color: "text-red-600", bg: "bg-red-50", icon: XCircle },
  RE: { label: "⚠ 실행 오류", color: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
  TLE: { label: "⏱ 시간 초과", color: "text-blue-600", bg: "bg-blue-50", icon: Clock },
  CE: { label: "⚠ 컴파일 오류", color: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
  OLE: { label: "⚠ 출력 초과", color: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
};

const STATUS_BADGE = {
  AC: { label: "✅ 정답", className: "bg-green-100 text-green-700" },
  WA: { label: "❌ 틀림", className: "bg-red-100 text-red-700" },
  RE: { label: "⚠ 실행오류", className: "bg-orange-100 text-orange-700" },
  TLE: { label: "⏱ 시간초과", className: "bg-blue-100 text-blue-700" },
  CE: { label: "⚠ 컴파일오류", className: "bg-orange-100 text-orange-700" },
};

function getStorageKey(sid, unitId, problemId) {
  return `algo_code_${sid}_${unitId}_${problemId}`;
}

function loadCodeFromStorage(sid, unitId, problemId) {
  try { return localStorage.getItem(getStorageKey(sid, unitId, problemId)) || ""; }
  catch { return ""; }
}

function saveCodeToStorage(sid, unitId, problemId, code) {
  try { localStorage.setItem(getStorageKey(sid, unitId, problemId), code); }
  catch { /* ignore */ }
}

// 채점 결과 표시
function JudgeResultDisplay({ result }) {
  if (!result) return null;
  const info = VERDICT_INFO[result.verdict] || VERDICT_INFO.WA;
  const Icon = info.icon;
  return (
    <div className={`rounded-xl border-2 p-5 ${info.bg} ${info.color}`}>
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-8 h-8" />
        <div>
          <p className="text-2xl font-bold">{info.label}</p>
          <p className="text-sm opacity-80">테스트 결과 {result.passed_count} / {result.total_count} 통과</p>
        </div>
      </div>
      {/* 테스트케이스별 결과 카드 */}
      <div className="space-y-2">
        {result.results?.map((r, i) => {
          const tcInfo = VERDICT_INFO[r.status] || VERDICT_INFO.WA;
          return (
            <div key={i} className={`rounded-lg p-3 bg-white border ${r.passed ? "border-green-200" : "border-red-200"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-600">테스트 {i + 1}</span>
                <span className={`text-xs font-bold ${tcInfo.color}`}>
                  {r.passed ? "✅ 통과" : tcInfo.label}
                </span>
              </div>
              {r.is_hidden ? (
                <p className="text-xs text-gray-400">숨겨진 테스트케이스</p>
              ) : (
                <div className="space-y-1.5 mt-2">
                  {r.input && (
                    <div>
                      <p className="text-xs text-gray-400">입력:</p>
                      <pre className="text-xs font-mono bg-gray-50 rounded p-1.5 whitespace-pre-wrap">{r.input}</pre>
                    </div>
                  )}
                  {r.expected_output && (
                    <div>
                      <p className="text-xs text-gray-400">기대 출력:</p>
                      <pre className="text-xs font-mono bg-gray-50 rounded p-1.5 whitespace-pre-wrap">{r.expected_output}</pre>
                    </div>
                  )}
                  {r.actual_output !== undefined && !r.passed && (
                    <div>
                      <p className="text-xs text-gray-400">학생 출력:</p>
                      <pre className="text-xs font-mono bg-red-50 rounded p-1.5 whitespace-pre-wrap">{r.actual_output || "(출력 없음)"}</pre>
                    </div>
                  )}
                  {r.error && (
                    <div>
                      <p className="text-xs text-red-400">오류:</p>
                      <pre className="text-xs font-mono bg-red-50 rounded p-1.5 whitespace-pre-wrap text-red-600">{r.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AlgorithmJudgePanel({ unit, user, onProgressUpdate }) {
  const [problems, setProblems] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [code, setCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [runResult, setRunResult] = useState(null);
  const [judgeResult, setJudgeResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problemStatuses, setProblemStatuses] = useState({});
  const { toast } = useToast();
  const sid = user?.student_id;
  const saveTimerRef = useRef(null);

  // 문제 목록 설정
  useEffect(() => {
    const judgeProblems = (unit.judge_problems || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.number ?? 0) - (b.number ?? 0));
    setProblems(judgeProblems);
    setSelectedIdx(0);
  }, [unit.id, unit.judge_problems]);

  // 문제 상태 로드 (제출 기록에서 최신 verdict 조회)
  // Base44 entities는 학생(Supabase 인증)에게 401을 반환하므로
  // Supabase student_submissions 테이블에서 algorithm_problem 타입으로 조회
  const loadProblemStatuses = useCallback(async () => {
    if (!sid || !unit.id) return;
    try {
      const rows = await base44.entities.AlgorithmJudgeSubmission.filter({
        student_id: sid,
        unit_id: unit.id,
      });
      const statuses = {};
      (rows || []).forEach(r => {
        if (!r.problem_id) return;
        const prev = statuses[r.problem_id];
        if (!prev || (r.submitted_at || "") > (prev.submitted_at || "")) {
          statuses[r.problem_id] = { verdict: r.verdict, submitted_at: r.submitted_at };
        }
      });
      setProblemStatuses(statuses);
    } catch (e) {
      console.warn("[AlgorithmJudge] 제출 기록 로드 실패:", e?.message);
    }
  }, [sid, unit.id]);

  useEffect(() => { loadProblemStatuses(); }, [loadProblemStatuses]);

  // 선택된 문제 코드 로드 (localStorage)
  useEffect(() => {
    const p = problems[selectedIdx];
    if (!p) return;
    const saved = loadCodeFromStorage(sid, unit.id, p.id);
    setCode(saved || p.default_code || "");
    setStdin(p.sample_input || "");
    setRunResult(null);
    setJudgeResult(null);
  }, [selectedIdx, problems, sid, unit.id]);

  // 코드 자동 저장 (디바운스)
  useEffect(() => {
    const p = problems[selectedIdx];
    if (!p || !code) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCodeToStorage(sid, unit.id, p.id, code);
    }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [code, selectedIdx, problems, sid, unit.id]);

  const currentProblem = problems[selectedIdx];

  // 실행: 학생 stdin으로 한 번 실행 (채점 아님)
  const handleRun = async () => {
    if (!currentProblem) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await runPython({ code, stdin });
      setRunResult(res);
    } catch (err) {
      setRunResult({ output: "", error: err.message, exit_code: 1 });
    } finally {
      setRunning(false);
    }
  };

  // 제출: 서버에서 모든 테스트케이스 채점
  const handleSubmit = async () => {
    if (!currentProblem) return;
    setSubmitting(true);
    setJudgeResult(null);
    try {
      const res = await base44.functions.invoke("judgeAlgorithmProblem", {
        unit_id: unit.id,
        problem_id: currentProblem.id,
        code,
        student_id: sid,
        student_name: user?.name || "",
      });
      const result = res.data || res;
      setJudgeResult(result);
      if (result.verdict === "AC") {
        toast({ title: "✅ 정답!", description: `${result.passed_count} / ${result.total_count} 통과` });
      } else {
        const info = VERDICT_INFO[result.verdict] || VERDICT_INFO.WA;
        toast({ title: info.label, description: `${result.passed_count} / ${result.total_count} 통과`, variant: "destructive" });
      }
      loadProblemStatuses();
      onProgressUpdate?.();
    } catch (err) {
      const status = err?.response?.status || err?.status;
      const isAuthErr = status === 401 || (err?.message || "").includes("401");
      console.error("[AlgorithmJudge] 채점 실패:", {
        httpStatus: status,
        errorMessage: err?.message,
        isAuthErr,
      });
      toast({
        title: isAuthErr ? "채점 서버 인증 실패" : "채점 실패",
        description: isAuthErr
          ? "채점 서버 인증에 실패했습니다. 잠시 후 다시 시도해 주세요."
          : err?.message || "채점 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (problems.length === 0) {
    return <div className="p-5 text-center text-gray-400 text-sm py-12">알고리즘 문제가 없습니다.</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-3">
      {/* 문제 목록 */}
      <div className="lg:w-56 flex-shrink-0">
        <p className="text-xs font-bold text-gray-500 mb-2">문제 목록 ({problems.length})</p>
        <div className="space-y-1">
          {problems.map((p, i) => {
            const status = problemStatuses[p.id];
            const badge = status ? STATUS_BADGE[status.verdict] : null;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedIdx(i)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                  i === selectedIdx ? "bg-violet-100 text-violet-800 border border-violet-300" : "bg-white border border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span className="truncate">문제 {p.number || i + 1}. {p.title || "제목 없음"}</span>
                {badge ? (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>{badge.label}</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">미제출</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 문제 상세 */}
      <div className="flex-1 min-w-0 space-y-4">
        {currentProblem && (
          <>
            {/* 문제 설명 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900">문제 {currentProblem.number}. {currentProblem.title}</h3>
                <Badge variant="outline" className="text-xs">{currentProblem.difficulty || "하"}</Badge>
                <Badge variant="outline" className="text-xs">⏱ {currentProblem.time_limit || 2}초</Badge>
                <Badge variant="outline" className="text-xs">💾 {currentProblem.memory_limit || 256}MB</Badge>
              </div>
              {currentProblem.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentProblem.description}</p>
              )}
              {currentProblem.input_desc && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">입력</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentProblem.input_desc}</p>
                </div>
              )}
              {currentProblem.output_desc && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">출력</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentProblem.output_desc}</p>
                </div>
              )}
              {currentProblem.constraints && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">제한</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentProblem.constraints}</p>
                </div>
              )}
              {currentProblem.sample_input && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">예제 입력</p>
                    <pre className="text-xs font-mono bg-gray-900 text-green-300 rounded-lg p-2 whitespace-pre-wrap">{currentProblem.sample_input}</pre>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">예제 출력</p>
                    <pre className="text-xs font-mono bg-gray-900 text-green-300 rounded-lg p-2 whitespace-pre-wrap">{currentProblem.sample_output}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* 코드 에디터 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700 flex items-center gap-1"><Terminal className="w-4 h-4 text-violet-600" />코드 작성</p>
                <span className="text-xs text-gray-400">자동 저장됨</span>
              </div>
              <Textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="여기에 코드를 작성하세요"
                className="font-mono text-xs min-h-[200px] resize-y"
                spellCheck={false}
              />
              {/* 표준 입력 */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">표준 입력 (실행 버튼에서만 사용)</p>
                <Textarea
                  value={stdin}
                  onChange={e => setStdin(e.target.value)}
                  placeholder="예제 입력을 넣고 실행해 보세요"
                  className="font-mono text-xs min-h-[60px] resize-y"
                  spellCheck={false}
                />
              </div>
              {/* 버튼 */}
              <div className="flex gap-2">
                <Button onClick={handleRun} disabled={running} variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50">
                  {running ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />실행 중...</> : <><Play className="w-4 h-4 mr-1" />실행</>}
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="bg-violet-600 hover:bg-violet-700">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />채점 중...</> : <><Send className="w-4 h-4 mr-1" />제출</>}
                </Button>
              </div>
            </div>

            {/* 실행 결과 */}
            {runResult && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-bold text-gray-700 mb-2">실행 결과</p>
                {runResult.error ? (
                  <div className="text-sm text-red-600">
                    <p className="font-semibold mb-1">⚠ 실행 오류</p>
                    <pre className="text-xs font-mono bg-red-50 rounded p-2 whitespace-pre-wrap">{runResult.error}</pre>
                  </div>
                ) : (
                  <pre className="text-xs font-mono bg-gray-900 text-green-300 rounded-lg p-3 whitespace-pre-wrap min-h-[40px]">{runResult.output || "(출력 없음)"}</pre>
                )}
              </div>
            )}

            {/* 채점 결과 */}
            {judgeResult && <JudgeResultDisplay result={judgeResult} />}
          </>
        )}
      </div>
    </div>
  );
}