import React, { useState, useEffect } from "react";
import { loadAllUnitsWithSource, loadUnitContent, saveUnit, deleteUnit, toggleUnitActive, deleteProgressByUnit, deleteSubmissionsByUnit, deleteUnitsBySubject } from "@/lib/dataAccess";
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
  LearningObjectivesEditor,
  SummaryEditor,
} from "./PythonUnitEditor";
import AIUnitAssistant from "./AIUnitAssistant";
import AIUnitGenerator from "./AIUnitGenerator";
import AIFillDescription from "./AIFillDescription";

const CPP_DEFAULT_CODE = `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello CODA";\n    return 0;\n}`;

const emptyForm = (unitCount) => ({
  unit_number: unitCount + 1,
  title: "",
  subtitle: "",
  learning_objectives: [],
  concept_sections: [],
  tables: [],
  example_codes: [],
  questions: [],
  missions: [],
  summary: [],
  is_active: true,
});

const TABS = [
  { key: "objectives", label: "학습 목표" },
  { key: "concept", label: "개념 설명" },
  { key: "tables", label: "표" },
  { key: "codes", label: "예제 코드" },
  { key: "questions", label: "Question" },
  { key: "missions", label: "Mission" },
  { key: "summary", label: "핵심 요약" },
];

export default function CppUnitManagement() {
  const [units, setUnits] = useState([]);
  const [dataSource, setDataSource] = useState("github-json+google-sheets-overrides");
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(emptyForm(0));
  const [activeTab, setActiveTab] = useState("concept");
  const [saving, setSaving] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    const { units: data, source } = await loadAllUnitsWithSource("cpp");
    setUnits(data);
    setDataSource(source);
  };

  const openAdd = () => {
    setEditingUnit(null);
    setForm(emptyForm(units.length));
    setActiveTab("objectives");
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
      learning_objectives: data.learning_objectives || [],
      concept_sections: data.concept_sections || [],
      tables: data.tables || [],
      example_codes: data.example_codes || [],
      questions: loadedQuestions,
      missions: data.missions || [],
      summary: data.summary || [],
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
    if (!form.unit_number) {
      toast({ title: "오류", description: "Unit 번호를 입력해주세요.", variant: "destructive" });
      return;
    }
    setSaving(true);
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
    const saveData = {
      ...form,
      unit_number: Number(form.unit_number),
      questions: safeQuestions,
    };
    try {
      if (editingUnit) {
        await saveUnit("cpp", { ...saveData, id: editingUnit.id, subject_type: "cpp" });
        toast({ title: "수정 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
      } else {
        await saveUnit("cpp", { ...saveData, id: `cpp-unit-${saveData.unit_number}-${Date.now()}`, subject_type: "cpp" });
        toast({ title: "Unit 추가 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
      }
      await loadUnits();
      setShowForm(false);
      setEditingUnit(null);
    } catch (err) {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
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

  const handleDelete = async (unit) => {
    if (!confirm(`Unit ${unit.unit_number}. ${unit.title}을 학생 화면에서 숨기시겠습니까? 학습 기록은 유지됩니다.`)) return;
    try {
      await saveUnit("cpp", { ...unit, is_active: false });
      toast({ title: "단원 숨김 완료", description: "학생 학습 기록은 유지됩니다." });
      await loadUnits();
    } catch (err) { toast({ title: "숨김 실패", description: err.message, variant: "destructive" }); }
  };

  const handleDeleteAll = async () => {
    toast({ title: "전체 삭제 차단", description: "학생 학습 기록 보호를 위해 전체 삭제 기능은 지원하지 않습니다.", variant: "destructive" });
  };

  const toggleActive = async (u) => {
    await saveUnit("cpp", { ...u, is_active: !(u.is_active !== false) });
    loadUnits();
  };

  const handleApplyAIGeneratedUnit = (data, mode, mergeMode) => {
    setForm(prev => {
      const mergeField = (key) => {
        if (mergeMode === "merge") return [...(prev[key] || []), ...(data[key] || [])];
        return data[key] || [];
      };
      if (mode === "all") {
        return {
          ...prev,
          title: data.title || prev.title,
          subtitle: data.subtitle || prev.subtitle,
          learning_objectives: mergeMode === "merge" ? [...(prev.learning_objectives || []), ...(data.learning_objectives || [])] : (data.learning_objectives || []),
          concept_sections: mergeField("concept_sections"),
          tables: mergeField("tables"),
          example_codes: mergeField("example_codes"),
          questions: mergeField("questions"),
          missions: mergeField("missions"),
          summary: mergeMode === "merge" ? [...(prev.summary || []), ...(data.summary || [])] : (data.summary || []),
        };
      }
      const updates = {};
      for (const [key, val] of Object.entries(data)) {
        if (Array.isArray(val)) {
          updates[key] = mergeMode === "merge" ? [...(prev[key] || []), ...val] : val;
        } else {
          updates[key] = val;
        }
      }
      return { ...prev, ...updates };
    });
    setActiveTab("objectives");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h4 className="font-bold text-gray-900">C++ Unit 관리</h4>
          <Badge variant="outline" className="text-xs">{units.length}개</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openAdd} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5 mr-1" />Unit 추가
          </Button>
          {units.length > 0 && (
            <Button onClick={handleDeleteAll} size="sm" variant="outline" disabled={deletingAll} className="text-red-600 border-red-300 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {deletingAll ? "C++ Unit 삭제 중..." : "전체 삭제"}
            </Button>
          )}
        </div>
      </div>

      

      <div className="space-y-2">
        {units.map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
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
              <TeachingButton subjectType="cpp" unitId={u.id} />
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
            <DialogTitle>{editingUnit ? "C++ Unit 수정" : "C++ Unit 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unit 번호 *</Label>
                <Input type="number" value={form.unit_number} onChange={e => setForm({ ...form, unit_number: e.target.value })} placeholder="1" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Unit 제목 *</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Unit 제목" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>부제목</Label>
              <Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="부제목 (선택)" className="mt-1" />
            </div>

            {/* AI로 Unit 만들기 */}
            <div className="flex gap-2 flex-wrap">
              <AIUnitGenerator subject="cpp" subjectName="C++" previousUnits={units} currentForm={form} onApply={handleApplyAIGeneratedUnit} />
              <AIFillDescription
                subject="cpp"
                currentForm={form}
                previousUnits={units}
                currentUnitNumber={form.unit_number}
                onApply={(data) => setForm(prev => ({
                  ...prev,
                  learning_objectives: data.learning_objectives || prev.learning_objectives,
                  concept_sections: data.concept_sections || prev.concept_sections,
                  summary: data.summary || prev.summary,
                }))}
              />
            </div>

            {/* AI 개별 섹션 생성 */}
            <AIUnitAssistant
              subject="cpp"
              unitTitle={form.title}
              unitContent={form}
              previousUnits={units}
              currentUnitNumber={form.unit_number}
              onApplyConcepts={val => setForm(f => ({ ...f, concept_sections: [...(f.concept_sections || []), ...val] }))}
              onApplyTables={val => setForm(f => ({ ...f, tables: [...(f.tables || []), ...val] }))}
              onApplyExamples={val => setForm(f => ({ ...f, example_codes: [...(f.example_codes || []), ...val] }))}
              onApplyQuestions={val => setForm(f => ({ ...f, questions: [...(f.questions || []), ...val].map((q, i) => ({ ...q, number: i + 1 })) }))}
              onApplyMissions={val => setForm(f => ({ ...f, missions: [...(f.missions || []), ...val].map((m, i) => ({ ...m, number: i + 1 })) }))}
            />

            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[300px]">
              {activeTab === "objectives" && (
                <LearningObjectivesEditor items={form.learning_objectives} onChange={val => setForm(f => ({ ...f, learning_objectives: val }))} />
              )}
              {activeTab === "concept" && (
                <ConceptSectionsEditor sections={form.concept_sections} onChange={val => setForm(f => ({ ...f, concept_sections: val }))} />
              )}
              {activeTab === "tables" && (
                <TablesEditor tables={form.tables} onChange={val => setForm(f => ({ ...f, tables: val }))} />
              )}
              {activeTab === "codes" && (
                <ExampleCodesEditor
                  codes={form.example_codes}
                  onChange={val => setForm(f => ({ ...f, example_codes: val }))}
                  defaultCode={CPP_DEFAULT_CODE}
                  defaultFilename="example.cpp"
                  language="cpp"
                />
              )}
              {activeTab === "questions" && (
                <QuestionsEditor questions={form.questions} onChange={val => setForm(f => ({ ...f, questions: val }))} subject="cpp" />
              )}
              {activeTab === "missions" && (
                <MissionsEditor missions={form.missions} onChange={val => setForm(f => ({ ...f, missions: val }))} defaultCode={CPP_DEFAULT_CODE} />
              )}
              {activeTab === "summary" && (
                <SummaryEditor items={form.summary} onChange={val => setForm(f => ({ ...f, summary: val }))} />
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="cpp_unit_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="cpp_unit_active">사용 여부 (학생 화면에 표시)</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCloseForm} disabled={saving} className="flex-1">취소</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}