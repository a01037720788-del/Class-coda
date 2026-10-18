import React, { useState, useEffect } from "react";
import { loadAllUnits, saveUnit } from "@/lib/dataAccess";
import { loadUnitsFromRepo } from "@/lib/unitsRepo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, BookOpen, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import PythonToCppConverter from "@/components/admin/PythonToCppConverter";
import { useUnitReorder } from "@/hooks/useUnitReorder";
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
import TeachingButton from "@/components/teaching/TeachingButton";

const emptyForm = {
  unit_number: "",
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
};

export default function PythonUnitManagement() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("concept");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const data = await loadAllUnits("python");
      // unit_number 기준 오름차순 정렬
      const sorted = [...(data || [])].sort((a, b) => (a.unit_number || 0) - (b.unit_number || 0));
      setUnits(sorted);
    } catch (err) {
      console.error("[PythonUnitManagement] 목록 로드 실패:", err);
      toast({ title: "목록 로드 실패", description: err.message, variant: "destructive" });
      setUnits([]);
    }
    setLoading(false);
  };

  const reordering = false;
  const handleReorder = async (newOrder) => {
    const numbered = newOrder.map((u,i) => ({...u, unit_number:i+1}));
    try {
      for (const unit of numbered) await saveUnit("python", unit);
      await loadUnits();
    } catch(err) { toast({title:"순서 저장 실패",description:err.message,variant:"destructive"}); await loadUnits(); }
  };

  const moveUp = (index) => {
    if (index === 0 || reordering) return;
    const newOrder = [...units];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    handleReorder(newOrder);
  };

  const moveDown = (index) => {
    if (index === units.length - 1 || reordering) return;
    const newOrder = [...units];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    handleReorder(newOrder);
  };

  const onDragEnd = (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const newOrder = [...units];
    const [moved] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, moved);
    handleReorder(newOrder);
  };

  const openAdd = () => {
    setEditingUnit(null);
    setForm({ ...emptyForm, unit_number: units.length + 1 });
    setActiveTab("objectives");
    setShowForm(true);
  };

  const openEdit = (u) => {
    // Base44 entity는 전체 데이터를 반환하므로 그대로 사용
    const loadedQuestions = (u.questions || []).map(q => ({
      code_block: "",
      expected_output: "",
      explanation: "",
      options: [],
      pairs: [],
      answer: "",
      test_cases: [],
      code_items: [],
      ...q,
    }));

    setEditingUnit(u);
    setForm({
      unit_number: u.unit_number || "",
      title: u.title || "",
      subtitle: u.subtitle || "",
      learning_objectives: u.learning_objectives || [],
      concept_sections: u.concept_sections || [],
      tables: u.tables || [],
      example_codes: u.example_codes || [],
      questions: loadedQuestions,
      missions: u.missions || [],
      summary: u.summary || [],
      is_active: u.is_active !== false,
    });
    setActiveTab("concept");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast({ title: "오류", description: "Unit 제목을 입력해주세요.", variant: "destructive" }); return; }
    if (!form.unit_number) { toast({ title: "오류", description: "Unit 번호를 입력해주세요.", variant: "destructive" }); return; }
    const dupNum = units.find(u => u.unit_number === Number(form.unit_number) && u.id !== editingUnit?.id);
    if (dupNum) { toast({ title: "오류", description: "이미 사용 중인 Unit 번호입니다.", variant: "destructive" }); return; }
    setSaving(true);
    // questions: 모든 필드 누락 방지
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
      test_cases: q.test_cases || [],
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
        await saveUnit("python", { ...editingUnit, ...saveData });
        toast({ title: "수정 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
      } else {
        await saveUnit("python", { ...saveData, id: `python-unit-${saveData.unit_number}-${Date.now()}` });
        toast({ title: "Unit 추가 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
      }
      await loadUnits();
      setShowForm(false);
      setEditingUnit(null);
    } catch (err) {
      console.error("[PythonUnitManagement] 저장 실패:", err);
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleCloseForm = () => {
    if (saving) return;
    if (window.confirm("저장하지 않고 닫으시겠습니까? 변경사항이 유실됩니다.")) {
      setShowForm(false);
      setEditingUnit(null);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Unit ${u.unit_number}. ${u.title} 을(를) 삭제하시겠습니까?`)) return;
    try {
      await saveUnit("python", { ...u, is_active: false });
      toast({ title: "삭제 완료" });
      loadUnits();
    } catch (err) {
      console.error("[PythonUnitManagement] 삭제 실패:", err);
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    }
  };

  const toggleActive = async (u) => {
    try {
      await saveUnit("python", { ...u, is_active: !(u.is_active !== false) });
      loadUnits();
    } catch (err) {
      toast({ title: "상태 변경 실패", description: err.message, variant: "destructive" });
    }
  };

  const TABS = [
    { key: "objectives", label: "학습 목표" },
    { key: "concept", label: "개념 설명" },
    { key: "tables", label: "표" },
    { key: "codes", label: "예제 코드" },
    { key: "questions", label: "Question" },
    { key: "missions", label: "Mission" },
    { key: "summary", label: "핵심 요약" },
  ];

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
          <BookOpen className="w-5 h-5 text-green-600" />
          <h4 className="font-bold text-gray-900">Python Unit 관리</h4>
          <Badge variant="outline" className="text-xs">{units.length}개</Badge>
        </div>
        <div className="flex gap-2">
          <PythonToCppConverter />
          <Button onClick={openAdd} size="sm" className="bg-green-600 hover:bg-green-700">
            <Plus className="w-3.5 h-3.5 mr-1" />Unit 추가
          </Button>
        </div>
      </div>

      {reordering && (
        <div className="text-center py-2 text-sm text-blue-600 bg-blue-50 rounded-lg mb-2 font-medium">
          Unit 순서 저장 중...
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="python-units">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {loading && (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg">
                  불러오는 중...
                </div>
              )}
              {!loading && units.map((u, index) => (
                <Draggable key={u.id} draggableId={u.id} index={index}>
                  {(prov) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      className={`flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 ${reordering ? "opacity-60 pointer-events-none" : ""}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* 드래그 핸들 — 이 부분을 잡아야만 이동 (모바일 스크롤 보호) */}
                        <div
                          {...prov.dragHandleProps}
                          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none flex-shrink-0 px-1"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-700 flex-shrink-0">
                          {u.unit_number}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{u.title}</p>
                          {u.subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{u.subtitle}</p>}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {(u.concept_sections?.length || 0) > 0 && <Badge variant="outline" className="text-xs">개념 {u.concept_sections.length}</Badge>}
                            {(u.tables?.length || 0) > 0 && <Badge variant="outline" className="text-xs">표 {u.tables.length}</Badge>}
                            {(u.example_codes?.length || 0) > 0 && <Badge variant="outline" className="text-xs">코드 {u.example_codes.length}</Badge>}
                            {(u.questions?.length || 0) > 0 && <Badge variant="outline" className="text-xs">Q {u.questions.length}</Badge>}
                            {(u.missions?.length || 0) > 0 && <Badge variant="outline" className="text-xs">Mission {u.missions.length}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => moveUp(index)} disabled={index === 0 || reordering} className="h-7 w-7 p-0">
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => moveDown(index)} disabled={index === units.length - 1 || reordering} className="h-7 w-7 p-0">
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <button onClick={() => toggleActive(u)} className="flex items-center gap-1 text-xs" disabled={reordering}>
                          {u.is_active !== false
                            ? <ToggleRight className="w-5 h-5 text-green-500" />
                            : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="h-7 w-7 p-0" disabled={reordering}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <TeachingButton subjectType="python" unitId={u.id} disabled={reordering} />
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" disabled={reordering}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {!loading && units.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg">
                  Unit이 없습니다. Unit을 추가해주세요.
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleCloseForm(); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Unit 수정" : "Unit 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unit 번호 *</Label>
                <Input type="number" value={form.unit_number} onChange={e => setForm({ ...form, unit_number: e.target.value })} placeholder="1" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Unit 제목 *</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="print()와 출력" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>부제목</Label>
              <Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="예: 파이썬의 기본 출력 함수" className="mt-1" />
            </div>

            {/* AI로 Unit 전체 생성 — 항상 표시 */}
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50/50">
              <p className="text-xs text-purple-700 mb-2 font-medium">🤖 AI로 Unit 전체를 자동 생성할 수 있습니다</p>
              <AIUnitGenerator subject="python" subjectName="Python" previousUnits={units} currentForm={form} onApply={handleApplyAIGeneratedUnit} />
            </div>

            {/* AI 개별 섹션 생성 */}
            <AIUnitAssistant
              subject="python"
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
                    activeTab === tab.key ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"
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
                <ExampleCodesEditor codes={form.example_codes} onChange={val => setForm(f => ({ ...f, example_codes: val }))} />
              )}
              {activeTab === "questions" && (
                <QuestionsEditor questions={form.questions} onChange={val => setForm(f => ({ ...f, questions: val }))} subject="python" />
              )}
              {activeTab === "missions" && (
                <MissionsEditor missions={form.missions} onChange={val => setForm(f => ({ ...f, missions: val }))} />
              )}
              {activeTab === "summary" && (
                <SummaryEditor items={form.summary} onChange={val => setForm(f => ({ ...f, summary: val }))} />
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="unit_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="unit_active">사용 여부 (학생 화면에 표시)</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCloseForm} disabled={saving} className="flex-1">취소</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}