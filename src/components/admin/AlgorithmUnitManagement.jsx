import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, BookOpen, GripVertical, ChevronUp, ChevronDown, Play } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useUnitReorder } from "@/hooks/useUnitReorder";
import { useToast } from "@/components/ui/use-toast";
import {
  StringListEditor,
  ConceptSectionsEditor,
  AlgorithmFlowEditor,
  ExampleCodesEditor,
  QuestionsEditor,
  CodeBlanksEditor,
  ImplementationsEditor,
  MissionsEditor,
  TestCasesEditor,
} from "./AlgorithmUnitEditor";
import AIAlgorithmUnitGenerator from "./AIAlgorithmUnitGenerator";
import JudgeProblemsEditor from "./JudgeProblemsEditor";
import { ALGORITHM_LABELS } from "@/lib/algorithmSimulators";
import TeachingButton from "@/components/teaching/TeachingButton";

const DIFFICULTY_LABELS = { "입문": "입문", "기초": "기초", "중급": "중급", "심화": "심화", "대회": "대회" };
const TAG_LABELS = ["탐색", "정렬", "자료구조", "DFS/BFS", "그리디", "누적합", "투포인터", "재귀", "분할정복", "DP", "그래프", "기타"];

const emptyForm = {
  unit_number: "",
  title: "",
  subtitle: "",
  difficulty: "기초",
  algorithm_tag: "기타",
  learning_objectives: [],
  concept_sections: [],
  why_needed: [],
  core_idea: [],
  algorithm_flow: [],
  simulator: { enabled: false, algorithm_type: "linear_search", array_data: [], target: 0, description: "", auto_speed: 1000, graph_nodes: [], graph_edges: [], start_node: "" },
  example_codes: [],
  questions: [],
  code_blanks: [],
  implementations: [],
  judge_problems: [],
  missions: [],
  summary: [],
  is_active: true,
};

const TABS = [
  { key: "info", label: "기본 정보" },
  { key: "objectives", label: "학습 목표" },
  { key: "concept", label: "1. 개념 설명" },
  { key: "why", label: "2. 왜 필요한가" },
  { key: "core", label: "3. 핵심 아이디어" },
  { key: "flow", label: "4. 알고리즘 흐름" },
  { key: "simulator", label: "5. 시뮬레이터" },
  { key: "examples", label: "6. 예제 코드" },
  { key: "questions", label: "7. Question" },
  { key: "blanks", label: "8. 코드 빈칸" },
  { key: "impl", label: "9. 직접 구현" },
  { key: "judge", label: "11. 문제 풀이" },
  { key: "missions", label: "10. Mission" },
  { key: "summary", label: "요약" },
];

