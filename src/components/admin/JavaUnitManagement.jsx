import React, { useState, useEffect } from "react";
import { loadAllUnitsWithSource, loadUnitContent, saveUnit, deleteUnit, toggleUnitActive, deleteProgressByUnit, deleteSubmissionsByUnit } from "@/lib/dataAccess";
import TeachingButton from "@/components/teaching/TeachingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, BookOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AIUnitGenerator from "@/components/admin/AIUnitGenerator";
import AIUnitAssistant from "@/components/admin/AIUnitAssistant";
import {
  ConceptSectionsEditor,
  TablesEditor,
  ExampleCodesEditor,
  QuestionsEditor,
  MissionsEditor,
  LearningObjectivesEditor,
  SummaryEditor,
} from "./PythonUnitEditor";

const JAVA_DEFAULT_CODE = `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello CODA");\n    }\n}`;

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

export default function JavaUnitManagement() {
  const [units, setUnits] = useState([]);
  const [dataSource, setDataSource] = useState("base44");
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(emptyForm(0));
  const [activeTab, setActiveTab] = useState("concept");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    const { units: data, source } = await loadAllUnitsWithSource("java");
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
    const latest = fullUnit || u;

    const loadedQuestions = (latest.questions || []).map(q => ({
      code_block: "", expected_output: "", explanation: "",
      options: [], pairs: [], answer: "", code_items: [], difficulty: "",
      ...q,
    }));
    setEditingUnit(latest);
    setForm({
      unit_number: latest.unit_number || 1,
      title: latest.title || "",
      subtitle: latest.subtitle || "",
      learning_objectives: latest.learning_objectives || [],
      concept_sections: latest.concept_sections || [],
      tables: latest.tables || [],
      example_codes: latest.example_codes || [],
      questions: loadedQuestions,
      missions: latest.missions || [],
      summary: latest.summary || [],
      is_active: latest.is_active !== false,
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
    const safeQuestions = (form.questions || []).map((q, i) => ({
      number: q.number || i + 1,
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
    const safeMissions = (form.missions || []).map((m, i) => ({
      ...m,
      number: m.number || i + 1,
      grading_mode: m.grading_mode || "normalize",
      test_cases: m.test_cases || [],
    }));
    const saveData = {
      ...form,
      unit_number: Number(form.unit_number),
      questions: safeQuestions,
      missions: safeMissions,
    };
    if (editingUnit) {
      await saveUnit({ ...saveData, id: editingUnit.id, subject_type: "java" });
      toast({ title: "수정 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
    } else {
      await saveUnit({ ...saveData, subject_type: "java" });
      toast({ title: "Unit 추가 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
    }
    await loadUnits();
    setSaving(false);
    setShowForm(false);
    setEditingUnit(null);
  };

  const handleCloseForm = () => {
    if (saving) return;
    if (window.confirm("저장하지 않고 닫으시겠습니까? 변경사항이 유실됩니다.")) {
      setShowForm(false);
      setEditingUnit(null);
    }
  };

  const handleDelete = async (unit) => {
    if (!confirm(`Unit ${unit.unit_number}. ${unit.title}을 삭제하시겠습니까?`)) return;
    await Promise.all([
      deleteUnit(unit.id),
      deleteProgressByUnit(unit.id),
      deleteSubmissionsByUnit(unit.id),
    ]);
    toast({ title: "삭제 완료" });
    loadUnits();
  };

  const toggleActive = async (u) => {
    await toggleUnitActive(u.id, !u.is_active);
    loadUnits();
  };

  // ── AI 생성 적용 ──
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
      // 부분 적용
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
          <BookOpen className="w-5 h-5 text-red-600" />
          <h4 className="font-bold text-gray-900">Java Unit 관리</h4>
          <Badge variant="outline" className="text-xs">{units.length}개</Badge>
        </div>
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700">
          <Plus className="w-3.5 h-3.5 mr-1" />Unit 추가
        </Button>
      </div>

      

      <div className="space-y-2">
        {units.map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-sm font-bold text-red-700 flex-shrink-0">
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
              <TeachingButton subjectType="java" unitId={u.id} />
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
            <DialogTitle>{editingUnit ? "Java Unit 수정" : "Java Unit 추가"}</DialogTitle>
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
            <AIUnitGenerator
              subject="java"
              subjectName="Java"
              previousUnits={units}
              currentForm={form}
              onApply={handleApplyAIGeneratedUnit}
            />

            {/* AI 개별 섹션 생성 */}
            <AIUnitAssistant
              subject="java"
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

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.key ? "border-red-600 text-red-700" : "border-transparent text-gray-500 hover:text-gray-700"
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
                  defaultCode={JAVA_DEFAULT_CODE}
                  defaultFilename="Main.java"
                />
              )}
              {activeTab === "questions" && (
                <QuestionsEditor questions={form.questions} onChange={val => setForm(f => ({ ...f, questions: val }))} subject="java" />
              )}
              {activeTab === "missions" && (
                <MissionsEditor missions={form.missions} onChange={val => setForm(f => ({ ...f, missions: val }))} defaultCode={JAVA_DEFAULT_CODE} />
              )}
              {activeTab === "summary" && (
                <SummaryEditor items={form.summary} onChange={val => setForm(f => ({ ...f, summary: val }))} />
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="java_unit_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="java_unit_active">사용 여부 (학생 화면에 표시)</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCloseForm} disabled={saving} className="flex-1">취소</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700">
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}