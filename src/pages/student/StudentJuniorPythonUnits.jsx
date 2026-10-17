import React, { useEffect, useState, useCallback, useRef } from "react";
import { loadUnits, loadAllProgress, saveProgress } from "@/lib/dataAccess";
import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, ChevronLeft, CheckCircle, FileText, Table,
  Code2, HelpCircle, Target, StickyNote, ListChecks
} from "lucide-react";
import ExampleCodePanel from "@/components/student/ExampleCodePanel";
import MissionPanel from "@/components/student/MissionPanel";
import QuestionPanel from "@/components/student/QuestionPanel";
import InteractiveCodeBlock from "@/components/student/InteractiveCodeBlock";
import UnitToc from "@/components/student/UnitToc";

// 완료 ID가 배열 또는 JSON 문자열로 전달되어도 동일하게 처리합니다.
function normalizeCompletedIds(value, total) {
  let ids = value;
  if (typeof ids === "string") {
    try { ids = JSON.parse(ids); } catch { ids = []; }
  }
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < total))];
}

function getUnitCompletion(unit, progress) {
  const ex = unit.example_codes?.length || 0;
  const q = unit.questions?.length || 0;
  const m = unit.missions?.length || 0;
  const completedEx = normalizeCompletedIds(progress?.completed_example_ids, ex).length;
  const completedQ = normalizeCompletedIds(progress?.completed_question_ids, q).length;
  const completedM = normalizeCompletedIds(progress?.completed_mission_ids, m).length;
  const total = ex + q + m;
  return {
    completedEx, completedQ, completedM,
    // 없는 학습 유형은 조건에서 제외하지만, 빈 유닛은 자동 완료하지 않습니다.
    isDone: total > 0 && completedEx === ex && completedQ === q && completedM === m,
  };
}

