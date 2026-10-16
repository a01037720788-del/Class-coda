import React, { useState, useEffect } from "react";
import { loadAllUnitsWithSource, loadUnitContent, saveUnit, deleteUnit, toggleUnitActive, deleteProgressByUnit, deleteSubmissionsByUnit } from "@/lib/dataAccess";
import { extractFunctionError } from "@/lib/errorUtils";
import TeachingButton from "@/components/teaching/TeachingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, BookOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  ConceptSectionsEditor,
  TablesEditor,
  ExampleCodesEditor,
  QuestionsEditor,
  MissionsEditor,
} from "./PythonUnitEditor";
import AIUnitAssistant from "./AIUnitAssistant";

// 과목 유형별 기본 코드
const DEFAULT_CODE = {
  python: 'print("Hello CODA")',
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello CODA";\n    return 0;\n}`,
  html: `<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8">\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n</body>\n</html>`,
  algorithm: 'print("Hello CODA")',
  entry: "",
  block: "",
  cos: "",
  other: "",
};

const DEFAULT_FILENAME = {
  python: "example.py",
  cpp: "example.cpp",
  html: "index.html",
  algorithm: "solution.py",
  entry: "example.txt",
  block: "example.txt",
  cos: "example.txt",
  other: "example.txt",
};

const SUBJECT_COLOR = {
  python: "green",
  cpp: "blue",
  html: "emerald",
  algorithm: "amber",
  entry: "purple",
  block: "pink",
  cos: "red",
  other: "gray",
};

const emptyForm = (subjectType, unitCount) => ({
  unit_number: unitCount + 1,
  title: "",
  subtitle: "",
  concept_sections: [],
  tables: [],
  example_codes: [],
  questions: [],
  missions: [],
  is_active: true,
});

const TABS = [
  { key: "concept", label: "개념 설명" },
  { key: "tables", label: "표" },
  { key: "codes", label: "예제 코드" },
  { key: "questions", label: "Question" },
  { key: "missions", label: "Mission" },
];

/**
 * CommonUnitManagement
 * props:
 *   subjectType: "python" | "cpp" | "html" | "algorithm" | "entry" | "block" | "cos" | "other"
 *   subjectId: Subject 엔티티 ID (optional)
 *   label: "Python" | "C++" | ... (표시명)
 */
