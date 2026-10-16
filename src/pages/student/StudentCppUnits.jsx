import React, { useEffect, useState, useCallback } from "react";
import { loadUnits, loadAllProgress, saveProgress, saveMissionSubmission } from "@/lib/dataAccess";
import { getSessionUser, getSessionToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, ChevronLeft, CheckCircle, FileText, Table,
  Code2, HelpCircle, Target, StickyNote, ListChecks
} from "lucide-react";
import CppCodeEditor from "@/components/student/CppCodeEditor";
import CppExamplePractice from "@/components/student/CppExamplePractice";
import QuestionPanel from "@/components/student/QuestionPanel";
import InteractiveCodeBlock from "@/components/student/InteractiveCodeBlock";
import CppUnsupportedNotice from "@/components/student/CppUnsupportedNotice";
import UnitToc from "@/components/student/UnitToc";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_CPP = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello CODA";
    return 0;
}`;

// ─── MissionPanel (C++ inline) ────────────────────────────────────────────────
function CppMissionPanel({ missions, user, unitId, unitTitle, progress, onProgressUpdate }) {
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const [codes, setCodes] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const completed = progress?.completed_mission_ids || [];

  useEffect(() => {
    const init = {};
    missions.forEach((m, i) => {
      const key = `coda_autosave_cpp_mission_${unitId}_${i}`;
      const saved = localStorage.getItem(key) || localStorage.getItem(`autosave_cpp_mission_${unitId}_${i}`);
      init[i] = saved || m.default_code || DEFAULT_CPP;
    });
    setCodes(init);
    setSubmitResult(null);
  }, [missions, unitId, idx]);

  const handleSubmit = async () => {
    if (!user) return;
    // 세션 토큰 사전 확인
    if (!getSessionToken()) {
      toast({ title: "세션 만료", description: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.", variant: "destructive" });
      return;
    }
    const sid = user.student_id;
    if (!sid) {
      toast({ title: "계정 연결 오류", description: "학생 계정이 연결되지 않았습니다. 관리자에게 문의해 주세요.", variant: "destructive" });
      return;
    }
    const mission = missions[idx];
    setSubmitting(true);
    setSubmitResult(null);
    try {
      // C++ 은 실행·자동 채점을 지원하지 않으므로 코드만 제출합니다.
      await saveMissionSubmission(sid, unitId, mission.number || idx + 1, {
        mission_description: mission.description || "",
        submitted_code: codes[idx] || "",
        execution_result: "",
        expected_output: (mission.expected_output || "").trim(),
        is_correct: false,
        grading_supported: false,
      }, { studentName: user.name, unitTitle, unitType: "cpp" }, null);
      toast({ title: "제출 완료", description: "선생님이 직접 확인합니다." });
      setSubmitResult({ submitted: true });
    } catch (dbErr) {
      console.error("[CppMission] 제출 기록 저장 실패:", {
        errorMessage: dbErr?.message,
        studentId: sid, unitId, missionNumber: mission.number || idx + 1,
        itemType: "mission",
        hasSessionToken: !!getSessionToken(),
      });
      toast({ title: "저장 실패", description: "제출 기록 저장에 실패했습니다. 다시 시도해 주세요.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!missions.length) return <p className="text-gray-400 text-sm text-center py-8">미션이 없습니다.</p>;
  const mission = missions[idx];
  const isDone = completed.includes(idx);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {missions.map((m, i) => (
          <button key={i} onClick={() => { setIdx(i); setSubmitResult(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              i === idx ? "bg-blue-700 text-white border-blue-700"
              : completed.includes(i) ? "bg-green-50 text-green-700 border-green-200"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}>
            {completed.includes(i) && <CheckCircle className="w-3 h-3 inline mr-1" />}
            Mission {i + 1}
          </button>
        ))}
      </div>
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-bold text-blue-900 mb-1">{mission.title || `Mission ${idx + 1}`}</h4>
        <p className="text-sm text-blue-800 whitespace-pre-line">{mission.description}</p>
        {mission.example && (
          <div className="mt-2 bg-white rounded-lg p-2 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-1">예시</p>
            <pre className="text-xs text-gray-700 font-mono">{mission.example}</pre>
          </div>
        )}
        {mission.expected_output && (
          <div className="mt-2 bg-white rounded-lg p-2 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-1">예상 출력</p>
            <pre className="text-xs text-gray-700 font-mono">{mission.expected_output}</pre>
          </div>
        )}
      </div>
      <CppUnsupportedNotice className="mb-3" />
      <CppCodeEditor
        value={codes[idx] || mission.default_code || DEFAULT_CPP}
        onChange={v => setCodes(prev => ({ ...prev, [idx]: v }))}
        defaultCode={mission.default_code || DEFAULT_CPP}
        height="220px"
        autoSaveKey={`cpp_mission_${unitId}_${idx}`}
        showRunButton={false}
      />
      <Button onClick={handleSubmit} disabled={submitting}
        className="mt-3 bg-blue-700 hover:bg-blue-800 gap-1.5">
        <Target className="w-3.5 h-3.5" />
        {submitting ? "제출 중..." : "코드 제출"}
      </Button>
      {submitResult && (
        <div className="mt-3 p-3 rounded-lg border text-sm bg-blue-50 border-blue-200 text-blue-800">
          제출되었습니다. C++ 은 자동 채점을 지원하지 않아 선생님이 직접 확인합니다.
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentCppUnits() {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [progresses, setProgresses] = useState([]);
  const [user, setUser] = useState(null);
  const [memo, setMemo] = useState("");
  const [memoSaved, setMemoSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    loadData(u);
  }, []);

  const loadData = async (u) => {
    const data = await loadUnits("cpp");
    setUnits(data);
    const sid = u?.student_id;
    if (sid) {
      const progs = await loadAllProgress(sid);
      setProgresses(progs);
    }
  };

  const getProgress = useCallback((unitId) => progresses.find(p => p.unit_id === unitId), [progresses]);
  const getSid = () => user?.student_id;

  const handleSelectUnit = (unit) => {
    setSelectedUnit(unit);
    setMemoSaved(false);
    const prog = getProgress(unit.id);
    setMemo(prog?.memo || "");
  };

  const refreshProgress = async () => {
    const sid = getSid();
    if (!sid) return;
    const progs = await loadAllProgress(sid);
    setProgresses(progs);
  };

  const handleSaveMemo = async () => {
    if (!user) return;
    const sid = getSid();
    setSaveError(null);
    try {
      await saveProgress(sid, selectedUnit.id, { memo }, { studentName: user.name, unitTitle: selectedUnit.title, unitType: "cpp" });
      await refreshProgress();
      setMemoSaved(true);
      setTimeout(() => setMemoSaved(false), 2000);
    } catch (err) {
      console.error("[CppUnits] 메모 저장 실패:", err);
      setSaveError(err?.message || "메모 저장에 실패했습니다.");
    }
  };

  if (selectedUnit) {
    const progress = getProgress(selectedUnit.id);
    const exCount = selectedUnit.example_codes?.length || 0;
    const qCount = selectedUnit.questions?.length || 0;
    const mCount = selectedUnit.missions?.length || 0;
    const cEx = (progress?.completed_example_ids || []).length;
    const cQ = (progress?.completed_question_ids || []).length;
    const cM = (progress?.completed_mission_ids || []).length;

    return (
      <div className="p-0 max-w-6xl mx-auto">
        <button onClick={() => setSelectedUnit(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" />Unit 목록으로
        </button>

        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm mb-5 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 to-cyan-500 px-6 py-5 text-white">
            <p className="text-sm font-medium opacity-80 mb-1">C++</p>
            <h1 className="text-2xl font-bold">Unit {selectedUnit.unit_number}. {selectedUnit.title}</h1>
            {selectedUnit.subtitle && <p className="text-sm opacity-80 mt-1">{selectedUnit.subtitle}</p>}
          </div>
          <div className="px-6 py-3 bg-blue-50 border-t border-blue-100 flex items-center gap-4 flex-wrap">
            {exCount > 0 && <div className="flex items-center gap-2"><span className="text-xs text-gray-500">예제:</span><span className="text-xs font-bold text-blue-700">{cEx}/{exCount}</span>{cEx >= exCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}</div>}
            {qCount > 0 && <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Question:</span><span className="text-xs font-bold text-cyan-700">{cQ}/{qCount}</span>{cQ >= qCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}</div>}
            {mCount > 0 && <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Mission:</span><span className="text-xs font-bold text-orange-700">{cM}/{mCount}</span>{cM >= mCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}</div>}
            {progress?.is_unit_completed && <Badge className="bg-green-100 text-green-700 border-0 gap-1 ml-auto"><CheckCircle className="w-3 h-3" />Unit 완료!</Badge>}
          </div>
          <div className="px-6 py-2.5 bg-amber-50 border-t border-amber-100">
            <p className="text-xs text-amber-800">
              이 Unit의 C++ 코드 실행은 지원하지 않습니다. 코드 작성·저장과 예제 코드 비교 확인은 사용할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 목차 + 콘텐츠 (스크롤 기반) */}
        <div className="flex flex-col md:flex-row gap-5">
          <UnitToc unit={selectedUnit} />
          <div className="flex-1 space-y-5">
            {/* 학습 목표 */}
            {selectedUnit.learning_objectives?.length > 0 && (
              <section id="objectives" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">🎯 이번 시간 학습 목표</h3>
                  <ul className="space-y-2">
                    {selectedUnit.learning_objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        <span className="text-sm text-gray-700 pt-0.5">{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
            {/* 개념 설명 */}
            {selectedUnit.concept_sections?.length > 0 && (
              <section id="concept" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="space-y-6">
                  {selectedUnit.concept_sections.map((sec, i) => (
                    <div key={i} className="border-l-4 border-blue-400 pl-4">
                      <h3 className="font-bold text-gray-900 mb-2">▶ {sec.title}</h3>
                      <ul className="space-y-1 mb-3">
                        {(sec.lines || []).map((line, j) => (
                          <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">●</span><span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      {sec.code_example && (
                        <pre className="bg-gray-900 text-cyan-300 rounded-lg p-3 text-xs font-mono overflow-auto select-none"
                          onCopy={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}>
                          {sec.code_example}
                        </pre>
                      )}
                      {sec.interactive_code?.enabled && (
                        <InteractiveCodeBlock
                          ic={sec.interactive_code}
                          blockId={`cpp_${selectedUnit.id}_sec${i}`}
                          language="cpp"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 표 */}
            {selectedUnit.tables?.length > 0 && (
              <section id="tables" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="space-y-6">
                  {selectedUnit.tables.map((tbl, i) => (
                    <div key={i}>
                      {tbl.title && <h3 className="font-bold text-gray-900 mb-2">{tbl.title}</h3>}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                          <thead className="bg-gray-100">
                            <tr>{(tbl.headers || []).map((h, j) => <th key={j} className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">{h}</th>)}</tr>
                          </thead>
                          <tbody>{(tbl.rows || []).map((row, r) => (
                            <tr key={r} className="hover:bg-gray-50">
                              {row.map((cell, c) => <td key={c} className="border border-gray-300 px-3 py-2 text-gray-700">{cell}</td>)}
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 예제 코드 */}
            {selectedUnit.example_codes?.length > 0 && (
              <section id="codes" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <CppExamplePractice exampleCodes={selectedUnit.example_codes || []} user={user} unitId={selectedUnit.id} unitTitle={selectedUnit.title || ""} progress={progress} onProgressUpdate={refreshProgress} />
              </section>
            )}
            {/* Question */}
            {selectedUnit.questions?.length > 0 && (
              <section id="questions" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <QuestionPanel
                  questions={selectedUnit.questions || []}
                  user={user}
                  unitId={selectedUnit.id}
                  progress={progress}
                  onProgressUpdate={refreshProgress}
                  unitType="cpp"
                />
              </section>
            )}
            {/* Mission */}
            {selectedUnit.missions?.length > 0 && (
              <section id="missions" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <CppMissionPanel missions={selectedUnit.missions || []} user={user} unitId={selectedUnit.id} unitTitle={selectedUnit.title} progress={progress} onProgressUpdate={refreshProgress} />
              </section>
            )}
            {/* 핵심 요약 */}
            {selectedUnit.summary?.length > 0 && (
              <section id="summary" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">📖 핵심 요약</h3>
                  <div className="space-y-2">
                    {selectedUnit.summary.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {/* Memo */}
            <section id="memo" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-2">내 메모</h3>
              <p className="text-xs text-gray-400 mb-3">이 Unit에서 배운 내용을 자유롭게 메모하세요.</p>
              <Textarea value={memo} onChange={e => { setMemo(e.target.value); setMemoSaved(false); setSaveError(null); }}
                placeholder="메모를 입력하세요..." className="h-48 mb-3" />
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveMemo} className="bg-blue-700 hover:bg-blue-800">메모 저장</Button>
                {memoSaved && <span className="text-sm text-green-600">저장되었습니다!</span>}
              </div>
              {saveError && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                  {saveError}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">C++ 학습</h2>
        <p className="text-gray-500 text-sm mt-1">Unit을 선택하여 학습을 시작하세요.</p>
      </div>
      {units.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">등록된 Unit이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map(unit => {
            const progress = getProgress(unit.id);
            const exCount = unit.example_codes?.length || 0;
            const qCount = unit.questions?.length || 0;
            const mCount = unit.missions?.length || 0;
            const cEx = (progress?.completed_example_ids || []).length;
            const cQ = (progress?.completed_question_ids || []).length;
            const cM = (progress?.completed_mission_ids || []).length;
            const isDone = progress?.is_unit_completed;
            return (
              <div key={unit.id} onClick={() => handleSelectUnit(unit)}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${isDone ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                      {isDone ? <CheckCircle className="w-5 h-5 text-blue-600" /> : unit.unit_number}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">C++ Unit {unit.unit_number}.</p>
                      <p className="font-semibold text-gray-900">{unit.title}</p>
                      {unit.subtitle && <p className="text-xs text-gray-500 mt-0.5">{unit.subtitle}</p>}
                      {(exCount > 0 || qCount > 0 || mCount > 0) && (
                        <div className="flex gap-3 mt-1.5">
                          {exCount > 0 && <span className="text-[11px] text-gray-400">예제 {cEx}/{exCount}</span>}
                          {qCount > 0 && <span className="text-[11px] text-gray-400">Q {cQ}/{qCount}</span>}
                          {mCount > 0 && <span className="text-[11px] text-gray-400">M {cM}/{mCount}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDone && <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">완료</Badge>}
                    <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}