import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { loadUnits, loadAllProgress, saveProgress as saveProgressDA } from "@/lib/dataAccess";
import {
  ChevronLeft, CheckCircle, Code2, HelpCircle, Target, FileText,
  ChevronRight, BookOpen, Table
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MultiFileEditor from "@/components/html/MultiFileEditor";
import { storageKeys, storageSave, storageLoad } from "@/lib/storageService";
import HTMLExampleSection from "@/components/student/html/HTMLExampleSection";
import HTMLQuestionSection from "@/components/student/html/HTMLQuestionSection";
import HTMLMissionSection from "@/components/student/html/HTMLMissionSection";
import UnitToc from "@/components/student/UnitToc";

const DEFAULT_HTML_BOILERPLATE = `<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8">\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n</body>\n</html>`;
const DEFAULT_CSS_BOILERPLATE = ``;
const DEFAULT_JS_BOILERPLATE = ``;

function checkConditions(html, css, js, conditions = []) {
  return conditions.map(c => {
    const type = c.type || "html";
    if (type === "html") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const count = doc.querySelectorAll(c.tag || "div").length;
      return { ...c, passed: count >= (c.min_count || 1) };
    } else if (type === "css") {
      const prop = (c.property || "").toLowerCase();
      const count = (css.match(new RegExp(prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi")) || []).length;
      return { ...c, passed: count >= (c.min_count || 1) };
    } else if (type === "js") {
      const kw = (c.keyword || "").toLowerCase();
      const count = (js.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi")) || []).length;
      return { ...c, passed: count >= (c.min_count || 1) };
    }
    return { ...c, passed: false };
  });
}

const LS_KEY = (studentId, unitId, missionIdx, field) =>
  storageKeys.htmlMissionCode(studentId, unitId, missionIdx, field);

export default function StudentHTMLUnits() {
  const { studentData } = useOutletContext();
  const [units, setUnits] = useState([]);
  const [progress, setProgress] = useState({});
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  // Example
  const [openExampleIdx, setOpenExampleIdx] = useState(null);
  const [exampleStates, setExampleStates] = useState({});

  // Question
  const [openQuestionIdx, setOpenQuestionIdx] = useState(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [questionResult, setQuestionResult] = useState(null);

  // Mission
  const [openMissionIdx, setOpenMissionIdx] = useState(null);
  const [missionStates, setMissionStates] = useState({});

  const studentId = studentData?.id;

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    loadAll();
  }, [studentId]);

  const loadAll = async () => {
    const [allUnits, allProgress] = await Promise.all([
      loadUnits("html"),
      loadAllProgress(studentId),
    ]);
    const progMap = {};
    allProgress.forEach(p => { progMap[p.unit_id] = p; });
    setUnits(allUnits);
    setProgress(progMap);
    setLoading(false);
  };

  const getProgress = useCallback((unitId) => progress[unitId] || {
    completed_example_ids: [], completed_question_ids: [], completed_mission_ids: [],
  }, [progress]);

  const loadMissionFiles = (unitId, mIdx, mission) => {
    const defaultHtml = mission?.default_html || DEFAULT_HTML_BOILERPLATE;
    const defaultCss  = mission?.default_css !== undefined ? mission.default_css : "";
    const defaultJs   = mission?.default_javascript !== undefined ? mission.default_javascript : "";
    const html = storageLoad(LS_KEY(studentId, unitId, mIdx, "html")) ?? defaultHtml;
    const css  = storageLoad(LS_KEY(studentId, unitId, mIdx, "css"))  ?? defaultCss;
    const js   = storageLoad(LS_KEY(studentId, unitId, mIdx, "js"))   ?? defaultJs;
    return [
      { name: "index.html", language: "html", code: html },
      { name: "style.css",  language: "css",  code: css  },
      { name: "script.js",  language: "js",   code: js   },
    ];
  };

  const selectUnit = (u) => {
    setSelectedUnit(u);
    setOpenExampleIdx(null); setExampleStates({});
    setOpenQuestionIdx(null); setQuestionIdx(0); setSelectedAnswer(null); setQuestionResult(null);
    setOpenMissionIdx(null); setMissionStates({});
  };

  const saveProgress = async (unitId, updates) => {
    await saveProgressDA(studentId, unitId, updates, {
      studentName: studentData?.name || "",
      unitTitle: selectedUnit?.title || "",
      unitType: "html",
    });
    setProgress(prev => ({ ...prev, [unitId]: { ...(prev[unitId] || {}), ...updates } }));
  };

  const handleExampleSubmit = async (result, idx) => {
    setExampleStates(s => ({ ...s, [idx]: { result } }));
    if (result.allOk) {
      const prog = getProgress(selectedUnit.id);
      const completed = [...new Set([...(prog.completed_example_ids || []), idx])];
      const rate = Math.round((completed.length / (selectedUnit.example_codes || []).length) * 100);
      await saveProgress(selectedUnit.id, { completed_example_ids: completed, example_progress_rate: rate, last_studied_at: new Date().toISOString() });
    }
  };

  const handleQuestionSubmit = async () => {
    const q = selectedUnit.questions?.[questionIdx];
    if (!q) return;
    const ok = selectedAnswer?.trim().toLowerCase() === q.answer?.trim().toLowerCase();
    setQuestionResult(ok);
    if (ok) {
      const prog = getProgress(selectedUnit.id);
      const completed = [...new Set([...(prog.completed_question_ids || []), questionIdx])];
      const rate = Math.round((completed.length / (selectedUnit.questions || []).length) * 100);
      await saveProgress(selectedUnit.id, { completed_question_ids: completed, question_progress_rate: rate, last_studied_at: new Date().toISOString() });
    }
  };

  const nextQuestion = () => {
    const nextIdx = questionIdx + 1;
    if (nextIdx < (selectedUnit.questions || []).length) {
      setQuestionIdx(nextIdx); setSelectedAnswer(null); setQuestionResult(null);
    } else {
      scrollToSection("mission");
      setOpenMissionIdx(null); setMissionStates({});
    }
  };

  // concept_sections fallback (기존 description_pages 호환)
  const getConceptSections = (unit) =>
    unit.concept_sections?.length
      ? unit.concept_sections
      : (unit.description_pages || []).map(block => ({
          title: block.title || "",
          lines: block.content ? [block.content] : [],
          code_example: block.type === "code" ? block.content : "",
        })).filter(s => s.title || s.lines.length > 0);

  const scrollToSection = (key) => {
    const el = document.getElementById(key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>;

  // ─── Unit 목록 ───
  if (!selectedUnit) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">HTML 학습</h2>
          <p className="text-gray-500 text-sm mt-1">Unit을 선택하여 학습을 시작하세요.</p>
        </div>
        {units.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">등록된 Unit이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {units.map(u => {
              const prog = getProgress(u.id);
              const exDone = (prog.completed_example_ids || []).length;
              const qDone = (prog.completed_question_ids || []).length;
              const mDone = (prog.completed_mission_ids || []).length;
              const exTotal = (u.example_codes || []).length;
              const qTotal = (u.questions || []).length;
              const mTotal = (u.missions || []).length;
              const isDone = prog.is_unit_completed;
              return (
                <div key={u.id} onClick={() => selectUnit(u)}
                  className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-orange-300 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${isDone ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                        {isDone ? <CheckCircle className="w-5 h-5 text-green-600" /> : u.unit_number}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">HTML Unit {u.unit_number}.</p>
                        <p className="font-semibold text-gray-900">{u.title}</p>
                        {u.subtitle && <p className="text-xs text-gray-500 mt-0.5">{u.subtitle}</p>}
                        {(exTotal > 0 || qTotal > 0 || mTotal > 0) && (
                          <div className="flex gap-3 mt-1.5">
                            {exTotal > 0 && <span className="text-[11px] text-gray-400">예제 {exDone}/{exTotal}</span>}
                            {qTotal > 0 && <span className="text-[11px] text-gray-400">Q {qDone}/{qTotal}</span>}
                            {mTotal > 0 && <span className="text-[11px] text-gray-400">M {mDone}/{mTotal}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isDone && <Badge className="bg-green-100 text-green-700 border-0 text-xs">완료</Badge>}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
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

  // ─── Unit 학습 화면 ───
  const prog = getProgress(selectedUnit.id);
  const exTotal = (selectedUnit.example_codes || []).length;
  const qTotal = (selectedUnit.questions || []).length;
  const mTotal = (selectedUnit.missions || []).length;
  const completedEx = (prog.completed_example_ids || []).length;
  const completedQ  = (prog.completed_question_ids || []).length;
  const completedM  = (prog.completed_mission_ids || []).length;

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={() => setSelectedUnit(null)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5 text-sm transition-colors">
        <ChevronLeft className="w-4 h-4" />Unit 목록으로
      </button>

      {/* 헤더 */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm mb-5 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-6 py-5 text-white">
          <p className="text-sm font-medium opacity-80 mb-1">HTML</p>
          <h1 className="text-2xl font-bold">Unit {selectedUnit.unit_number}. {selectedUnit.title}</h1>
          {selectedUnit.subtitle && <p className="text-sm opacity-80 mt-1">{selectedUnit.subtitle}</p>}
        </div>
        <div className="px-6 py-3 bg-orange-50 border-t border-orange-100 flex items-center gap-4 flex-wrap">
          {exTotal > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">예제:</span>
              <span className="text-xs font-bold text-orange-700">{completedEx}/{exTotal}</span>
              {completedEx >= exTotal && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
            </div>
          )}
          {qTotal > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Question:</span>
              <span className="text-xs font-bold text-blue-700">{completedQ}/{qTotal}</span>
              {completedQ >= qTotal && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
            </div>
          )}
          {mTotal > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Mission:</span>
              <span className="text-xs font-bold text-purple-700">{completedM}/{mTotal}</span>
              {completedM >= mTotal && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
            </div>
          )}
          {prog.is_unit_completed && (
            <Badge className="bg-green-100 text-green-700 border-0 gap-1 ml-auto">
              <CheckCircle className="w-3 h-3" />Unit 완료!
            </Badge>
          )}
        </div>
      </div>

      {/* 목차 + 콘텐츠 (스크롤 기반) */}
      <div className="flex flex-col md:flex-row gap-5">
        <UnitToc unit={selectedUnit} sections={[
          { key: "concept", label: "개념 설명", icon: FileText },
          { key: "tables", label: "표", icon: Table },
          { key: "example", label: "따라쓰기", icon: Code2 },
          { key: "question", label: "Question", icon: HelpCircle },
          { key: "mission", label: "Mission", icon: Target },
        ].filter(s => {
          if (s.key === "concept") return getConceptSections(selectedUnit).length > 0;
          if (s.key === "tables") return (selectedUnit.tables || []).length > 0;
          if (s.key === "example") return exTotal > 0;
          if (s.key === "question") return qTotal > 0;
          if (s.key === "mission") return mTotal > 0;
          return false;
        })} />
        <div className="flex-1 space-y-5">
          {/* 개념 설명 */}
          {getConceptSections(selectedUnit).length > 0 && (
            <section id="concept" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              {getConceptSections(selectedUnit).map((sec, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4">
                  {sec.title && <h3 className="font-bold text-gray-900 mb-2">▶ {sec.title}</h3>}
                  {(sec.lines || []).map((line, j) => (
                    <p key={j} className="text-sm text-gray-700 mb-1">- {line}</p>
                  ))}
                  {sec.code_example && (
                    <pre className="mt-3 bg-gray-900 text-orange-200 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">
                      {sec.code_example}
                    </pre>
                  )}
                </div>
              ))}
              {exTotal > 0 && (
                <div className="flex justify-end mt-2">
                  <Button onClick={() => scrollToSection("example")} className="bg-orange-500 hover:bg-orange-600 gap-2">
                    예제 따라쓰기 시작 <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </section>
          )}
          {/* 표 */}
          {(selectedUnit.tables || []).length > 0 && (
            <section id="tables" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              {(selectedUnit.tables || []).map((tbl, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                  {tbl.title && <h3 className="font-bold text-gray-900 mb-3">{tbl.title}</h3>}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          {(tbl.headers || []).map((h, j) => (
                            <th key={j} className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(tbl.rows || []).map((row, r) => (
                          <tr key={r} className={r % 2 === 1 ? "bg-gray-50" : ""}>
                            {row.map((cell, c) => (
                              <td key={c} className="border border-gray-200 px-3 py-2 text-gray-700">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          )}
          {/* 예제 따라쓰기 */}
          {exTotal > 0 && (
            <section id="example" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <HTMLExampleSection
                unit={selectedUnit} prog={prog} exTotal={exTotal}
                openExampleIdx={openExampleIdx} setOpenExampleIdx={setOpenExampleIdx}
                exampleStates={exampleStates}
                onSubmit={handleExampleSubmit}
              />
            </section>
          )}
          {/* Question */}
          {qTotal > 0 && (
            <section id="question" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <HTMLQuestionSection
                unit={selectedUnit} prog={prog} qTotal={qTotal}
                openQuestionIdx={openQuestionIdx} setOpenQuestionIdx={setOpenQuestionIdx}
                questionIdx={questionIdx} setQuestionIdx={setQuestionIdx}
                selectedAnswer={selectedAnswer} setSelectedAnswer={setSelectedAnswer}
                questionResult={questionResult} setQuestionResult={setQuestionResult}
                onSubmit={handleQuestionSubmit}
                onNext={nextQuestion}
              />
            </section>
          )}
          {/* Mission */}
          {mTotal > 0 && (
            <section id="mission" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <HTMLMissionSection
                unit={selectedUnit} prog={prog} mTotal={mTotal}
                studentId={studentId} studentData={studentData}
                openMissionIdx={openMissionIdx} setOpenMissionIdx={setOpenMissionIdx}
                missionStates={missionStates} setMissionStates={setMissionStates}
                loadMissionFiles={loadMissionFiles}
                checkConditions={checkConditions}
                saveProgress={saveProgress}
                getProgress={getProgress}
                storageKeyFn={LS_KEY}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}