export default function CommonUnitManagement({ subjectType = "other", subjectId, label }) {
  const [units, setUnits] = useState([]);
  const [dataSource, setDataSource] = useState("base44");
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(emptyForm(subjectType, 0));
  const [activeTab, setActiveTab] = useState("concept");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const color = SUBJECT_COLOR[subjectType] || "gray";

  useEffect(() => { loadUnits(); }, [subjectType, subjectId]);

  const loadUnits = async () => {
    const { units: data, source } = await loadAllUnitsWithSource(subjectType);
    const filtered = subjectId ? data.filter(u => u.subject_id === subjectId) : data;
    setUnits(filtered);
    setDataSource(source);
  };

  const openAdd = () => {
    setEditingUnit(null);
    setForm(emptyForm(subjectType, units.length));
    setActiveTab("concept");
    setShowForm(true);
  };

  const openEdit = async (u) => {
    const fullUnit = await loadUnitContent(u.id);
    const data = fullUnit || u;
    const loadedQuestions = (data.questions || []).map(q => ({
      code_block: "", expected_output: "", explanation: "",
      options: [], pairs: [], answer: "", code_items: [], difficulty: "",
      ...q,
    }));
    setEditingUnit(data);
    setForm({
      unit_number: data.unit_number || 1,
      title: data.title || "",
      subtitle: data.subtitle || "",
      concept_sections: data.concept_sections || [],
      tables: data.tables || [],
      example_codes: data.example_codes || [],
      questions: loadedQuestions,
      missions: data.missions || [],
      is_active: data.is_active !== false,
    });
    setActiveTab("concept");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) {
      toast({ title: "오류", description: "Unit 제목을 입력해주세요.", variant: "destructive" });
      return;
    }
    if (form.unit_number === "" || form.unit_number === null || form.unit_number === undefined) {
      toast({ title: "오류", description: "Unit 번호를 입력해주세요.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const safeQuestions = (form.questions || []).map(q => ({
        number: q.number,
        type: q.type || "객관식",
        question: q.question || "",
        options: q.options || [],
        pairs: q.pairs || [],
        answer: q.answer || "",
        explanation: q.explanation || "",
        difficulty: q.difficulty || "",
        code_block: q.code_block || "",
        expected_output: q.expected_output || "",
        code_items: (q.code_items || []).map(item => ({
          code: item.code || "",
          expected_output: item.expected_output || "",
          description: item.description || "",
        })),
      }));
      const safeMissions = (form.missions || []).map(m => ({
        number: m.number,
        title: m.title || "",
        description: m.description || "",
        default_code: m.default_code || DEFAULT_CODE[subjectType] || "",
        expected_output: m.expected_output || "",
        input_condition: m.input_condition || "",
        output_condition: m.output_condition || "",
        example: m.example || "",
      }));
      const saveData = {
        ...form,
        subject_type: subjectType,
        subject_id: subjectId || "",
        unit_number: Number(form.unit_number),
        questions: safeQuestions,
        missions: safeMissions,
      };

      if (editingUnit) {
        await saveUnit({ ...saveData, id: editingUnit.id });
        toast({ title: "수정 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
      } else {
        await saveUnit({ ...saveData });
        toast({ title: "Unit 추가 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
      }
      await loadUnits();
      setShowForm(false);
      setEditingUnit(null);
    } catch (err) {
      console.error("Unit 저장 실패:", err);
      const errorMsg = extractFunctionError(err, "Unit 저장 실패");
      toast({ title: "저장 실패", description: errorMsg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseForm = () => {
    if (saving) return;
    if (window.confirm("저장하지 않고 닫으시겠습니까? 변경사항이 유실됩니다.")) {
      setShowForm(false);
      setEditingUnit(null);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Unit ${u.unit_number}. ${u.title}을 삭제하시겠습니까?`)) return;
    await Promise.all([
      deleteUnit(u.id),
      deleteProgressByUnit(u.id),
      deleteSubmissionsByUnit(u.id),
    ]);
    toast({ title: "삭제 완료" });
    loadUnits();
  };

  const toggleActive = async (u) => {
    await toggleUnitActive(u.id, !u.is_active);
    loadUnits();
  };

  const colorClasses = {
    green: { badge: "bg-green-100 text-green-700", btn: "bg-green-600 hover:bg-green-700", tab: "border-green-600 text-green-700", icon: "text-green-600" },
    blue: { badge: "bg-blue-100 text-blue-700", btn: "bg-blue-600 hover:bg-blue-700", tab: "border-blue-600 text-blue-700", icon: "text-blue-600" },
    emerald: { badge: "bg-emerald-100 text-emerald-700", btn: "bg-emerald-600 hover:bg-emerald-700", tab: "border-emerald-600 text-emerald-700", icon: "text-emerald-600" },
    amber: { badge: "bg-amber-100 text-amber-700", btn: "bg-amber-600 hover:bg-amber-700", tab: "border-amber-600 text-amber-700", icon: "text-amber-600" },
    purple: { badge: "bg-purple-100 text-purple-700", btn: "bg-purple-600 hover:bg-purple-700", tab: "border-purple-600 text-purple-700", icon: "text-purple-600" },
    pink: { badge: "bg-pink-100 text-pink-700", btn: "bg-pink-600 hover:bg-pink-700", tab: "border-pink-600 text-pink-700", icon: "text-pink-600" },
    red: { badge: "bg-red-100 text-red-700", btn: "bg-red-600 hover:bg-red-700", tab: "border-red-600 text-red-700", icon: "text-red-600" },
    gray: { badge: "bg-gray-100 text-gray-700", btn: "bg-gray-600 hover:bg-gray-700", tab: "border-gray-600 text-gray-700", icon: "text-gray-600" },
  };
  const c = colorClasses[color] || colorClasses.gray;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className={`w-5 h-5 ${c.icon}`} />
          <h4 className="font-bold text-gray-900">{label || subjectType} Unit 관리</h4>
          <Badge variant="outline" className="text-xs">{units.length}개</Badge>
        </div>
        <Button onClick={openAdd} size="sm" className={c.btn}>
          <Plus className="w-3.5 h-3.5 mr-1" />Unit 추가
        </Button>
      </div>

      

      <div className="space-y-2">
        {units.map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${c.badge}`}>
                {u.unit_number}
              </span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{u.title}</p>
                {u.subtitle && <p className="text-xs text-gray-400 mt-0.5">{u.subtitle}</p>}
                <div className="flex gap-1 mt-1 flex-wrap">
                  {u.concept_sections_count > 0 && <Badge variant="outline" className="text-xs">개념 {u.concept_sections_count}</Badge>}
                  {u.tables_count > 0 && <Badge variant="outline" className="text-xs">표 {u.tables_count}</Badge>}
                  {u.example_codes_count > 0 && <Badge variant="outline" className="text-xs">코드 {u.example_codes_count}</Badge>}
                  {u.questions_count > 0 && <Badge variant="outline" className="text-xs">Q {u.questions_count}</Badge>}
                  {u.missions_count > 0 && <Badge variant="outline" className="text-xs">Mission {u.missions_count}</Badge>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(u)} className="flex items-center gap-1 text-xs">
                {u.is_active !== false
                  ? <ToggleRight className="w-5 h-5 text-green-500" />
                  : <ToggleLeft className="w-5 h-5 text-gray-400" />}
              </button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="h-7 w-7 p-0">
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <TeachingButton subjectType={subjectType} unitId={u.id} />
              <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} className="h-7 w-7 p-0 text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {units.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            Unit이 없습니다. Unit을 추가해주세요.
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleCloseForm(); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? `Unit 수정 — ${label || subjectType}` : `Unit 추가 — ${label || subjectType}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unit 번호 *</Label>
                <Input
                  type="number"
                  value={form.unit_number}
                  onChange={e => setForm({ ...form, unit_number: e.target.value })}
                  placeholder="1"
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label>Unit 제목 *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Unit 제목"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>부제목</Label>
              <Input
                value={form.subtitle}
                onChange={e => setForm({ ...form, subtitle: e.target.value })}
                placeholder="부제목 (선택)"
                className="mt-1"
              />
            </div>

            {/* AI 생성 */}
            <AIUnitAssistant
              subject={subjectType}
              unitTitle={form.title}
              unitContent={form}
              onApplyConcepts={val => setForm(f => ({ ...f, concept_sections: [...(f.concept_sections || []), ...val] }))}
              onApplyTables={val => setForm(f => ({ ...f, tables: [...(f.tables || []), ...val] }))}
              onApplyExamples={val => setForm(f => ({ ...f, example_codes: [...(f.example_codes || []), ...val] }))}
              onApplyQuestions={val => setForm(f => ({ ...f, questions: [...(f.questions || []), ...val].map((q, i) => ({ ...q, number: i + 1 })) }))}
              onApplyMissions={val => setForm(f => ({ ...f, missions: [...(f.missions || []), ...val].map((m, i) => ({ ...m, number: i + 1 })) }))}
            />

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.key ? `${c.tab} border-current` : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[300px]">
              {activeTab === "concept" && (
                <ConceptSectionsEditor
                  sections={form.concept_sections}
                  onChange={val => setForm(f => ({ ...f, concept_sections: val }))}
                />
              )}
              {activeTab === "tables" && (
                <TablesEditor
                  tables={form.tables}
                  onChange={val => setForm(f => ({ ...f, tables: val }))}
                />
              )}
              {activeTab === "codes" && (
                <ExampleCodesEditor
                  codes={form.example_codes}
                  onChange={val => setForm(f => ({ ...f, example_codes: val }))}
                  defaultCode={DEFAULT_CODE[subjectType]}
                  defaultFilename={DEFAULT_FILENAME[subjectType]}
                />
              )}
              {activeTab === "questions" && (
                <QuestionsEditor
                  questions={form.questions}
                  onChange={val => setForm(f => ({ ...f, questions: val }))}
                  subject={subjectType}
                />
              )}
              {activeTab === "missions" && (
                <MissionsEditor
                  missions={form.missions}
                  onChange={val => setForm(f => ({ ...f, missions: val }))}
                  defaultCode={DEFAULT_CODE[subjectType]}
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="generic_unit_active"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
              />
              <Label htmlFor="generic_unit_active">사용 여부 (학생 화면에 표시)</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCloseForm} disabled={saving} className="flex-1">취소</Button>
              <Button onClick={handleSave} disabled={saving} className={`flex-1 ${c.btn}`}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}