import React, { useState, useRef, useEffect } from "react";
import { runPython } from "@/lib/codeRunner";
import { saveMissionSubmission } from "@/lib/dataAccess";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle2, ChevronDown, ChevronUp, ChevronsUpDown, Circle } from "lucide-react";
import PythonCodeEditor from "./PythonCodeEditor";
import { useToast } from "@/components/ui/use-toast";
import { getSessionToken } from "@/lib/auth";

import { storageKeys, storageSave, storageLoad } from "@/lib/storageService";
import { compareOutput } from "@/lib/stdinUtils";

// 미션별로 독립된 키 사용 (unitId + missionNumber)
function loadSavedMission(unitId, mNum) {
  return storageLoad(storageKeys.pythonMissionState(unitId, mNum), null);
}
function saveMissionToDisk(unitId, mNum, data) {
  storageSave(storageKeys.pythonMissionState(unitId, mNum), data);
}

// ─── 애니메이션 래퍼 ──────────────────────────────────────────────────────────
function Collapsible({ open, children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(open ? "auto" : "0px");
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        if (ref.current) setHeight(`${ref.current.scrollHeight}px`);
        setTimeout(() => setHeight("auto"), 300);
      });
    } else {
      if (ref.current) setHeight(`${ref.current.scrollHeight}px`);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight("0px"));
      });
      setTimeout(() => setVisible(false), 300);
    }
  }, [open]);

  return (
    <div style={{ height, overflow: "hidden", transition: "height 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
      <div ref={ref}>
        {visible && children}
      </div>
    </div>
  );
}

export default function MissionPanel({ missions = [], user, unitId, unitTitle, progress, onProgressUpdate, unitType }) {
  const { toast } = useToast();
  const [codes, setCodes] = useState({});
  const [stdinInputs, setStdinInputs] = useState({});
  const [runResults, setRunResults] = useState({});
  const [submitting, setSubmitting] = useState({});
  // 미션별 제출 상태를 미션 번호(mNum) 기준으로 관리
  const [submitted, setSubmitted] = useState({});
  // openIdx: 현재 열린 미션 인덱스 (null = 모두 접힘, 한 번에 하나만)
  const [openIdx, setOpenIdx] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);

  // 미션 로드 시 각 미션의 저장된 상태 복원
  useEffect(() => {
    const restored = {};
    missions.forEach(m => {
      const mNum = m.number || missions.indexOf(m) + 1;
      const saved = loadSavedMission(unitId, mNum);
      if (saved) restored[mNum] = saved;
    });
    setSubmitted(restored);
  }, [unitId, missions.length]);

  const getSid = () => user?.student_id;
  const completedIds = (Array.isArray(progress?.completed_mission_ids)
    ? progress.completed_mission_ids : []).map(Number).filter(Number.isFinite);
  const isMissionCompleted = (index, missionNumber) =>
    completedIds.includes(index) ||
    (submitted[missionNumber]?.isCorrect === true && submitted[missionNumber]?.saveFailed !== true);

  const toggle = (i) => {
    setOpenIdx(prev => prev === i ? null : i);
  };

  const handleRun = (mNum, data) => setRunResults(r => ({ ...r, [mNum]: data }));

  const handleSubmit = async (m, mIdx, mNum) => {
    const student_id = getSid();
    if (!student_id) {
      toast({ title: "학생 정보를 찾을 수 없습니다.", variant: "destructive" });
      return;
    }
    // 세션 토큰 사전 확인 — 없으면 401이 아니라 명확한 메시지
    if (!getSessionToken()) {
      toast({ title: "세션 만료", description: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.", variant: "destructive" });
      return;
    }

    const code = codes[mNum] || m.default_code || `print("Hello CODA")`;
    if (!code.trim()) return;
    setSubmitting(s => ({ ...s, [mNum]: true }));
    const stdin = stdinInputs[mNum] || "";
    const gradingMode = m.grading_mode || "normalize";
    const testCases = m.test_cases || [];

    try {
      let isCorrect = false;
      let execResult = runResults[mNum];
      let output = "";
      let error = "";
      const expected = m.expected_output || "";
      let testCaseResults = [];

      // ── 1단계: 코드 실행 / 채점 ──────────────────────────────────────────
      if (testCases.length > 0) {
        try {
          const judgeData = await runPython({ code, mode: "judge", test_cases: testCases });
          isCorrect = judgeData.verdict === "AC";
          testCaseResults = (judgeData.results || []).map(r => ({
            input: r.input, expected_output: r.expected_output,
            actual_output: r.actual_output, passed: r.passed,
          }));
          output = `${judgeData.passed}/${judgeData.total} 테스트케이스 통과`;
          execResult = { output, error: "", verdict: judgeData.verdict };
          setRunResults(r => ({ ...r, [mNum]: execResult }));
        } catch (judgeErr) {
          console.error("[MissionPanel] 채점 실패:", judgeErr);
          toast({
            title: "코드 실행 서버 연결 실패",
            description: "코드 실행 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (!execResult) {
          try {
            execResult = await runPython({ code, mode: "simple", stdin });
            setRunResults(r => ({ ...r, [mNum]: execResult }));
          } catch (runErr) {
            console.error("[MissionPanel] 코드 실행 실패:", runErr);
            toast({
              title: "코드 실행 서버 연결 실패",
              description: "코드 실행 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
              variant: "destructive",
            });
            return;
          }
        }
        output = execResult?.output || "";
        error = execResult?.error || "";
        isCorrect = expected ? (!error && compareOutput(output, expected, gradingMode, code)) : true;
      }

      // ── 2단계: DB 제출 저장 + 진행도 업데이트 (단일 RPC 트랜잭션) ────────
      const shouldUnlock = isCorrect === true;
      let progressUpdate = null;
      if (shouldUnlock && !completedIds.includes(mIdx)) {
        const locallyCompleted = missions.flatMap((mission, index) => {
          const number = mission.number || index + 1;
          return submitted[number]?.isCorrect === true && submitted[number]?.saveFailed !== true
            ? [index] : [];
        });
        const newCompleted = [...new Set([...completedIds, ...locallyCompleted, mIdx])];
        const total = missions.length;
        const rate = total > 0 ? (newCompleted.length / total) * 100 : 0;
        progressUpdate = {
          completed_mission_ids: newCompleted,
          current_mission_index: newCompleted.length,
          mission_progress_rate: rate,
          last_studied_at: new Date().toISOString(),
        };
      }

      // 이미 완료된 미션의 재도전은 채점만 수행하고 중복 저장하지 않습니다.
      if (completedIds.includes(mIdx)) {
        const subData = { done: true, isCorrect, output };
        setSubmitted(prev => ({ ...prev, [mNum]: subData }));
        toast({ title: isCorrect ? "재도전 정답!" : "재도전 결과", description: isCorrect ? "완료 기록은 유지됩니다." : "다시 시도해 보세요. 기존 완료 기록은 유지됩니다." });
        return;
      }

      try {
        await saveMissionSubmission(student_id, unitId, mNum, {
          mission_description: m.description || "",
          submitted_code: code,
          submitted_stdin: stdin,
          execution_result: error || output,
          expected_output: expected,
          is_correct: isCorrect,
          grading_mode: gradingMode,
          ...(testCaseResults.length > 0 ? { test_case_results: testCaseResults } : {}),
        }, { studentName: user?.name || "", unitTitle: unitTitle || "", unitType }, progressUpdate);

        toast({ title: "✅ 제출 완료!", description: isCorrect ? "정답입니다!" : "제출이 저장되었습니다." });
        if (progressUpdate) setOpenIdx(null);
      } catch (dbError) {
        console.error("[MissionPanel] 제출 기록 저장 실패:", {
          errorMessage: dbError?.message,
          studentId: student_id,
          unitId, missionNumber: mNum,
          itemType: "mission",
          hasSessionToken: !!getSessionToken(),
        });
        // 실행은 성공했지만 저장 실패 — 구분해서 메시지 표시
        const isMismatch = (dbError?.message || "").includes("일치하지 않습니다");
        toast({
          title: isMismatch ? "계정 연결 오류" : "저장 실패",
          description: isMismatch
            ? "학생 계정 연결 정보가 일치하지 않습니다."
            : isCorrect
              ? "정답입니다. 다만 제출 기록 저장에 실패했습니다."
              : "코드 실행은 완료되었지만 제출 기록 저장에 실패했습니다.",
          variant: "destructive",
        });
        // UI에는 결과 표시 (정답 판정은 유지)
        const subData = { done: true, isCorrect, output, saveFailed: true };
        setSubmitted(prev => ({ ...prev, [mNum]: subData }));
        saveMissionToDisk(unitId, mNum, subData);
        return;
      }

      const subData = { done: true, isCorrect, output };
      setSubmitted(prev => ({ ...prev, [mNum]: subData }));
      saveMissionToDisk(unitId, mNum, subData);
      if (onProgressUpdate) await onProgressUpdate();
    } catch (error) {
      console.error("[MissionPanel] 제출 중 예외:", error);
      toast({ title: "제출에 실패했습니다.", description: error?.message || "오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setSubmitting(s => ({ ...s, [mNum]: false }));
    }
  };

  if (!missions.length) {
    return <p className="text-gray-400 text-sm text-center py-8">Mission이 없습니다.</p>;
  }

  const completedCount = missions.filter((m, i) => isMissionCompleted(i, m.number || i + 1)).length;
  const totalCount = missions.length;

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500">완료 {completedCount}/{totalCount}개</p>
        <button onClick={() => setShowCompleted(s => !s)}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition-colors hover:bg-gray-50">
          <ChevronsUpDown className="w-3 h-3" />
          {showCompleted ? "완료 항목 숨기기" : "완료 항목 보기"}
        </button>
      </div>

      {missions.map((m, i) => {
        const mNum = m.number || i + 1;
        const isCompleted = isMissionCompleted(i, mNum);
        const code = codes[mNum] ?? m.default_code ?? `print("Hello CODA")`;
        const runResult = runResults[mNum];
        const sub = submitted[mNum];
        const isOpen = openIdx === i;

        if (isCompleted && !showCompleted) return null;

        // 상태 아이콘
        const StatusIcon = () => {
          if (isCompleted) return <span className="text-base leading-none">✅</span>;
          if (sub && !sub.isCorrect) return <span className="text-base leading-none">🟡</span>;
          return <span className="text-gray-300"><Circle className="w-4 h-4" /></span>;
        };

        const borderColor = isCompleted ? "border-green-300" : isOpen ? "border-orange-300" : "border-gray-200";
        const headerBg = isOpen
          ? (isCompleted ? "bg-green-50" : "bg-orange-50")
          : (isCompleted ? "bg-green-50/50 hover:bg-green-50" : "bg-gray-50 hover:bg-gray-100");

        return (
          <div key={i}
            className={`border-2 rounded-2xl overflow-hidden transition-all duration-200 ${borderColor} ${isOpen ? "shadow-md" : "shadow-sm"}`}>
            {/* 헤더 */}
            <div
              className={`px-4 py-4 sm:py-3 flex items-center justify-between cursor-pointer transition-colors ${headerBg}`}
              onClick={() => toggle(i)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <StatusIcon />
                <span className={`font-bold text-sm flex-shrink-0 ${isCompleted ? "text-green-700" : isOpen ? "text-orange-700" : "text-gray-800"}`}>
                  Mission {String(mNum).padStart(2, "0")}.
                </span>
                {m.title && (
                  <span className={`text-sm font-semibold truncate ${isCompleted ? "text-green-600" : "text-gray-700"}`}>
                    {m.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {isCompleted && <span className="text-xs text-green-600 font-semibold hidden sm:inline">완료</span>}
                {sub && !sub.isCorrect && !isCompleted && <span className="text-xs text-amber-600 font-semibold hidden sm:inline">재도전</span>}
                {isOpen
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            {/* 펼쳐지는 본문 — 애니메이션 */}
            <Collapsible open={isOpen}>
              <div className="border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-gray-200">
                  {/* 왼쪽: 미션 정보 */}
                  <div className="p-5 sm:p-6 space-y-3 bg-white">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">📋 미션 설명</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{m.description}</p>
                    </div>
                    {m.input_condition && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-blue-600 mb-1">📥 입력 조건</p>
                        <p className="text-xs text-blue-800 whitespace-pre-wrap">{m.input_condition}</p>
                      </div>
                    )}
                    {m.output_condition && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-purple-600 mb-1">📤 출력 조건</p>
                        <p className="text-xs text-purple-800 whitespace-pre-wrap">{m.output_condition}</p>
                      </div>
                    )}
                    {m.example && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">💡 예시</p>
                        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">{m.example}</pre>
                      </div>
                    )}
                    {m.expected_output && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-green-600 mb-1">✅ 예상 출력</p>
                        <pre className="text-xs font-mono text-green-800">{m.expected_output}</pre>
                      </div>
                    )}
                  </div>

                  {/* 오른쪽: 코드 에디터 */}
                  <div className="p-5 sm:p-6 flex flex-col gap-3 bg-white">
                    <p className="text-xs font-semibold text-gray-500">💻 코드 작성</p>
                    <PythonCodeEditor
                      value={code}
                      onChange={v => { setCodes(c => ({ ...c, [mNum]: v })); setRunResults(r => ({ ...r, [mNum]: null })); }}
                      defaultCode={m.default_code || `print("Hello CODA")`}
                      showRunButton={true}
                      onRun={data => handleRun(mNum, data)}
                      height="220px"
                      stdin={stdinInputs[mNum] || ""}
                      onStdinChange={v => { setStdinInputs(s => ({ ...s, [mNum]: v })); setRunResults(r => ({ ...r, [mNum]: null })); }}
                      defaultStdin={m.default_stdin || ""}
                      stdinDescription={m.stdin_description || ""}
                      forceShowStdin={m.uses_input === true}
                    />
                    <Button onClick={() => handleSubmit(m, i, mNum)} disabled={submitting[mNum]}
                      className={`gap-2 ${isCompleted ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}`}>
                      {isCompleted
                        ? <><CheckCircle2 className="w-4 h-4" />다시 제출하기</>
                        : <><Send className="w-4 h-4" />{submitting[mNum] ? "제출 중..." : "제출하기"}</>}
                    </Button>
                    {sub && (
                      <div className={`text-sm p-3 rounded-xl border font-semibold ${sub.isCorrect ? "bg-green-50 border-green-200 text-green-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"}`}>
                        {sub.isCorrect ? "🎉 정답! 미션 완료!" : "💡 예상 출력과 다릅니다. 다시 확인해 보세요."}
                      </div>
                    )}
                    {runResult && m.expected_output && !sub && (
                      <div className={`text-xs p-2.5 rounded-xl border font-semibold ${
                        (runResult.output || "").trim() === m.expected_output.trim() && !runResult.error
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-yellow-50 border-yellow-200 text-yellow-700"
                      }`}>
                        {(runResult.output || "").trim() === m.expected_output.trim() && !runResult.error
                          ? "🎉 예상 출력과 일치합니다!" : "💡 예상 출력과 다릅니다. 다시 확인해 보세요."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}