export default function StudentJuniorPythonUnits() {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [progresses, setProgresses] = useState([]);
  const [user, setUser] = useState(null);
  const [memo, setMemo] = useState("");
  const [memoSaved, setMemoSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const completionSaving = useRef(new Set());

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    loadData(u);
  }, []);

  const loadData = async (u) => {
    const data = await loadUnits("junior_python");
    setUnits(data);
    const sid = u?.student_id;
    if (sid) {
      const progs = await loadAllProgress(sid);
      // junior_python 전용 progress 구분: unit_id prefix 또는 unit_title로 구분
      setProgresses(progs.filter(p => p.unit_type === "junior_python"));
    }
  };

  // 서버에 저장된 세 유형의 완료 ID를 기준으로 유닛 완료를 확정합니다.
  useEffect(() => {
    if (!user?.student_id || !units.length || !progresses.length) return;
    units.forEach(unit => {
      const progress = progresses.find(p => String(p.unit_id) === String(unit.id));
      if (!progress || !getUnitCompletion(unit, progress).isDone) return;
      if (progress.is_unit_completed === true && progress.is_completed === true) return;
      const key = `${user.student_id}:${unit.id}`;
      if (completionSaving.current.has(key)) return;
      completionSaving.current.add(key);
      saveProgress(user.student_id, unit.id, {
        is_unit_completed: true,
        is_completed: true,
        last_studied_at: new Date().toISOString(),
      }, {
        studentName: user.name || "",
        unitTitle: unit.title || "",
        unitType: "junior_python",
      }).then(() => refreshProgress()).catch(err => {
        console.error("[JuniorPythonUnits] 유닛 완료 저장 실패:", err);
      }).finally(() => completionSaving.current.delete(key));
    });
  }, [user, units, progresses]);

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
    try {
      const progs = await loadAllProgress(sid);
      setProgresses(progs.filter(p => p.unit_type === "junior_python"));
    } catch (err) {
      console.warn("[JuniorPythonUnits] progress 로드 실패:", err?.message);
    }
  };

  const handleSaveMemo = async () => {
    if (!user) return;
    const sid = getSid();
    setSaveError(null);
    try {
      await saveProgress(sid, selectedUnit.id, { memo }, {
        studentName: user.name,
        unitTitle: selectedUnit.title,
        unitType: "junior_python",
      });
      await refreshProgress();
      setMemoSaved(true);
      setTimeout(() => setMemoSaved(false), 2000);
    } catch (err) {
      console.error("[JuniorPythonUnits] 메모 저장 실패:", err);
      setSaveError(err?.message || "메모 저장에 실패했습니다.");
    }
  };

  if (selectedUnit) {
    const progress = getProgress(selectedUnit.id);
    const exampleCount = selectedUnit.example_codes?.length || 0;
    const questionCount = selectedUnit.questions?.length || 0;
    const missionCount = selectedUnit.missions?.length || 0;
    const { completedEx: completedExamples, completedQ: completedQuestions, completedM: completedMissions, isDone } = getUnitCompletion(selectedUnit, progress);

    return (
      <div className="p-0 max-w-6xl mx-auto">
        <button onClick={() => setSelectedUnit(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" />Unit 목록으로
        </button>

        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm mb-5 overflow-hidden">
          <div className="bg-gradient-to-r from-lime-500 to-green-500 px-6 py-5 text-white">
            <p className="text-sm font-medium opacity-80 mb-1">저학년 Python 🐍</p>
            <h1 className="text-2xl font-bold">Unit {selectedUnit.unit_number}. {selectedUnit.title}</h1>
            {selectedUnit.subtitle && <p className="text-sm opacity-80 mt-1">{selectedUnit.subtitle}</p>}
          </div>
          <div className="px-6 py-3 bg-lime-50 border-t border-lime-100 flex items-center gap-4 flex-wrap">
            {exampleCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">예제:</span>
                <span className="text-xs font-bold text-lime-700">{completedExamples}/{exampleCount}</span>
                {completedExamples >= exampleCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
              </div>
            )}
            {questionCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Question:</span>
                <span className="text-xs font-bold text-blue-700">{completedQuestions}/{questionCount}</span>
                {completedQuestions >= questionCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
              </div>
            )}
            {missionCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Mission:</span>
                <span className="text-xs font-bold text-orange-700">{completedMissions}/{missionCount}</span>
                {completedMissions >= missionCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
              </div>
            )}
            {isDone && (
              <Badge className="bg-lime-100 text-lime-700 border-0 gap-1 ml-auto">
                <CheckCircle className="w-3 h-3" />Unit 완료!
              </Badge>
            )}
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
                      <li key={i} className="flex items-start gap-3 p-3 bg-lime-50 rounded-lg border border-lime-100">
                        <span className="w-6 h-6 bg-lime-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
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
                    <div key={i} className="border-l-4 border-lime-400 pl-4">
                      <h3 className="font-bold text-gray-900 mb-2">▶ {sec.title}</h3>
                      <ul className="space-y-1 mb-3">
                        {(sec.lines || []).map((line, j) => (
                          <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">●</span><span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      {sec.code_example && (
                        <pre className="bg-gray-900 text-lime-300 rounded-lg p-3 text-xs font-mono overflow-auto select-none"
                          onCopy={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}>
                          {sec.code_example}
                        </pre>
                      )}
                      {sec.interactive_code?.enabled && (
                        <InteractiveCodeBlock ic={sec.interactive_code} blockId={`${selectedUnit.id}_sec${i}`} />
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
                          <thead className="bg-lime-50">
                            <tr>{(tbl.headers || []).map((h, j) => (
                              <th key={j} className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">{h}</th>
                            ))}</tr>
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
                <ExampleCodePanel
                  exampleCodes={selectedUnit.example_codes || []}
                  user={user}
                  unitId={selectedUnit.id}
                  unitTitle={selectedUnit.title}
                  progress={progress}
                  onProgressUpdate={refreshProgress}
                  unitType="junior_python"
                />
              </section>
            )}
            {/* Question */}
            {selectedUnit.questions?.length > 0 && (
              <section id="questions" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <QuestionPanel
                  questions={selectedUnit.questions || []}
                  user={user}
                  unitId={selectedUnit.id}
                  unitTitle={selectedUnit.title}
                  progress={progress}
                  onProgressUpdate={refreshProgress}
                  unitType="junior_python"
                />
              </section>
            )}
            {/* Mission */}
            {selectedUnit.missions?.length > 0 && (
              <section id="missions" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <MissionPanel
                  missions={selectedUnit.missions || []}
                  user={user}
                  unitId={selectedUnit.id}
                  unitTitle={selectedUnit.title}
                  progress={progress}
                  onProgressUpdate={refreshProgress}
                  unitType="junior_python"
                />
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
              <Textarea value={memo} onChange={e => { setMemo(e.target.value); setMemoSaved(false); }}
                placeholder="메모를 입력하세요..." className="h-48 mb-3" />
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveMemo} className="bg-lime-600 hover:bg-lime-700">메모 저장</Button>
                {memoSaved && <span className="text-sm text-green-600">저장되었습니다!</span>}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🐍 저학년 Python 학습</h2>
        <p className="text-gray-500 text-sm mt-1">Unit을 선택하여 학습을 시작하세요. 쉽고 재미있는 Python 세계로 오세요!</p>
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
            const { completedEx, completedQ, completedM, isDone } = getUnitCompletion(unit, progress);

            return (
              <div key={unit.id} onClick={() => handleSelectUnit(unit)}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-lime-300 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${isDone ? "bg-lime-100 text-lime-700" : "bg-gray-100 text-gray-500"}`}>
                      {isDone ? <CheckCircle className="w-5 h-5 text-lime-600" /> : unit.unit_number}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">저학년 Python Unit {unit.unit_number}.</p>
                      <p className="font-semibold text-gray-900">{unit.title}</p>
                      {unit.subtitle && <p className="text-xs text-gray-500 mt-0.5">{unit.subtitle}</p>}
                      {(exCount > 0 || qCount > 0 || mCount > 0) && (
                        <div className="flex gap-3 mt-1.5">
                          {exCount > 0 && <span className="text-[11px] text-gray-400">예제 {completedEx}/{exCount}</span>}
                          {qCount > 0 && <span className="text-[11px] text-gray-400">Q {completedQ}/{qCount}</span>}
                          {mCount > 0 && <span className="text-[11px] text-gray-400">M {completedM}/{mCount}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDone && <Badge className="bg-lime-100 text-lime-700 border-0 text-xs">완료</Badge>}
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