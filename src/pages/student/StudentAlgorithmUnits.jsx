import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { loadAllProgress, saveProgress, loadStudentAlgorithmUnits } from "@/lib/dataAccess";
import { getSessionUser, getSessionToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  BookOpen, ChevronLeft, CheckCircle, FileText, Code2, HelpCircle, Target,
  Lightbulb, Workflow, Play, Puzzle, Terminal, ListChecks, Sparkles, Map, Trophy
} from "lucide-react";
import ExampleCodePanel from "@/components/student/ExampleCodePanel";
import MissionPanel from "@/components/student/MissionPanel";
import QuestionPanel from "@/components/student/QuestionPanel";
import AlgorithmSimulator from "@/components/student/AlgorithmSimulator";
import AlgorithmJudgePanel from "@/components/student/AlgorithmJudgePanel";
import UnitToc from "@/components/student/UnitToc";
import { runPython } from "@/lib/codeRunner";
import { useToast } from "@/components/ui/use-toast";
import { compareOutput } from "@/lib/stdinUtils";

const DIFFICULTY_COLORS = {
  "입문": "bg-green-100 text-green-700",
  "기초": "bg-blue-100 text-blue-700",
  "중급": "bg-amber-100 text-amber-700",
  "심화": "bg-orange-100 text-orange-700",
  "대회": "bg-red-100 text-red-700",
};

const ORDERED_SECTIONS = [
  { key: "objectives", label: "학습 목표", icon: ListChecks },
  { key: "concept", label: "1. 개념 설명", icon: FileText },
  { key: "why", label: "2. 왜 필요한가", icon: Lightbulb },
  { key: "core", label: "3. 핵심 아이디어", icon: Sparkles },
  { key: "flow", label: "4. 알고리즘 흐름", icon: Workflow },
  { key: "simulator", label: "5. 시뮬레이터", icon: Play },
  { key: "examples", label: "6. 예제 코드", icon: Code2 },
  { key: "questions", label: "7. Question", icon: HelpCircle },
  { key: "blanks", label: "8. 코드 빈칸", icon: Puzzle },
  { key: "impl", label: "9. 직접 구현", icon: Terminal },
  { key: "judge", label: "문제 풀이", icon: Trophy },
  { key: "missions", label: "10. Mission", icon: Target },
  { key: "summary", label: "핵심 요약", icon: BookOpen },
];

