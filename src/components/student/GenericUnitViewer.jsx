import React, { useState, useEffect } from "react";
import { loadGenericUnits } from "@/lib/dataAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft, Code2, HelpCircle, Target, Table } from "lucide-react";

// 과목 색상
const SUBJECT_COLOR = {
  algorithm: "amber",
  block: "pink",
  other: "gray",
};

const colorMap = {
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  pink: { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700", badge: "bg-pink-100 text-pink-700" },
  gray: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", badge: "bg-gray-100 text-gray-700" },
};

function ConceptView({ sections = [] }) {
  return (
    <div className="space-y-4">
      {sections.length === 0 && <p className="text-gray-400 text-sm text-center py-6">개념 설명이 없습니다.</p>}
      {sections.map((sec, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
          {sec.title && <h3 className="font-bold text-gray-900 mb-2 text-base">▶ {sec.title}</h3>}
          {(sec.lines || []).map((line, j) => (
            <p key={j} className="text-sm text-gray-700 mb-1">- {line}</p>
          ))}
          {sec.code_example && (
            <pre className="mt-3 bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">
              {sec.code_example}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function TablesView({ tables = [] }) {
  return (
    <div className="space-y-4">
      {tables.length === 0 && <p className="text-gray-400 text-sm text-center py-6">표가 없습니다.</p>}
      {tables.map((tbl, i) => (
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
    </div>
  );
}

function ExamplesView({ codes = [] }) {
  return (
    <div className="space-y-4">
      {codes.length === 0 && <p className="text-gray-400 text-sm text-center py-6">예제 코드가 없습니다.</p>}
      {codes.map((c, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-4 h-4 text-gray-500" />
            <span className="font-mono text-sm font-bold text-gray-700">{c.filename || `예제 ${i + 1}`}</span>
            {c.description && <span className="text-xs text-gray-400">{c.description}</span>}
          </div>
          <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">
            {c.code}
          </pre>
          {c.expected_output && (
            <div className="mt-2 bg-gray-100 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-1">출력 결과:</p>
              <pre className="text-xs font-mono text-gray-700">{c.expected_output}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QuestionsView({ questions = [] }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});

  const checkAnswer = (i, q) => {
    const userAns = (answers[i] || "").trim().toLowerCase();
    const correctAns = (q.answer || "").trim().toLowerCase();
    setChecked(prev => ({ ...prev, [i]: userAns === correctAns }));
  };

  return (
    <div className="space-y-4">
      {questions.length === 0 && <p className="text-gray-400 text-sm text-center py-6">문제가 없습니다.</p>}
      {questions.map((q, i) => (
        <div key={i} className={`bg-white border rounded-xl p-4 ${checked[i] === true ? "border-green-300" : checked[i] === false ? "border-red-300" : "border-gray-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-gray-600">Q{i + 1}.</span>
            {q.type && <Badge variant="outline" className="text-xs">{q.type}</Badge>}
            {q.difficulty && <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>}
          </div>
          <p className="text-sm text-gray-800 mb-3">{q.question}</p>
          {q.code_block && (
            <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono mb-3 overflow-x-auto">{q.code_block}</pre>
          )}
          {(q.options && q.options.length > 0) && (
            <div className="space-y-1 mb-3">
              {q.options.map((opt, j) => (
                <button key={j} onClick={() => setAnswers(prev => ({ ...prev, [i]: String(j + 1) }))}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${answers[i] === String(j + 1) ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}>
                  {j + 1}. {opt}
                </button>
              ))}
            </div>
          )}
          {(!q.options || q.options.length === 0) && (
            <input
              value={answers[i] || ""}
              onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
              placeholder="답을 입력하세요"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          )}
          <Button size="sm" variant="outline" onClick={() => checkAnswer(i, q)} className="h-7 text-xs">채점</Button>
          {checked[i] === true && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
              ✅ 정답! {q.explanation && <span className="text-green-600 ml-1">{q.explanation}</span>}
            </div>
          )}
          {checked[i] === false && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              ❌ 틀렸습니다. 다시 시도해보세요.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MissionsView({ missions = [] }) {
  return (
    <div className="space-y-4">
      {missions.length === 0 && <p className="text-gray-400 text-sm text-center py-6">미션이 없습니다.</p>}
      {missions.map((m, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-gray-500" />
            <span className="font-bold text-gray-800 text-sm">Mission {i + 1}. {m.title}</span>
          </div>
          <p className="text-sm text-gray-700 mb-3">{m.description}</p>
          {m.default_code && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">기본 코드:</p>
              <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono overflow-x-auto">{m.default_code}</pre>
            </div>
          )}
          {m.example && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono">
              {m.example}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const TABS = [
  { key: "concept", label: "개념 설명", Icon: BookOpen },
  { key: "tables", label: "표", Icon: Table },
  { key: "codes", label: "예제 코드", Icon: Code2 },
  { key: "questions", label: "Question", Icon: HelpCircle },
  { key: "missions", label: "Mission", Icon: Target },
];

/**
 * GenericUnitViewer — 학생용 공통 Unit 학습 화면
 * props: subjectType, subjectId, label, color
 */
export default function GenericUnitViewer({ subjectType = "other", subjectId, label = "학습" }) {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [activeTab, setActiveTab] = useState("concept");
  const [loading, setLoading] = useState(true);

  const color = SUBJECT_COLOR[subjectType] || "gray";
  const c = colorMap[color] || colorMap.gray;

  useEffect(() => {
    loadUnits();
  }, [subjectType, subjectId]);

  const loadUnits = async () => {
    setLoading(true);
    const data = await loadGenericUnits(subjectType, subjectId);
    setUnits(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>;
  }

  if (selectedUnit) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedUnit(null)} className="h-8 text-sm">
          <ChevronLeft className="w-4 h-4 mr-1" />목록으로
        </Button>

        <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
          <div className="flex items-center gap-3">
            <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${c.badge}`}>
              {selectedUnit.unit_number}
            </span>
            <div>
              <h2 className="font-bold text-gray-900">{selectedUnit.title}</h2>
              {selectedUnit.subtitle && <p className="text-sm text-gray-500">{selectedUnit.subtitle}</p>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {TABS.map(({ key, label: tabLabel, Icon: TabIcon }) => {
            const hasContent = {
              concept: selectedUnit.concept_sections?.length > 0,
              tables: selectedUnit.tables?.length > 0,
              codes: selectedUnit.example_codes?.length > 0,
              questions: selectedUnit.questions?.length > 0,
              missions: selectedUnit.missions?.length > 0,
            }[key];
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === key ? `border-current ${c.text}` : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                <TabIcon className="w-3.5 h-3.5" />
                {tabLabel}
                {hasContent && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-0.5" />}
              </button>
            );
          })}
        </div>

        <div>
          {activeTab === "concept" && <ConceptView sections={selectedUnit.concept_sections} />}
          {activeTab === "tables" && <TablesView tables={selectedUnit.tables} />}
          {activeTab === "codes" && <ExamplesView codes={selectedUnit.example_codes} />}
          {activeTab === "questions" && <QuestionsView questions={selectedUnit.questions} />}
          {activeTab === "missions" && <MissionsView missions={selectedUnit.missions} />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className={`w-5 h-5 ${c.text}`} />
        <h2 className="font-bold text-gray-900">{label} 학습</h2>
        <Badge variant="outline" className="text-xs">{units.length}개 Unit</Badge>
      </div>

      {units.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          아직 학습 Unit이 없습니다.
        </div>
      )}

      {units.map(u => (
        <button key={u.id} onClick={() => { setSelectedUnit(u); setActiveTab("concept"); }}
          className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all">
          <div className="flex items-center gap-3">
            <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${c.badge}`}>
              {u.unit_number}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{u.title}</p>
              {u.subtitle && <p className="text-xs text-gray-400 mt-0.5">{u.subtitle}</p>}
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {u.concept_sections?.length > 0 && <Badge variant="outline" className="text-xs">개념 {u.concept_sections.length}</Badge>}
                {u.example_codes?.length > 0 && <Badge variant="outline" className="text-xs">예제 {u.example_codes.length}</Badge>}
                {u.questions?.length > 0 && <Badge variant="outline" className="text-xs">Q {u.questions.length}</Badge>}
                {u.missions?.length > 0 && <Badge variant="outline" className="text-xs">Mission {u.missions.length}</Badge>}
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
          </div>
        </button>
      ))}
    </div>
  );
}