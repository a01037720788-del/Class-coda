import React, { useState, useEffect } from "react";
import { loadAllUnitsWithSource, loadUnitContent, saveUnit, deleteUnit, toggleUnitActive, deleteProgressByUnit, deleteSubmissionsByUnit } from "@/lib/dataAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, BookOpen, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import AIUnitAssistant from "@/components/admin/AIUnitAssistant";
import AIUnitGenerator from "@/components/admin/AIUnitGenerator";
import TestCasesEditor from "@/components/admin/TestCasesEditor";
import TeachingButton from "@/components/teaching/TeachingButton";
import RandomTestGenerator from "@/components/admin/RandomTestGenerator";
import StdinSection from "@/components/admin/StdinSection";
import { LearningObjectivesEditor, SummaryEditor } from "./PythonUnitEditor";

const emptyUnit = () => ({
  unit_number: 1,
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

export default function JuniorPythonUnitManagement() {
  const [units, setUnits] = useState([]);
  const [dataSource, setDataSource] = useState("github-json+google-sheets-overrides");
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(emptyUnit());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    const { units: data, source } = await loadAllUnitsWithSource("junior_python");
    setUnits(data);
    setDataSource(source);
  };

  const openAdd = () => {
    setEditingUnit(null);
    setForm({ ...emptyUnit(), unit_number: (units.length > 0 ? Math.max(...units.map(u => u.unit_number)) + 1 : 1) });
    setShowForm(true);
  };

  const openEdit = async (u) => {
    const fullUnit = await loadUnitContent(u.id);
    const data = fullUnit || u;
    setEditingUnit(data);
    setForm({ ...data });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast({ title: "오류", description: "Unit 제목을 입력해주세요.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const unit = { ...form, subject_type: "junior_python", id: editingUnit?.id || `junior_python-unit-${form.unit_number}-${Date.now()}` };
      await saveUnit("junior_python", unit);
      toast({ title: editingUnit ? "수정 완료" : "등록 완료" });
      setShowForm(false);
      await loadUnits();
    } catch (err) {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (unit) => {
    if (!confirm(`"${unit.title}" Unit을 학생 화면에서 숨기시겠습니까? 학습 기록은 삭제되지 않습니다.`)) return;
    try {
      await saveUnit("junior_python", { ...unit, is_active: false });
      toast({ title: "단원 숨김 완료", description: "기존 학생 학습 기록은 유지됩니다." });
      await loadUnits();
    } catch (err) { toast({ title: "숨김 실패", description: err.message, variant: "destructive" }); }
  };

  const handleToggleActive = async (unit) => {
    try {
      await saveUnit("junior_python", { ...unit, is_active: !(unit.is_active !== false) });
      await loadUnits();
    } catch (err) { toast({ title: "변경 실패", description: err.message, variant: "destructive" }); }
  };

  const handleAIApply = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
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
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">🐍 저학년 Python Unit 관리</h3>
          <p className="text-xs text-gray-500 mt-0.5">초등 저학년을 위한 Python 학습 단원을 관리합니다.</p>
        </div>
        <Button onClick={openAdd} className="bg-lime-600 hover:bg-lime-700 gap-1 text-sm">
          <Plus className="w-4 h-4" />Unit 추가
        </Button>
      </div>

      

      <div className="space-y-2">
        {units.map(u => (
          <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${u.is_active ? "bg-lime-100 text-lime-700" : "bg-gray-100 text-gray-400"}`}>
                  {u.unit_number}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{u.title}</p>
                  {u.subtitle && <p className="text-xs text-gray-400">{u.subtitle}</p>}
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400">개념 {u.concept_sections_count || 0}</span>
                    <span className="text-[10px] text-gray-400">예제 {u.example_codes_count || 0}</span>
                    <span className="text-[10px] text-gray-400">Q {u.questions_count || 0}</span>
                    <span className="text-[10px] text-gray-400">M {u.missions_count || 0}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  onClick={() => handleToggleActive(u)}
                  className={`cursor-pointer text-[10px] ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {u.is_active ? "사용" : "미사용"}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="h-7 px-2 text-xs">
                  <Edit className="w-3 h-3 mr-1" />수정
                </Button>
                <TeachingButton subjectType="junior_python" unitId={u.id} />
                <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} className="h-7 px-2 text-xs text-red-500 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {units.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <BookOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">등록된 Unit이 없습니다.</p>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🐍 {editingUnit ? `Unit ${form.unit_number} 수정` : "저학년 Python Unit 추가"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic">
            <TabsList className="w-full grid grid-cols-8 mb-4">
              <TabsTrigger value="basic">기본</TabsTrigger>
              <TabsTrigger value="objectives">학습목표</TabsTrigger>
              <TabsTrigger value="concept">개념</TabsTrigger>
              <TabsTrigger value="tables">표</TabsTrigger>
              <TabsTrigger value="codes">예제</TabsTrigger>
              <TabsTrigger value="questions">Question</TabsTrigger>
              <TabsTrigger value="missions">Mission</TabsTrigger>
              <TabsTrigger value="summary">요약</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <AIUnitGenerator subject="junior_python" subjectName="저학년 Python" previousUnits={units} currentForm={form} onApply={handleApplyAIGeneratedUnit} />
              <AIUnitAssistant
                subjectType="junior_python"
                unitTitle={form.title}
                unitNumber={form.unit_number}
                onApply={handleAIApply}
                extraInstructions="초등 저학년(1~3학년) 수준에 맞게 최대한 쉽고 재미있게 설명해주세요. 어려운 용어는 피하고 일상생활 예시를 많이 활용하세요."
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Unit 번호 *</Label>
                  <Input type="number" value={form.unit_number} onChange={e => setForm({ ...form, unit_number: parseInt(e.target.value) })} className="mt-1" />
                </div>
                <div>
                  <Label>is_active</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                    <span className="text-sm">사용 중</span>
                  </div>
                </div>
              </div>
              <div>
                <Label>제목 *</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="예: Python 소개 - 코딩이란?" className="mt-1" />
              </div>
              <div>
                <Label>부제목</Label>
                <Input value={form.subtitle || ""} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Unit 부제목" className="mt-1" />
              </div>
            </TabsContent>

            <TabsContent value="objectives">
              <LearningObjectivesEditor items={form.learning_objectives || []} onChange={v => setForm({ ...form, learning_objectives: v })} />
            </TabsContent>

            <TabsContent value="concept">
              <ConceptEditor sections={form.concept_sections || []} onChange={v => setForm({ ...form, concept_sections: v })} />
            </TabsContent>

            <TabsContent value="tables">
              <TablesEditor tables={form.tables || []} onChange={v => setForm({ ...form, tables: v })} />
            </TabsContent>

            <TabsContent value="codes">
              <CodesEditor codes={form.example_codes || []} onChange={v => setForm({ ...form, example_codes: v })} />
            </TabsContent>

            <TabsContent value="questions">
              <QuestionsEditor questions={form.questions || []} onChange={v => setForm({ ...form, questions: v })} />
            </TabsContent>

            <TabsContent value="missions">
              <MissionsEditor missions={form.missions || []} onChange={v => setForm({ ...form, missions: v })} />
            </TabsContent>

            <TabsContent value="summary">
              <SummaryEditor items={form.summary || []} onChange={v => setForm({ ...form, summary: v })} />
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">취소</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-lime-600 hover:bg-lime-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── 개념 섹션 에디터 ──
function ConceptEditor({ sections, onChange }) {
  const add = () => onChange([...sections, { title: "", lines: [], code_example: "" }]);
  const remove = (i) => onChange(sections.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...sections];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-gray-700">개념 설명 섹션 ({sections.length}개)</p>
        <Button size="sm" onClick={add} className="h-7 text-xs bg-lime-600 hover:bg-lime-700"><Plus className="w-3 h-3 mr-1" />추가</Button>
      </div>
      {sections.map((sec, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500">섹션 {i + 1}</span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} className="h-6 w-6 p-0 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Input placeholder="섹션 제목" value={sec.title || ""} onChange={e => update(i, "title", e.target.value)} className="text-sm" />
          <Textarea
            placeholder="설명 줄 (한 줄씩 입력, 엔터로 구분)"
            value={(sec.lines || []).join("\n")}
            onChange={e => update(i, "lines", e.target.value.split("\n"))}
            className="text-sm h-24"
          />
          <Textarea
            placeholder="코드 예시 (선택)"
            value={sec.code_example || ""}
            onChange={e => update(i, "code_example", e.target.value)}
            className="text-sm h-20 font-mono"
          />
        </div>
      ))}
    </div>
  );
}

// ── 표 에디터 ──
function TablesEditor({ tables, onChange }) {
  const add = () => onChange([...tables, { title: "", headers: [""], rows: [[""]]}]);
  const remove = (i) => onChange(tables.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...tables];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-gray-700">표 ({tables.length}개)</p>
        <Button size="sm" onClick={add} className="h-7 text-xs bg-lime-600 hover:bg-lime-700"><Plus className="w-3 h-3 mr-1" />추가</Button>
      </div>
      {tables.map((tbl, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500">표 {i + 1}</span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Input placeholder="표 제목" value={tbl.title || ""} onChange={e => update(i, "title", e.target.value)} className="text-sm" />
          <Label className="text-xs">헤더 (쉼표 구분)</Label>
          <Input value={(tbl.headers || []).join(",")} onChange={e => update(i, "headers", e.target.value.split(","))} className="text-sm" />
          <Label className="text-xs">행 (행은 줄바꿈, 셀은 쉼표 구분)</Label>
          <Textarea
            value={(tbl.rows || []).map(r => r.join(",")).join("\n")}
            onChange={e => update(i, "rows", e.target.value.split("\n").map(r => r.split(",")))}
            className="text-sm h-24"
          />
        </div>
      ))}
    </div>
  );
}

// ── 예제 코드 에디터 ──
function CodesEditor({ codes, onChange }) {
  const add = () => onChange([...codes, { filename: "", code: 'print("Hello Python")', description: "", expected_output: "" }]);
  const remove = (i) => onChange(codes.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...codes];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-gray-700">예제 코드 ({codes.length}개)</p>
        <Button size="sm" onClick={add} className="h-7 text-xs bg-lime-600 hover:bg-lime-700"><Plus className="w-3 h-3 mr-1" />추가</Button>
      </div>
      {codes.map((c, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500">예제 {i + 1}</span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="파일명 (예: unit01-01.py)" value={c.filename || ""} onChange={e => update(i, "filename", e.target.value)} className="text-sm" />
            <Input placeholder="설명" value={c.description || ""} onChange={e => update(i, "description", e.target.value)} className="text-sm" />
          </div>
          <Textarea placeholder="코드" value={c.code || ""} onChange={e => update(i, "code", e.target.value)} className="text-sm h-28 font-mono" />
          <Input placeholder="예상 출력 (선택)" value={c.expected_output || ""} onChange={e => update(i, "expected_output", e.target.value)} className="text-sm" />
          <StdinSection
            code={c.code || ""}
            defaultStdin={c.default_stdin || ""}
            stdinDescription={c.stdin_description || ""}
            usesInput={c.uses_input === true}
            onUpdate={(field, val) => update(i, field, val)}
          />
        </div>
      ))}
    </div>
  );
}

// ── Question 에디터 ──
function QuestionsEditor({ questions, onChange }) {
  const add = () => onChange([...questions, { number: questions.length + 1, type: "multiple_choice", question: "", options: ["", "", "", ""], answer: "", explanation: "" }]);
  const remove = (i) => onChange(questions.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...questions];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-gray-700">Question ({questions.length}개)</p>
        <Button size="sm" onClick={add} className="h-7 text-xs bg-lime-600 hover:bg-lime-700"><Plus className="w-3 h-3 mr-1" />추가</Button>
      </div>
      {questions.map((q, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500">Q{q.number || i + 1}</span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">유형</Label>
              <select value={q.type} onChange={e => update(i, "type", e.target.value)} className="mt-1 w-full h-8 rounded-md border border-input bg-white px-2 text-xs">
                <option value="multiple_choice">객관식</option>
                <option value="short_answer">주관식</option>
                <option value="code_output">코드 출력 예측</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">번호</Label>
              <Input type="number" value={q.number || i + 1} onChange={e => update(i, "number", parseInt(e.target.value))} className="mt-1 h-8 text-xs" />
            </div>
          </div>
          <Textarea placeholder="문제" value={q.question || ""} onChange={e => update(i, "question", e.target.value)} className="text-sm h-16" />
          {q.type === "multiple_choice" && (
            <div className="space-y-1">
              <Label className="text-xs">보기 (4개)</Label>
              {(q.options || ["", "", "", ""]).map((opt, j) => (
                <Input key={j} placeholder={`보기 ${j + 1}`} value={opt} onChange={e => {
                  const opts = [...(q.options || ["", "", "", ""])];
                  opts[j] = e.target.value;
                  update(i, "options", opts);
                }} className="text-sm" />
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">정답</Label>
              <Input placeholder="정답" value={q.answer || ""} onChange={e => update(i, "answer", e.target.value)} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">해설</Label>
              <Input placeholder="해설 (선택)" value={q.explanation || ""} onChange={e => update(i, "explanation", e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mission 에디터 ──
function MissionsEditor({ missions, onChange }) {
  const add = () => onChange([...missions, { number: missions.length + 1, title: "", description: "", default_code: 'print("Hello Python")', expected_output: "" }]);
  const remove = (i) => onChange(missions.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...missions];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-semibold text-gray-700">Mission ({missions.length}개)</p>
        <Button size="sm" onClick={add} className="h-7 text-xs bg-lime-600 hover:bg-lime-700"><Plus className="w-3 h-3 mr-1" />추가</Button>
      </div>
      {missions.map((m, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500">Mission {m.number || i + 1}</span>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="미션 번호" type="number" value={m.number || i + 1} onChange={e => update(i, "number", parseInt(e.target.value))} className="text-sm" />
            <Input placeholder="미션 제목" value={m.title || ""} onChange={e => update(i, "title", e.target.value)} className="text-sm" />
          </div>
          <Textarea placeholder="미션 설명 (초등 저학년 수준으로 쉽게)" value={m.description || ""} onChange={e => update(i, "description", e.target.value)} className="text-sm h-20" />
          <Textarea placeholder="기본 코드" value={m.default_code || ""} onChange={e => update(i, "default_code", e.target.value)} className="text-sm h-24 font-mono" />
          <Input placeholder="예상 출력" value={m.expected_output || ""} onChange={e => update(i, "expected_output", e.target.value)} className="text-sm" />
          <Input placeholder="힌트/조건 (선택)" value={m.input_condition || ""} onChange={e => update(i, "input_condition", e.target.value)} className="text-sm" />
          <StdinSection
            code={m.default_code || ""}
            defaultStdin={m.default_stdin || ""}
            stdinDescription={m.stdin_description || ""}
            usesInput={m.uses_input === true}
            gradingMode={m.grading_mode || "normalize"}
            showGradingMode
            onUpdate={(field, val) => update(i, field, val)}
          />
          <RandomTestGenerator mission={m} onChange={updated => { const arr = [...missions]; arr[i] = updated; onChange(arr); }} />
          <TestCasesEditor cases={m.test_cases || []} onChange={cases => update(i, "test_cases", cases)} />
        </div>
      ))}
    </div>
  );
}