export default function StudentAlgorithmUnits() {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [progresses, setProgresses] = useState([]);
  const [user, setUser] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    loadData(u);
  }, []);

  const loadData = async (u) => {
    try {
      // Supabase에서 직접 로드 (sanitize 포함) — Base44 Function 401 회피
      let data = [];
      try {
        data = await loadStudentAlgorithmUnits();
      } catch (e) {
        console.warn("[StudentAlgorithmUnits] Supabase 로드 실패, Base44 폴백:", e.message);
        // 폴백: Base44 Function (관리자/선생님 계정용)
        try {
          const res = await base44.functions.invoke("loadStudentAlgorithmUnits", {});
          data = res.data?.units || res.units || [];
        } catch (e2) {
          console.error("[StudentAlgorithmUnits] Base44 로드도 실패:", e2.message);
          if (!getSessionToken()) {
            toast({ title: "세션 만료", description: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.", variant: "destructive" });
          } else {
            toast({ title: "Unit 로드 실패", description: "알고리즘 학습 자료를 불러올 수 없습니다.", variant: "destructive" });
          }
        }
      }
      const sorted = [...(data || [])].sort((a, b) => (a.unit_number || 0) - (b.unit_number || 0));
      setUnits(sorted.filter(u => u.is_active !== false));
    } catch (err) {
      console.error("[StudentAlgorithmUnits] 로드 실패:", err);
      toast({ title: "Unit 로드 실패", description: err.message, variant: "destructive" });
    }
    const sid = u?.student_id;
    if (sid) {
      try {
        const progs = await loadAllProgress(sid);
        setProgresses(progs.filter(p => p.unit_id));
      } catch (e) { console.warn("progress 로드 실패", e); }
    }
  };

  const getProgress = useCallback((unitId) => progresses.find(p => p.unit_id === unitId), [progresses]);
  const getSid = () => user?.student_id;

  const refreshProgress = async () => {
    const sid = getSid();
    if (!sid) return;
    try {
      const progs = await loadAllProgress(sid);
      setProgresses(progs.filter(p => p.unit_id));
    } catch (err) {
      console.warn("[AlgorithmUnits] progress 로드 실패:", err?.message);
    }
  };

  const handleSelectUnit = (unit) => {
    setSelectedUnit(unit);
  };

  // 전체 진행률
  const totalUnits = units.length;
  const completedUnits = units.filter(u => {
    const p = getProgress(u.id);
    return p?.is_unit_completed || p?.is_completed;
  }).length;
  const progressPercent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  // ── Unit 상세 ──
  if (selectedUnit) {
    const progress = getProgress(selectedUnit.id);
    const exampleCount = selectedUnit.example_codes?.length || 0;
    const questionCount = selectedUnit.questions?.length || 0;
    const missionCount = selectedUnit.missions?.length || 0;
    const completedExamples = (progress?.completed_example_ids || []).length;
    const completedQuestions = (progress?.completed_question_ids || []).length;
    const completedMissions = (progress?.completed_mission_ids || []).length;

    return (
      <div className="p-0 max-w-5xl mx-auto">
        <button onClick={() => setSelectedUnit(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" />로드맵으로
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm mb-5 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium opacity-80">알고리즘 학습</span>
              <span className="text-xs px-2 py-0.5 bg-white/20 rounded-full">{selectedUnit.algorithm_tag || "기타"}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[selectedUnit.difficulty] || "bg-white/20"}`}>
                {selectedUnit.difficulty || "기초"}
              </span>
            </div>
            <h1 className="text-2xl font-bold">Unit {selectedUnit.unit_number}. {selectedUnit.title}</h1>
            {selectedUnit.subtitle && <p className="text-sm opacity-80 mt-1">{selectedUnit.subtitle}</p>}
          </div>
          <div className="px-6 py-3 bg-violet-50 border-t border-violet-100 flex items-center gap-4 flex-wrap">
            {exampleCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">예제:</span>
                <span className="text-xs font-bold text-violet-700">{completedExamples}/{exampleCount}</span>
                {completedExamples >= exampleCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
              </div>
            )}
            {questionCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Question:</span>
                <span className="text-xs font-bold text-violet-700">{completedQuestions}/{questionCount}</span>
                {completedQuestions >= questionCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
              </div>
            )}
            {missionCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Mission:</span>
                <span className="text-xs font-bold text-violet-700">{completedMissions}/{missionCount}</span>
                {completedMissions >= missionCount && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
              </div>
            )}
            {(progress?.is_unit_completed || progress?.is_completed) && (
              <Badge className="bg-green-100 text-green-700 border-0 gap-1 ml-auto">
                <CheckCircle className="w-3 h-3" />Unit 완료!
              </Badge>
            )}
          </div>
        </div>

        {/* 목차 + 콘텐츠 (스크롤 기반) */}
        <div className="flex flex-col md:flex-row gap-5">
          <UnitToc unit={selectedUnit} sections={ORDERED_SECTIONS.filter(sec => {
            if (sec.key === "objectives") return selectedUnit.learning_objectives?.length > 0;
            if (sec.key === "concept") return selectedUnit.concept_sections?.length > 0;
            if (sec.key === "why") return selectedUnit.why_needed?.length > 0;
            if (sec.key === "core") return selectedUnit.core_idea?.length > 0;
            if (sec.key === "flow") return selectedUnit.algorithm_flow?.length > 0;
            if (sec.key === "simulator") return selectedUnit.simulator?.enabled;
            if (sec.key === "examples") return selectedUnit.example_codes?.length > 0;
            if (sec.key === "questions") return selectedUnit.questions?.length > 0;
            if (sec.key === "blanks") return selectedUnit.code_blanks?.length > 0;
            if (sec.key === "impl") return selectedUnit.implementations?.length > 0;
            if (sec.key === "judge") return selectedUnit.judge_problems?.length > 0;
            if (sec.key === "missions") return selectedUnit.missions?.length > 0;
            if (sec.key === "summary") return selectedUnit.summary?.length > 0;
            return false;
          })} />
          <div className="flex-1 space-y-5">
            {/* 학습 목표 */}
            {selectedUnit.learning_objectives?.length > 0 && (
              <section id="objectives" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3">🎯 이번 시간 학습 목표</h3>
                <ul className="space-y-2">
                  {selectedUnit.learning_objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                      <span className="w-6 h-6 bg-violet-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-700 pt-0.5">{obj}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {/* 개념 설명 */}
            {selectedUnit.concept_sections?.length > 0 && (
              <section id="concept" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="space-y-6">
                  {selectedUnit.concept_sections.map((sec, i) => (
                    <div key={i} className="border-l-4 border-violet-400 pl-4">
                      <h3 className="font-bold text-gray-900 mb-2">▶ {sec.title}</h3>
                      <ul className="space-y-1 mb-3">
                        {(sec.lines || []).map((line, j) => (
                          <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">●</span><span>{line}</span>
                          </li>
                        ))}
                      </ul>
                      {sec.code_example && (
                        <pre className="bg-gray-900 text-violet-300 rounded-lg p-3 text-xs font-mono overflow-auto">{sec.code_example}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 왜 필요한가 */}
            {selectedUnit.why_needed?.length > 0 && (
              <section id="why" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3">💡 왜 이 알고리즘이 필요할까?</h3>
                <div className="space-y-2">
                  {selectedUnit.why_needed.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 핵심 아이디어 */}
            {selectedUnit.core_idea?.length > 0 && (
              <section id="core" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3">✨ 핵심 아이디어</h3>
                <div className="space-y-2">
                  {selectedUnit.core_idea.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                      <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 알고리즘 흐름 */}
            {selectedUnit.algorithm_flow?.length > 0 && (
              <section id="flow" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3">🔄 알고리즘 흐름</h3>
                <div className="space-y-3">
                  {selectedUnit.algorithm_flow.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-8 h-8 bg-violet-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                      <div className="pt-1">
                        <p className="font-semibold text-gray-900 text-sm">{item.step}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* 시뮬레이터 */}
            {selectedUnit.simulator?.enabled && (
              <section id="simulator" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <AlgorithmSimulator config={selectedUnit.simulator} />
              </section>
            )}
            {/* 예제 코드 */}
            {selectedUnit.example_codes?.length > 0 && (
              <section id="examples" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6">
                {selectedUnit.example_codes.some(ex => ex.code_explanations?.length > 0) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 text-sm mb-3 flex items-center gap-2"><Code2 className="w-4 h-4" />코드 라인별 설명</h4>
                    {selectedUnit.example_codes.filter(ex => ex.code_explanations?.length > 0).map((ex, ei) => (
                      <div key={ei} className="mb-4 last:mb-0">
                        <p className="text-xs font-semibold text-gray-600 mb-2">{ex.filename || `예제 ${ei + 1}`}</p>
                        <div className="space-y-1">
                          {(ex.code_explanations || []).map((ce, ci) => (
                            <div key={ci} className="flex items-start gap-2 text-sm">
                              <code className="px-2 py-0.5 bg-gray-900 text-green-300 rounded text-xs font-mono flex-shrink-0">{ce.line}</code>
                              <span className="text-gray-400">→</span>
                              <span className="text-gray-700">{ce.explanation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <ExampleCodePanel
                  exampleCodes={selectedUnit.example_codes || []}
                  user={user}
                  unitId={selectedUnit.id}
                  unitTitle={selectedUnit.title}
                  unitType="algorithm_learning"
                  progress={progress}
                  onProgressUpdate={refreshProgress}
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
                  unitType="algorithm_learning"
                  progress={progress}
                  onProgressUpdate={refreshProgress}
                />
              </section>
            )}
            {/* 코드 빈칸 */}
            {selectedUnit.code_blanks?.length > 0 && (
              <section id="blanks" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm">
                <CodeBlanksSection unit={selectedUnit} user={user} progress={progress} onProgressUpdate={refreshProgress} />
              </section>
            )}
            {/* 직접 구현 */}
            {selectedUnit.implementations?.length > 0 && (
              <section id="impl" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm">
                <ImplementationsSection unit={selectedUnit} user={user} progress={progress} onProgressUpdate={refreshProgress} />
              </section>
            )}
            {/* 문제 풀이 */}
            {selectedUnit.judge_problems?.length > 0 && (
              <section id="judge" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <AlgorithmJudgePanel unit={selectedUnit} user={user} onProgressUpdate={refreshProgress} />
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
                  unitType="algorithm_learning"
                  progress={progress}
                  onProgressUpdate={refreshProgress}
                />
              </section>
            )}
            {/* 핵심 요약 */}
            {selectedUnit.summary?.length > 0 && (
              <section id="summary" className="scroll-mt-20 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3">📖 핵심 요약</h3>
                <div className="space-y-2">
                  {selectedUnit.summary.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                      <CheckCircle className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 로드맵 + Unit 목록 ──
  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 + 전체 진행률 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Map className="w-6 h-6 text-violet-600" />
          <h2 className="text-2xl font-bold text-gray-900">알고리즘 학습</h2>
        </div>
        <p className="text-gray-500 text-sm mb-4">개념 이해 → 시뮬레이션 → 코드 구현 → 문제 풀이의 흐름으로 학습합니다.</p>

        {/* 진행률 카드 */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-500 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              <span className="font-semibold">전체 학습 진행률</span>
            </div>
            <span className="text-2xl font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 mb-2">
            <div className="bg-white h-3 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-sm opacity-90">전체 {totalUnits} Unit 중 {completedUnits} Unit 완료</p>
        </div>
      </div>

      {/* 로드맵 */}
      {units.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">등록된 알고리즘 Unit이 없습니다.</p>
          <p className="text-gray-300 text-xs mt-1">관리자가 Unit을 추가하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map((unit, idx) => {
            const progress = getProgress(unit.id);
            const isDone = progress?.is_unit_completed || progress?.is_completed;
            const qCount = unit.questions?.length || 0;
            const mCount = unit.missions?.length || 0;
            const exCount = unit.example_codes?.length || 0;
            const completedEx = (progress?.completed_example_ids || []).length;
            const completedQ = (progress?.completed_question_ids || []).length;
            const completedM = (progress?.completed_mission_ids || []).length;

            return (
              <div key={unit.id}>
                <div onClick={() => handleSelectUnit(unit)}
                  className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-violet-300 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${isDone ? "bg-green-100 text-green-700" : "bg-violet-100 text-violet-700"}`}>
                        {isDone ? <CheckCircle className="w-5 h-5 text-green-600" /> : unit.unit_number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 truncate">{unit.title}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[unit.difficulty] || "bg-gray-100 text-gray-600"}`}>{unit.difficulty || "기초"}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{unit.algorithm_tag || "기타"}</span>
                          {unit.simulator?.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-0.5"><Play className="w-2.5 h-2.5" />시뮬</span>}
                        </div>
                        {unit.subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{unit.subtitle}</p>}
                        <div className="flex gap-3 mt-1.5">
                          {exCount > 0 && <span className="text-[11px] text-gray-400">예제 {completedEx}/{exCount}</span>}
                          {qCount > 0 && <span className="text-[11px] text-gray-400">Q {completedQ}/{qCount}</span>}
                          {mCount > 0 && <span className="text-[11px] text-gray-400">M {completedM}/{mCount}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isDone && <Badge className="bg-green-100 text-green-700 border-0 text-xs">완료</Badge>}
                      <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
                    </div>
                  </div>
                </div>
                {/* 로드맵 연결선 */}
                {idx < units.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <div className="w-0.5 h-3 bg-violet-200" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 코드 빈칸 채우기 섹션 ──
function CodeBlanksSection({ unit, user, progress, onProgressUpdate }) {
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const { toast } = useToast();
  const sid = user?.student_id;

  const handleCheck = async (i, blank) => {
    const userAns = (answers[i] || "").trim();
    const correct = (blank.blank_answer || "").trim();
    const isCorrect = userAns === correct || userAns.replace(/\s/g, "") === correct.replace(/\s/g, "");
    setResults({ ...results, [i]: isCorrect });
    if (isCorrect) {
      toast({ title: "정답입니다! 🎉" });
      // 진행도 저장
      const completed = [...(progress?.completed_question_ids || []), `blank_${i}`];
      await saveProgress(sid, unit.id, { completed_question_ids: completed }, {
        studentName: user?.name, unitTitle: unit.title, unitType: "algorithm_learning",
      });
      onProgressUpdate?.();
    } else {
      toast({ title: "오답입니다. 다시 시도해보세요.", variant: "destructive" });
    }
  };

  return (
    <div className="p-5 space-y-4">
      {unit.code_blanks?.length > 0 ? (
        unit.code_blanks.map((blank, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Puzzle className="w-4 h-4 text-violet-600" />
              <span className="font-semibold text-sm">{blank.title || `빈칸 ${i + 1}`}</span>
              {results[i] === true && <CheckCircle className="w-4 h-4 text-green-500" />}
            </div>
            {blank.description && <p className="text-sm text-gray-600 mb-3">{blank.description}</p>}
            <pre className="bg-gray-900 text-violet-300 rounded-lg p-3 text-xs font-mono overflow-auto mb-3 whitespace-pre-wrap">{blank.full_code}</pre>
            <div className="flex items-center gap-2">
              <Input
                value={answers[i] || ""}
                onChange={e => setAnswers({ ...answers, [i]: e.target.value })}
                placeholder="빈칸에 들어갈 코드를 입력하세요"
                className="font-mono text-sm flex-1"
                onKeyDown={e => { if (e.key === "Enter") handleCheck(i, blank); }}
              />
              <Button onClick={() => handleCheck(i, blank)} size="sm" className="bg-violet-600 hover:bg-violet-700">확인</Button>
            </div>
            {results[i] === false && blank.explanation && (
              <p className="text-xs text-gray-500 mt-2">💡 {blank.explanation}</p>
            )}
          </div>
        ))
      ) : <p className="text-gray-400 text-sm text-center py-8">빈칸 문제가 없습니다.</p>}
    </div>
  );
}

// ── 직접 구현 섹션 ──
function ImplementationsSection({ unit, user, progress, onProgressUpdate }) {
  const [codes, setCodes] = useState({});
  const [stdins, setStdins] = useState({});
  const [results, setResults] = useState({});
  const [running, setRunning] = useState({});
  const { toast } = useToast();
  const sid = user?.student_id;

  const handleRun = async (i, impl) => {
    setRunning({ ...running, [i]: true });
    try {
      const code = codes[i] ?? impl.default_code ?? "";
      const testCases = impl.test_cases || [];
      if (testCases.length === 0) {
        const stdinVal = stdins[i] || "";
        const res = await runPython({ code, stdin: stdinVal });
        const output = res?.output || res?.stdout || "";
        setResults({ ...results, [i]: { output, allPass: false, perTestResults: [] } });
        return;
      }
      // 각 테스트케이스별로 코드를 별도 실행 (버그 수정: 단일 실행 결과를 모든 TC와 비교하지 않음)
      const perTestResults = [];
      let allPass = true;
      for (const tc of testCases) {
        if (!tc.input && !tc.expected_output) { perTestResults.push({ passed: true }); continue; }
        const res = await runPython({ code, stdin: tc.input || "" });
        const actual = res?.output || res?.stdout || "";
        const expected = tc.expected_output || "";
        const passed = !res?.error && compareOutput(actual, expected, impl.grading_mode || "normalize");
        perTestResults.push({ input: tc.input, expected, actual, passed, error: res?.error || "" });
        if (!passed) allPass = false;
      }
      setResults({ ...results, [i]: { output: "", allPass, perTestResults } });
      if (allPass) {
        toast({ title: "모든 테스트케이스 통과! 🎉" });
        const completed = [...(progress?.completed_mission_ids || []), `impl_${i}`];
        await saveProgress(sid, unit.id, { completed_mission_ids: completed }, {
          studentName: user?.name, unitTitle: unit.title, unitType: "algorithm_learning",
        });
        onProgressUpdate?.();
      }
    } catch (err) {
      setResults({ ...results, [i]: { output: "오류: " + err.message, allPass: false, perTestResults: [] } });
    } finally {
      setRunning({ ...running, [i]: false });
    }
  };

  return (
    <div className="p-5 space-y-4">
      {unit.implementations?.length > 0 ? (
        unit.implementations.map((impl, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-violet-600" />
              <span className="font-semibold text-sm">{impl.title || `구현 ${i + 1}`}</span>
              {results[i]?.allPass && <CheckCircle className="w-4 h-4 text-green-500" />}
            </div>
            {impl.description && <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{impl.description}</p>}
            <Textarea
              value={codes[i] ?? impl.default_code ?? ""}
              onChange={e => setCodes({ ...codes, [i]: e.target.value })}
              placeholder="여기에 코드를 작성하세요"
              className="font-mono text-xs min-h-[150px] mb-3"
            />
            <div className="flex items-center gap-2 mb-3">
              <Input
                value={stdins[i] || ""}
                onChange={e => setStdins({ ...stdins, [i]: e.target.value })}
                placeholder="표준 입력값 (선택)"
                className="font-mono text-xs flex-1"
              />
              <Button onClick={() => handleRun(i, impl)} disabled={running[i]} size="sm" className="bg-violet-600 hover:bg-violet-700">
                {running[i] ? "실행 중..." : "실행 및 채점"}
              </Button>
            </div>
            {results[i] && (
              <div className={`rounded-lg p-3 text-sm ${results[i].allPass ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-700"}`}>
                <p className="font-semibold mb-2">{results[i].allPass ? "✅ 모든 테스트 통과" : (results[i].perTestResults?.length ? "채점 결과" : "실행 결과")}</p>
                {results[i].output && <pre className="text-xs font-mono whitespace-pre-wrap mb-2">{results[i].output}</pre>}
                {results[i].perTestResults?.length > 0 && (
                  <div className="space-y-1.5">
                    {results[i].perTestResults.map((tr, ti) => (
                      <div key={ti} className={`rounded p-2 text-xs ${tr.passed ? "bg-green-50" : "bg-red-50"}`}>
                        <span className="font-bold">{tr.passed ? "✅" : "❌"} 테스트 {ti + 1}</span>
                        {!tr.passed && tr.expected !== undefined && (
                          <div className="mt-1 space-y-0.5">
                            <div>기대: <pre className="font-mono inline">{tr.expected}</pre></div>
                            <div>출력: <pre className="font-mono inline">{tr.actual || "(없음)"}</pre></div>
                            {tr.error && <div className="text-red-500">오류: {tr.error}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      ) : <p className="text-gray-400 text-sm text-center py-8">구현 문제가 없습니다.</p>}
    </div>
  );
}