export default function AlgorithmUnitManagement() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("info");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.AlgorithmUnit.list();
      const sorted = [...(data || [])].sort((a, b) => (a.unit_number || 0) - (b.unit_number || 0));
      setUnits(sorted);
    } catch (err) {
      console.error("[AlgorithmUnitManagement] 로드 실패:", err);
      toast({ title: "목록 로드 실패", description: err.message, variant: "destructive" });
      setUnits([]);
    }
    setLoading(false);
  };

  const { saving: reordering, saveOrder } = useUnitReorder({
    entityName: "AlgorithmUnit",
    toast,
    onReload: loadUnits,
  });

  const handleReorder = async (newOrder) => {
    setUnits(newOrder);
    await saveOrder(newOrder);
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const next = [...units];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    handleReorder(next);
  };
  const moveDown = (index) => {
    if (index === units.length - 1) return;
    const next = [...units];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    handleReorder(next);
  };

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const next = [...units];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    handleReorder(next);
  };

  const openAdd = () => {
    setEditingUnit(null);
    setForm({ ...emptyForm, unit_number: units.length + 1 });
    setActiveTab("info");
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditingUnit(u);
    setForm({
      ...emptyForm,
      ...u,
      simulator: { ...emptyForm.simulator, ...(u.simulator || {}) },
    });
    setActiveTab("info");
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingUnit(null);
    setForm(emptyForm);
  };

  const toggleActive = async (u) => {
    try {
      await base44.entities.AlgorithmUnit.update(u.id, { is_active: u.is_active === false ? true : false });
      toast({ title: u.is_active === false ? "활성화되었습니다." : "비활성화되었습니다." });
      loadUnits();
    } catch (err) {
      toast({ title: "변경 실패", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`"${u.title}" Unit을 삭제하시겠습니까?`)) return;
    try {
      await base44.entities.AlgorithmUnit.delete(u.id);
      toast({ title: "삭제되었습니다." });
      loadUnits();
    } catch (err) {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast({ title: "오류", description: "제목을 입력해주세요.", variant: "destructive" }); return; }
    if (!form.unit_number) { toast({ title: "오류", description: "Unit 번호를 입력해주세요.", variant: "destructive" }); return; }
    const dupNum = units.find(u => u.unit_number === Number(form.unit_number) && u.id !== editingUnit?.id);
    if (dupNum) { toast({ title: "오류", description: "이미 사용 중인 Unit 번호입니다.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        unit_number: Number(form.unit_number),
        title: form.title,
        subtitle: form.subtitle || "",
        difficulty: form.difficulty || "기초",
        algorithm_tag: form.algorithm_tag || "기타",
        learning_objectives: form.learning_objectives || [],
        concept_sections: form.concept_sections || [],
        why_needed: form.why_needed || [],
        core_idea: form.core_idea || [],
        algorithm_flow: form.algorithm_flow || [],
        simulator: form.simulator || { enabled: false },
        example_codes: form.example_codes || [],
        questions: form.questions || [],
        code_blanks: form.code_blanks || [],
        implementations: form.implementations || [],
        judge_problems: form.judge_problems || [],
        missions: form.missions || [],
        summary: form.summary || [],
        is_active: form.is_active !== false,
      };
      if (editingUnit) {
        await base44.entities.AlgorithmUnit.update(editingUnit.id, payload);
        toast({ title: "수정되었습니다." });
      } else {
        await base44.entities.AlgorithmUnit.create(payload);
        toast({ title: "추가되었습니다." });
      }
      handleCloseForm();
      loadUnits();
    } catch (err) {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const applyAIGenerated = (data) => {
    setForm(prev => ({
      ...prev,
      title: data.title || prev.title,
      subtitle: data.subtitle || prev.subtitle,
      difficulty: data.difficulty || prev.difficulty,
      algorithm_tag: data.algorithm_tag || prev.algorithm_tag,
      learning_objectives: data.learning_objectives || [],
      concept_sections: data.concept_sections || [],
      why_needed: data.why_needed || [],
      core_idea: data.core_idea || [],
      algorithm_flow: data.algorithm_flow || [],
      simulator: { ...emptyForm.simulator, ...(data.simulator || {}) },
      example_codes: data.example_codes || [],
      questions: data.questions || [],
      code_blanks: data.code_blanks || [],
      implementations: data.implementations || [],
      judge_problems: data.judge_problems || [],
      missions: data.missions || [],
      summary: data.summary || [],
    }));
    setActiveTab("info");
  };

  const updateSimulator = (field, value) => {
    setForm(prev => ({ ...prev, simulator: { ...prev.simulator, [field]: value } }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-violet-600" />
          <h4 className="font-bold text-gray-900">알고리즘 학습 Unit 관리</h4>
          <Badge variant="outline" className="text-xs">{units.length}개</Badge>
        </div>
        <div className="flex gap-2">
          <AIAlgorithmUnitGenerator onApply={(data) => { if (!showForm) openAdd(); applyAIGenerated(data); }} />
          <Button onClick={openAdd} size="sm" className="bg-violet-600 hover:bg-violet-700">
            <Plus className="w-3.5 h-3.5 mr-1" />Unit 추가
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        💡 드래그(☰) 또는 ↑↓ 버튼으로 순서를 변경할 수 있습니다. 순서 변경 시 번호가 자동으로 재설정되며, 기존 학생 진행도는 유지됩니다.
      </p>

      {reordering && (
        <div className="text-center py-2 text-sm text-violet-600 bg-violet-50 rounded-lg mb-2 font-medium">
          Unit 순서 저장 중...
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="algorithm-units">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {loading && (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg">불러오는 중...</div>
              )}
              {!loading && units.map((u, index) => (
                <Draggable key={u.id} draggableId={u.id} index={index}>
                  {(prov) => (
                    <div ref={prov.innerRef} {...prov.draggableProps}
                      className={`flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 ${reordering ? "opacity-60 pointer-events-none" : ""}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div {...prov.dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none flex-shrink-0 px-1">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-sm font-bold text-violet-700 flex-shrink-0">{u.unit_number}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{u.title}</p>
                          {u.subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{u.subtitle}</p>}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">{DIFFICULTY_LABELS[u.difficulty] || u.difficulty}</Badge>
                            <Badge variant="outline" className="text-xs">{u.algorithm_tag || "기타"}</Badge>
                            {(u.simulator?.enabled) && <Badge className="text-xs bg-violet-100 text-violet-700 border-0"><Play className="w-2.5 h-2.5 mr-0.5" />시뮬</Badge>}
                            {(u.example_codes?.length || 0) > 0 && <Badge variant="outline" className="text-xs">코드 {u.example_codes.length}</Badge>}
                            {(u.questions?.length || 0) > 0 && <Badge variant="outline" className="text-xs">Q {u.questions.length}</Badge>}
                            {(u.missions?.length || 0) > 0 && <Badge variant="outline" className="text-xs">Mission {u.missions.length}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => moveUp(index)} disabled={index === 0 || reordering} className="h-7 w-7 p-0"><ChevronUp className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => moveDown(index)} disabled={index === units.length - 1 || reordering} className="h-7 w-7 p-0"><ChevronDown className="w-4 h-4" /></Button>
                        <button onClick={() => toggleActive(u)} className="flex items-center gap-1 text-xs" disabled={reordering}>
                          {u.is_active !== false ? <ToggleRight className="w-5 h-5 text-violet-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="h-7 w-7 p-0" disabled={reordering}><Edit className="w-3.5 h-3.5" /></Button>
                        <TeachingButton subjectType="algorithm_learning" unitId={u.id} disabled={reordering} />
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" disabled={reordering}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {!loading && units.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg">Unit이 없습니다. Unit을 추가해주세요.</div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleCloseForm(); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Algorithm Unit 수정" : "Algorithm Unit 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${activeTab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === "info" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Unit 번호</Label>
                    <Input type="number" value={form.unit_number} onChange={e => setForm({ ...form, unit_number: e.target.value })} className="text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">제목 (알고리즘 이름)</Label>
                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="예: 이진탐색" className="text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">부제목</Label>
                  <Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="부제목" className="text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">난이도</Label>
                    <Select value={form.difficulty} onValueChange={v => setForm({ ...form, difficulty: v })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">알고리즘 분류 태그</Label>
                    <Select value={form.algorithm_tag} onValueChange={v => setForm({ ...form, algorithm_tag: v })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TAG_LABELS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  사용 여부 (학생 화면에 표시)
                </label>
              </div>
            )}

            {activeTab === "objectives" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">학습 목표 (3~5개)</Label>
                <StringListEditor value={form.learning_objectives} onChange={v => setForm({ ...form, learning_objectives: v })} placeholder="학습 목표" />
              </div>
            )}

            {activeTab === "concept" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">1. 개념 설명</Label>
                <ConceptSectionsEditor value={form.concept_sections} onChange={v => setForm({ ...form, concept_sections: v })} />
              </div>
            )}

            {activeTab === "why" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">2. 왜 이 알고리즘이 필요한지</Label>
                <StringListEditor value={form.why_needed} onChange={v => setForm({ ...form, why_needed: v })} placeholder="왜 필요한지 설명" />
              </div>
            )}

            {activeTab === "core" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">3. 핵심 아이디어</Label>
                <StringListEditor value={form.core_idea} onChange={v => setForm({ ...form, core_idea: v })} placeholder="핵심 아이디어" />
              </div>
            )}

            {activeTab === "flow" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">4. 알고리즘 흐름 (단계별)</Label>
                <AlgorithmFlowEditor value={form.algorithm_flow} onChange={v => setForm({ ...form, algorithm_flow: v })} />
              </div>
            )}

            {activeTab === "simulator" && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">5. 알고리즘 시뮬레이터</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.simulator?.enabled || false} onChange={e => updateSimulator("enabled", e.target.checked)} />
                  시뮬레이터 사용
                </label>
                {form.simulator?.enabled && (
                  <div className="space-y-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div>
                      <Label className="text-xs">알고리즘 종류</Label>
                      <Select value={form.simulator.algorithm_type} onValueChange={v => updateSimulator("algorithm_type", v)}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ALGORITHM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {(form.simulator.algorithm_type !== "dfs" && form.simulator.algorithm_type !== "bfs") && (
                      <div>
                        <Label className="text-xs">배열 값 (쉼표로 구분)</Label>
                        <Input value={(form.simulator.array_data || []).join(",")} onChange={e => updateSimulator("array_data", e.target.value.split(",").map(n => Number(n.trim())).filter(n => !isNaN(n)))} placeholder="1,3,5,7,9" className="text-sm" />
                      </div>
                    )}
                    {["linear_search", "binary_search", "two_pointer", "greedy"].includes(form.simulator.algorithm_type) && (
                      <div>
                        <Label className="text-xs">찾을 값 / 목표값</Label>
                        <Input type="number" value={form.simulator.target || 0} onChange={e => updateSimulator("target", Number(e.target.value))} className="text-sm" />
                      </div>
                    )}
                    {form.simulator.algorithm_type === "binary_search" && (
                      <div>
                        <Label className="text-xs">시작 위치 (left)</Label>
                        <Input type="number" value={form.simulator.start_index ?? 0} onChange={e => updateSimulator("start_index", Number(e.target.value))} className="text-sm" />
                      </div>
                    )}
                    {["dfs", "bfs"].includes(form.simulator.algorithm_type) && (
                      <>
                        <div>
                          <Label className="text-xs">그래프 노드 (쉼표로 구분)</Label>
                          <Input value={(form.simulator.graph_nodes || []).join(",")} onChange={e => updateSimulator("graph_nodes", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="A,B,C,D" className="text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">간선 (예: A-B,B-C)</Label>
                          <Input value={(form.simulator.graph_edges || []).map(e => e.join("-")).join(",")} onChange={e => updateSimulator("graph_edges", e.target.value.split(",").map(s => s.trim().split("-")).filter(e => e.length === 2))} placeholder="A-B,B-C" className="text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">시작 노드</Label>
                          <Input value={form.simulator.start_node || ""} onChange={e => updateSimulator("start_node", e.target.value)} placeholder="A" className="text-sm" />
                        </div>
                      </>
                    )}
                    <div>
                      <Label className="text-xs">설명 문구</Label>
                      <Input value={form.simulator.description || ""} onChange={e => updateSimulator("description", e.target.value)} placeholder="시뮬레이터 설명" className="text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">자동 실행 속도 (ms)</Label>
                      <Input type="number" value={form.simulator.auto_speed || 1000} onChange={e => updateSimulator("auto_speed", Number(e.target.value))} className="text-sm" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "examples" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">6. 예제 코드 (코드 라인별 설명 포함)</Label>
                <ExampleCodesEditor value={form.example_codes} onChange={v => setForm({ ...form, example_codes: v })} />
              </div>
            )}

            {activeTab === "questions" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">7. Question</Label>
                <QuestionsEditor value={form.questions} onChange={v => setForm({ ...form, questions: v })} />
              </div>
            )}

            {activeTab === "blanks" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">8. 코드 빈칸 채우기</Label>
                <CodeBlanksEditor value={form.code_blanks} onChange={v => setForm({ ...form, code_blanks: v })} />
              </div>
            )}

            {activeTab === "impl" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">9. 직접 구현 문제</Label>
                <ImplementationsEditor value={form.implementations} onChange={v => setForm({ ...form, implementations: v })} />
              </div>
            )}

            {activeTab === "judge" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">11. 알고리즘 문제 풀이 (온라인 저지)</Label>
                <JudgeProblemsEditor value={form.judge_problems} onChange={v => setForm({ ...form, judge_problems: v })} />
              </div>
            )}

            {activeTab === "missions" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">10. Mission</Label>
                <MissionsEditor value={form.missions} onChange={v => setForm({ ...form, missions: v })} />
              </div>
            )}

            {activeTab === "summary" && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">핵심 요약 (3~5개)</Label>
                <StringListEditor value={form.summary} onChange={v => setForm({ ...form, summary: v })} placeholder="핵심 요약" />
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t">
              <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
                {saving ? "저장 중..." : editingUnit ? "수정" : "추가"}
              </Button>
              <Button onClick={handleCloseForm} variant="outline">취소</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}