import React, { useState, useEffect } from "react";
import { loadAllUnitsWithSource, loadUnitContent, saveUnit, deleteUnit, toggleUnitActive, deleteProgressByUnit, deleteSubmissionsByUnit } from "@/lib/dataAccess";
import TeachingButton from "@/components/teaching/TeachingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TripleEditor from "@/components/html/TripleEditor";
import {
  ConceptSectionsEditor,
  TablesEditor,
} from "./PythonUnitEditor";
import AIUnitAssistant from "./AIUnitAssistant";
import AIUnitGenerator from "./AIUnitGenerator";
import AIQuestionCleaner from "./AIQuestionCleaner";

const HTML_DEFAULT_CODE = `<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8">\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n</body>\n</html>`;

const emptyForm = (unitCount) => ({
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

export default function HTMLUnitManagement() {
  const [units, setUnits] = useState([]);
  const [dataSource, setDataSource] = useState("base44");
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(emptyForm(0));
  const [activeTab, setActiveTab] = useState("concept");
  const [saving, setSaving] = useState(false);
  const [openQuestionIdx, setOpenQuestionIdx] = useState(null);
  const [openMissionIdx, setOpenMissionIdx] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    const { units: data, source } = await loadAllUnitsWithSource("html");
    setDataSource(source);
    setUnits(data);
  };

  const openAdd = () => {
    setEditingUnit(null);
    setForm(emptyForm(units.length));
    setActiveTab("concept");
    setShowForm(true);
  };

  const openEdit = async (u) => {
    const fullUnit = await loadUnitContent(u.id);
    const data = fullUnit || u;
    // description_pages → concept_sections fallback 변환
    const conceptSections = (data.concept_sections && data.concept_sections.length > 0)
      ? data.concept_sections
      : (data.description_pages || []).map(block => ({
          title: block.title || block.content?.slice(0, 30) || "",
          lines: block.content ? [block.content] : [],
          code_example: block.type === "code" ? block.content : "",
        })).filter(s => s.title || s.lines.length > 0);

    setEditingUnit(data);
    setForm({
      unit_number: data.unit_number || 1,
      title: data.title || "",
      subtitle: data.subtitle || "",
      concept_sections: conceptSections,
      tables: data.tables || [],
      example_codes: data.example_codes || [],
      questions: (data.questions || []),
      missions: data.missions || [],
      is_active: data.is_active !== false,
    });
    setActiveTab("concept");
    setOpenQuestionIdx(null);
    setOpenMissionIdx(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) {
      toast({ title: "오류", description: "Unit 제목을 입력해주세요.", variant: "destructive" });
      return;
    }
    setSaving(true);
    // 번호 재정렬
    const reindexedQuestions = (form.questions || []).map((q, i) => ({ ...q, number: i + 1 }));
    const reindexedMissions = (form.missions || []).map((m, i) => ({ ...m, number: i + 1 }));
    const reindexedCodes = (form.example_codes || []).map((ex, i) => ({
      ...ex, number: i + 1, filename: ex.filename || `example${i + 1}.html`
    }));

    const saveData = {
      unit_number: Number(form.unit_number),
      title: form.title,
      subtitle: form.subtitle || "",
      is_active: form.is_active !== false,
      concept_sections: form.concept_sections || [],
      tables: form.tables || [],
      example_codes: reindexedCodes,
      questions: reindexedQuestions,
      missions: reindexedMissions,
    };

    if (editingUnit) {
      await saveUnit({ ...saveData, id: editingUnit.id, subject_type: "html" });
      toast({ title: "수정 완료", description: `Unit ${saveData.unit_number}. ${saveData.title}` });
    } else {
      await saveUnit({ ...saveData, subject_type: "html" });
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
    if (!confirm(`Unit ${unit.unit_number}. ${unit.title}을 삭제하시겠습니까?\n관련 진도 및 제출 기록도 함께 삭제됩니다.`)) return;
    await Promise.all([
      deleteUnit(unit.id),
      deleteProgressByUnit(unit.id),
      deleteSubmissionsByUnit(unit.id),
    ]);
    toast({ title: "삭제 완료 (관련 진도 및 제출 기록도 함께 삭제되었습니다)" });
    loadUnits();
  };

  const toggleActive = async (u) => {
    await toggleUnitActive(u.id, !u.is_active);
    loadUnits();
  };

  // ── AI Unit 생성 적용 (HTML 구조로 매핑) ──
  const handleApplyAIGeneratedUnit = (data, mode, mergeMode) => {
    setForm(prev => {
      // AI generic → HTML-specific 매핑
      const mapExamples = (examples) => (examples || []).map((ex, i) => ({
        filename: ex.filename || `example${i + 1}.html`,
        html: ex.code || "",
        css: "",
        javascript: "",
        description: ex.description || "",
        judge_mode: "structure",
      }));
      const mapMissions = (missions) => (missions || []).map((m, i) => ({
        number: i + 1,
        title: m.title || "",
        description: m.description || "",
        default_html: m.default_code || HTML_DEFAULT_CODE,
        default_css: "",
        default_javascript: "",
        preview_image: "",
        conditions: [],
      }));
      const mapQuestions = (questions) => (questions || []).map((q, i) => ({
        number: i + 1,
        type: q.type || "multiple",
        question: q.question || "",
        options: q.options || [],
        answer: q.answer || "",
        explanation: q.explanation || "",
      }));

      const mergeArr = (prevArr, newArr) => mergeMode === "merge" ? [...(prevArr || []), ...newArr] : newArr;

      if (mode === "all") {
        return {
          ...prev,
          title: data.title || prev.title,
          subtitle: data.subtitle || prev.subtitle,
          concept_sections: mergeArr(prev.concept_sections, data.concept_sections || []),
          tables: mergeArr(prev.tables, data.tables || []),
          example_codes: mergeArr(prev.example_codes, mapExamples(data.example_codes)),
          questions: mergeArr(prev.questions, mapQuestions(data.questions)),
          missions: mergeArr(prev.missions, mapMissions(data.missions)),
        };
      }
      // 부분 적용
      const updates = {};
      if (mode === "concepts") updates.concept_sections = mergeArr(prev.concept_sections, data.concept_sections || []);
      if (mode === "tables") updates.tables = mergeArr(prev.tables, data.tables || []);
      if (mode === "examples") updates.example_codes = mergeArr(prev.example_codes, mapExamples(data.example_codes));
      if (mode === "questions") updates.questions = mergeArr(prev.questions, mapQuestions(data.questions));
      if (mode === "missions") updates.missions = mergeArr(prev.missions, mapMissions(data.missions));
      if (data.title && mode === "all") updates.title = data.title;
      if (data.subtitle && mode === "all") updates.subtitle = data.subtitle;
      return { ...prev, ...updates };
    });
  };

  // ── Example handlers ──
  const addExample = () => {
    const ex = [...(form.example_codes || [])];
    ex.push({ filename: `example${ex.length + 1}.html`, html: HTML_DEFAULT_CODE, css: "", javascript: "", description: "", judge_mode: "structure" });
    setForm({ ...form, example_codes: ex });
  };
  const updateExample = (i, field, val) => {
    const arr = [...form.example_codes]; arr[i] = { ...arr[i], [field]: val };
    setForm({ ...form, example_codes: arr });
  };
  const removeExample = (i) => setForm({ ...form, example_codes: form.example_codes.filter((_, idx) => idx !== i) });
  const moveExample = (from, to) => {
    const arr = [...form.example_codes];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setForm({ ...form, example_codes: arr });
  };

  // ── Question handlers ──
  const addQuestion = () => {
    const qs = [...(form.questions || [])];
    qs.push({ number: qs.length + 1, type: "multiple", question: "", options: ["", "", "", ""], answer: "", explanation: "" });
    setForm({ ...form, questions: qs });
    setOpenQuestionIdx(qs.length - 1);
  };
  const updateQuestion = (i, field, val) => {
    const arr = [...form.questions]; arr[i] = { ...arr[i], [field]: val };
    setForm({ ...form, questions: arr });
  };
  const removeQuestion = (i) => {
    setForm({ ...form, questions: form.questions.filter((_, idx) => idx !== i) });
    if (openQuestionIdx === i) setOpenQuestionIdx(null);
  };
  const moveQuestion = (from, to) => {
    const arr = [...form.questions];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setForm({ ...form, questions: arr.map((q, idx) => ({ ...q, number: idx + 1 })) });
  };

  // ── Mission handlers ──
  const addMission = () => {
    const ms = [...(form.missions || [])];
    ms.push({
      number: ms.length + 1, title: "", description: "",
      default_html: HTML_DEFAULT_CODE, default_css: "", default_javascript: "",
      preview_image: "", conditions: [],
    });
    setForm({ ...form, missions: ms });
    setOpenMissionIdx(ms.length - 1);
  };
  const updateMission = (mi, field, val) => {
    const arr = [...form.missions]; arr[mi] = { ...arr[mi], [field]: val };
    setForm({ ...form, missions: arr });
  };
  const removeMission = (mi) => {
    setForm({ ...form, missions: form.missions.filter((_, idx) => idx !== mi) });
    if (openMissionIdx === mi) setOpenMissionIdx(null);
  };
  const moveMission = (from, to) => {
    const arr = [...form.missions];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setForm({ ...form, missions: arr.map((m, idx) => ({ ...m, number: idx + 1 })) });
  };
  const addCondition = (mi, type = "html") => {
    const arr = [...form.missions];
    arr[mi] = { ...arr[mi], conditions: [...(arr[mi].conditions || []), { label: "", type, tag: "", property: "", keyword: "", min_count: 1 }] };
    setForm({ ...form, missions: arr });
  };
  const updateCondition = (mi, ci, field, val) => {
    const arr = [...form.missions];
    const conds = [...(arr[mi].conditions || [])];
    conds[ci] = { ...conds[ci], [field]: val };
    arr[mi] = { ...arr[mi], conditions: conds };
    setForm({ ...form, missions: arr });
  };
  const removeCondition = (mi, ci) => {
    const arr = [...form.missions];
    arr[mi] = { ...arr[mi], conditions: arr[mi].conditions.filter((_, i) => i !== ci) };
    setForm({ ...form, missions: arr });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-500" />
          <h4 className="font-bold text-gray-900">HTML Unit 관리</h4>
          <Badge variant="outline" className="text-xs">{units.length}개</Badge>
        </div>
        <Button onClick={openAdd} size="sm" className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-3.5 h-3.5 mr-1" />Unit 추가
        </Button>
      </div>

      

      <div className="space-y-2">
        {units.map(u => (
          <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm font-bold text-orange-700 flex-shrink-0">
                {u.unit_number}
              </span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{u.title}</p>
                {u.subtitle && <p className="text-xs text-gray-400 mt-0.5">{u.subtitle}</p>}
                <div className="flex gap-1 mt-1 flex-wrap">
                  {u.concept_sections_count > 0 && (
                    <Badge variant="outline" className="text-xs">개념 {u.concept_sections_count}</Badge>
                  )}
                  {u.tables_count > 0 && <Badge variant="outline" className="text-xs">표 {u.tables_count}</Badge>}
                  {u.example_codes_count > 0 && <Badge variant="outline" className="text-xs">예제 {u.example_codes_count}</Badge>}
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
              <TeachingButton subjectType="html" unitId={u.id} />
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
            <DialogTitle>{editingUnit ? "HTML Unit 수정" : "HTML Unit 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* 기본 정보 */}
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
            <AIUnitGenerator subject="html" subjectName="HTML/CSS/JS" previousUnits={units} currentForm={form} onApply={handleApplyAIGeneratedUnit} />

            {/* AI 개별 섹션 생성 */}
            <AIUnitAssistant
              subject="html"
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

            {/* 탭 */}
            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.key ? "border-orange-500 text-orange-700" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[300px]">
              {/* 개념 설명 */}
              {activeTab === "concept" && (
                <ConceptSectionsEditor
                  sections={form.concept_sections}
                  onChange={val => setForm(f => ({ ...f, concept_sections: val }))}
                />
              )}

              {/* 표 */}
              {activeTab === "tables" && (
                <TablesEditor
                  tables={form.tables}
                  onChange={val => setForm(f => ({ ...f, tables: val }))}
                />
              )}

              {/* 예제 코드 */}
              {activeTab === "codes" && (
                <div className="space-y-3">
                  <Button size="sm" variant="outline" onClick={addExample} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />예제 추가
                  </Button>
                  {(form.example_codes || []).map((ex, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <button type="button" disabled={i === 0} onClick={() => moveExample(i, i - 1)} className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 disabled:cursor-not-allowed text-[10px] font-bold">▲</button>
                          <button type="button" disabled={i === (form.example_codes.length - 1)} onClick={() => moveExample(i, i + 1)} className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 disabled:cursor-not-allowed text-[10px] font-bold">▼</button>
                        </div>
                        <span className="text-xs font-semibold text-gray-500">Example {i + 1}</span>
                        <button onClick={() => removeExample(i)} className="text-red-400 text-xs hover:text-red-600 ml-auto">삭제</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="파일명 (예: example1.html)" value={ex.filename || ""} onChange={e => updateExample(i, "filename", e.target.value)} className="h-8 text-sm" />
                        <select value={ex.judge_mode || "structure"} onChange={e => updateExample(i, "judge_mode", e.target.value)} className="border border-gray-200 rounded-md px-3 py-1.5 text-sm">
                          <option value="exact">완전 일치</option>
                          <option value="whitespace">공백 무시</option>
                          <option value="structure">태그 구조 비교</option>
                        </select>
                      </div>
                      <Input placeholder="설명 (선택)" value={ex.description || ""} onChange={e => updateExample(i, "description", e.target.value)} className="h-8 text-sm" />
                      <TripleEditor
                        htmlValue={ex.html || ""} onHtmlChange={v => updateExample(i, "html", v)}
                        cssValue={ex.css || ""} onCssChange={v => updateExample(i, "css", v)}
                        jsValue={ex.javascript || ""} onJsChange={v => updateExample(i, "javascript", v)}
                        height="200px"
                      />
                    </div>
                  ))}
                  {(form.example_codes || []).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">예제 코드가 없습니다.</p>
                  )}
                </div>
              )}

              {/* Question */}
              {activeTab === "questions" && (
                <div className="space-y-2">
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={addQuestion} className="h-7 text-xs">
                      <Plus className="w-3 h-3 mr-1" />문제 추가
                    </Button>
                    <AIQuestionCleaner
                      subject="html"
                      questions={form.questions || []}
                      onChange={val => setForm(f => ({ ...f, questions: val }))}
                    />
                  </div>
                  {(form.questions || []).map((q, i) => {
                    const isOpen = openQuestionIdx === i;
                    return (
                      <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                          className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${isOpen ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100"}`}
                          onClick={() => setOpenQuestionIdx(isOpen ? null : i)}>
                          <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button type="button" disabled={i === 0} onClick={() => moveQuestion(i, i - 1)} className="h-4 w-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 text-[9px] font-bold">▲</button>
                            <button type="button" disabled={i === (form.questions.length - 1)} onClick={() => moveQuestion(i, i + 1)} className="h-4 w-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 text-[9px] font-bold">▼</button>
                          </div>
                          <span className={`text-xs font-bold flex-shrink-0 ${isOpen ? "text-blue-600" : "text-gray-500"}`}>Q{i + 1}.</span>
                          <span className="text-xs text-gray-700 truncate flex-1">{q.question?.slice(0, 50) || "(문제 없음)"}</span>
                          <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button onClick={() => removeQuestion(i)} className="text-red-400 text-xs hover:text-red-600 px-1">삭제</button>
                          </div>
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                        </div>
                        {isOpen && (
                          <div className="p-3 space-y-2 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-2">
                              <select value={q.type || "multiple"} onChange={e => updateQuestion(i, "type", e.target.value)} className="border border-gray-200 rounded-md px-3 py-2 text-sm">
                                <option value="multiple">객관식</option>
                                <option value="ox">OX</option>
                                <option value="fill">빈칸 채우기</option>
                                <option value="predict">결과 예측</option>
                              </select>
                              <Input placeholder="정답" value={q.answer || ""} onChange={e => updateQuestion(i, "answer", e.target.value)} className="h-9 text-sm" />
                            </div>
                            <textarea placeholder="문제" value={q.question || ""} onChange={e => updateQuestion(i, "question", e.target.value)} className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none h-16" />
                            {(q.type === "multiple" || !q.type) && (
                              <div className="grid grid-cols-2 gap-1">
                                {[0, 1, 2, 3].map(oi => (
                                  <Input key={oi} placeholder={`보기 ${oi + 1}`} value={(q.options || [])[oi] || ""} onChange={e => {
                                    const opts = [...(q.options || ["", "", "", ""])]; opts[oi] = e.target.value; updateQuestion(i, "options", opts);
                                  }} className="h-8 text-sm" />
                                ))}
                              </div>
                            )}
                            <Input placeholder="해설 (선택)" value={q.explanation || ""} onChange={e => updateQuestion(i, "explanation", e.target.value)} className="h-8 text-sm" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(form.questions || []).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">문제가 없습니다.</p>
                  )}
                </div>
              )}

              {/* Mission */}
              {activeTab === "missions" && (
                <div className="space-y-3">
                  <Button size="sm" variant="outline" onClick={addMission} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />미션 추가
                  </Button>
                  {(form.missions || []).map((m, mi) => {
                    const isOpen = openMissionIdx === mi;
                    return (
                      <div key={mi} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                          className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${isOpen ? "bg-orange-100" : "bg-orange-50 hover:bg-orange-100"}`}
                         onClick={() => setOpenMissionIdx(isOpen ? null : mi)}>
                         <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                           <button type="button" disabled={mi === 0} onClick={() => moveMission(mi, mi - 1)} className="h-4 w-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 text-[9px] font-bold">▲</button>
                           <button type="button" disabled={mi === (form.missions.length - 1)} onClick={() => moveMission(mi, mi + 1)} className="h-4 w-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 text-[9px] font-bold">▼</button>
                         </div>
                         <span className={`text-xs font-bold flex-shrink-0 ${isOpen ? "text-orange-700" : "text-orange-500"}`}>Mission {mi + 1}.</span>
                         <span className="text-xs text-gray-700 truncate flex-1">{m.title?.slice(0, 50) || "(제목 없음)"}</span>
                         <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                           <button onClick={() => removeMission(mi)} className="text-red-400 text-xs hover:text-red-600 px-1">삭제</button>
                         </div>
                         {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                        </div>
                        {isOpen && (
                          <div className="p-4 space-y-3 border-t border-gray-100">
                            <Input placeholder="Mission 제목" value={m.title || ""} onChange={e => updateMission(mi, "title", e.target.value)} />
                            <textarea placeholder="Mission 설명 및 안내" value={m.description || ""} onChange={e => updateMission(mi, "description", e.target.value)} className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none h-20" />
                            <Input placeholder="예시 이미지 URL (선택)" value={m.preview_image || ""} onChange={e => updateMission(mi, "preview_image", e.target.value)} />
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 block">기본 제공 코드 (HTML / CSS / JavaScript)</Label>
                              <TripleEditor
                                htmlValue={m.default_html || ""} onHtmlChange={v => updateMission(mi, "default_html", v)}
                                cssValue={m.default_css || ""} onCssChange={v => updateMission(mi, "default_css", v)}
                                jsValue={m.default_javascript || ""} onJsChange={v => updateMission(mi, "default_javascript", v)}
                                height="200px"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-500">조건 체크</span>
                                <div className="flex gap-1">
                                  {[["html", "HTML", "bg-orange-100 text-orange-700"], ["css", "CSS", "bg-blue-100 text-blue-700"], ["js", "JS", "bg-yellow-100 text-yellow-700"]].map(([t, l, cls]) => (
                                    <button key={t} onClick={() => addCondition(mi, t)} className={`text-xs px-2 py-0.5 rounded-full ${cls} font-medium`}>+ {l}</button>
                                  ))}
                                </div>
                              </div>
                              {(m.conditions || []).map((c, ci) => (
                                <div key={ci} className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.type === "css" ? "text-blue-600" : c.type === "js" ? "text-yellow-600" : "text-orange-600"}`}>
                                    {(c.type || "html").toUpperCase()}
                                  </span>
                                  <Input placeholder="조건 설명" value={c.label || ""} onChange={e => updateCondition(mi, ci, "label", e.target.value)} className="flex-1 h-7 text-xs min-w-28" />
                                  {(c.type === "html" || !c.type) && (
                                    <Input placeholder="태그 (예: h1)" value={c.tag || ""} onChange={e => updateCondition(mi, ci, "tag", e.target.value)} className="w-20 h-7 text-xs" />
                                  )}
                                  {c.type === "css" && (
                                    <Input placeholder="속성 (예: color)" value={c.property || ""} onChange={e => updateCondition(mi, ci, "property", e.target.value)} className="w-28 h-7 text-xs" />
                                  )}
                                  {c.type === "js" && (
                                    <Input placeholder="키워드 (예: function)" value={c.keyword || ""} onChange={e => updateCondition(mi, ci, "keyword", e.target.value)} className="w-28 h-7 text-xs" />
                                  )}
                                  <Input type="number" placeholder="최소" value={c.min_count || 1} onChange={e => updateCondition(mi, ci, "min_count", Number(e.target.value))} className="w-14 h-7 text-xs" />
                                  <button onClick={() => removeCondition(mi, ci)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(form.missions || []).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">미션이 없습니다.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="html_unit_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="html_unit_active">사용 여부 (학생 화면에 표시)</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCloseForm} disabled={saving} className="flex-1">취소</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600">
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}