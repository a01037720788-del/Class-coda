import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Code2, ToggleLeft, ToggleRight, Settings } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import CodeEditor from "@/components/admin/CodeEditor";
import ConstraintsEditor from "@/components/admin/ConstraintsEditor";
import TestCasesEditor from "@/components/admin/TestCasesEditor";

const DIFFICULTIES = ["Bronze", "Silver", "Gold", "Platinum"];

const difficultyColors = {
  Bronze: "bg-amber-100 text-amber-700",
  Silver: "bg-gray-100 text-gray-600",
  Gold: "bg-yellow-100 text-yellow-700",
  Platinum: "bg-teal-100 text-teal-700",
};

const emptyForm = {
  problem_number: "", title: "", difficulty: "", algorithm_type: "",
  description: "", input_description: "", output_description: "",
  sample_input: "", sample_output: "", constraints: [],
  answer_code: "", answer_language: "python", test_cases: [],
  is_active: true, subject_name: "알고리즘"
};

export default function ProblemManagement({ subject }) {
  const [problems, setProblems] = useState([]);
  const [algoTypes, setAlgoTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingType, setEditingType] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    const [probs, types] = await Promise.all([
      base44.entities.Problem.filter({ subject_name: "알고리즘" }, "problem_number"),
      base44.entities.AlgorithmType.list("order"),
    ]);
    setProblems(probs);
    setAlgoTypes(types.filter(t => t.is_active !== false));
  }, []);

  useEffect(() => { loadData(); }, [subject, loadData]);

  const openAdd = useCallback(() => {
    setEditingProblem(null);
    setForm({ ...emptyForm, subject_id: subject.id, subject_name: "알고리즘" });
    setShowForm(true);
  }, [subject]);

  const openEdit = useCallback((p) => {
    setEditingProblem(p);
    let constraints = p.constraints;
    if (typeof constraints === "string") {
      try { constraints = JSON.parse(constraints); } catch { constraints = constraints ? [constraints] : []; }
    }
    let test_cases = p.test_cases;
    if (typeof test_cases === "string" && test_cases.trim()) {
      try { test_cases = JSON.parse(test_cases); } catch { test_cases = []; }
    }
    setForm({
      problem_number: p.problem_number || "",
      title: p.title || "", difficulty: p.difficulty || "",
      algorithm_type: p.algorithm_type || "", description: p.description || "",
      input_description: p.input_description || "", output_description: p.output_description || "",
      sample_input: p.sample_input || "", sample_output: p.sample_output || "",
      constraints: Array.isArray(constraints) ? constraints : [],
      answer_code: p.answer_code || "", answer_language: p.answer_language || "python",
      test_cases: Array.isArray(test_cases) ? test_cases : [],
      is_active: p.is_active !== false,
      subject_id: p.subject_id || subject.id, subject_name: "알고리즘",
    });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.title?.trim()) { toast({ title: "오류", description: "문제 제목을 입력해주세요.", variant: "destructive" }); return; }
    if (!form.problem_number) { toast({ title: "오류", description: "문제 번호를 입력해주세요.", variant: "destructive" }); return; }
    if (!editingProblem) {
      const dup = problems.find(p => p.problem_number === Number(form.problem_number));
      if (dup) { toast({ title: "중복 번호", description: `문제 번호 ${form.problem_number}이(가) 이미 존재합니다.`, variant: "destructive" }); return; }
    }
    setSaving(true);
    const saveData = {
      ...form,
      problem_number: Number(form.problem_number),
      subject_id: subject?.id || "",
      subject_name: "알고리즘",
      test_cases: JSON.stringify(Array.isArray(form.test_cases) ? form.test_cases : []),
    };
    if (editingProblem) {
      await base44.entities.Problem.update(editingProblem.id, saveData);
      toast({ title: "저장되었습니다", description: `#${saveData.problem_number} ${saveData.title}` });
    } else {
      await base44.entities.Problem.create(saveData);
      toast({ title: "저장되었습니다", description: `#${saveData.problem_number} ${saveData.title} 문제가 추가되었습니다.` });
    }
    await loadData();
    setSaving(false);
    setShowForm(false);
    setEditingProblem(null);
  }, [form, editingProblem, problems, subject, loadData, toast]);

  const handleDelete = useCallback(async (id) => {
    if (!confirm("문제를 삭제하시겠습니까? 관련 제출 기록도 함께 삭제됩니다.")) return;
    const submissions = await base44.entities.UnitMissionSubmission.filter({ unit_id: id });
    await Promise.all([
      base44.entities.Problem.delete(id),
      ...submissions.map(s => base44.entities.UnitMissionSubmission.delete(s.id)),
    ]);
    toast({ title: `삭제 완료 (제출 기록 ${submissions.length}건 함께 삭제)` });
    loadData();
  }, [loadData, toast]);

  const toggleActive = useCallback(async (p) => {
    await base44.entities.Problem.update(p.id, { is_active: !p.is_active });
    loadData();
  }, [loadData]);

  // Algorithm Type management
  const handleAddType = useCallback(async () => {
    if (!newTypeName.trim()) return;
    await base44.entities.AlgorithmType.create({ name: newTypeName.trim(), is_active: true, order: algoTypes.length + 1 });
    setNewTypeName("");
    loadData();
    toast({ title: "유형 추가 완료" });
  }, [newTypeName, algoTypes.length, loadData, toast]);

  const handleDeleteType = useCallback(async (t) => {
    if (!confirm(`"${t.name}" 유형을 삭제하시겠습니까?`)) return;
    await base44.entities.AlgorithmType.delete(t.id);
    loadData();
    toast({ title: "유형 삭제 완료" });
  }, [loadData, toast]);

  const handleSaveTypeName = useCallback(async (t, newName) => {
    if (!newName.trim()) return;
    await base44.entities.AlgorithmType.update(t.id, { name: newName.trim() });
    setEditingType(null);
    loadData();
  }, [loadData]);

  const typeProblemCountMap = useMemo(() => {
    const map = {};
    problems.forEach(p => {
      if (p.algorithm_type) map[p.algorithm_type] = (map[p.algorithm_type] || 0) + 1;
    });
    return map;
  }, [problems]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-blue-600" />
          <h4 className="font-bold text-gray-900">알고리즘 문제 관리</h4>
          <Badge variant="outline" className="text-xs">{problems.length}문제</Badge>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowTypeManager(true)} variant="outline" size="sm">
            <Settings className="w-3.5 h-3.5 mr-1" />유형 관리
          </Button>
          <Button onClick={openAdd} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5 mr-1" />문제 추가
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs">번호</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs">제목</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs">난이도</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs">유형</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs">언어</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs">사용</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {problems.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 font-mono font-semibold text-blue-600">#{p.problem_number}</td>
                <td className="px-3 py-2.5 font-medium text-gray-900">{p.title}</td>
                <td className="px-3 py-2.5">
                  {p.difficulty && <Badge className={`text-xs ${difficultyColors[p.difficulty] || "bg-gray-100 text-gray-600"}`}>{p.difficulty}</Badge>}
                </td>
                <td className="px-3 py-2.5 text-gray-600 text-xs">{p.algorithm_type || "-"}</td>
                <td className="px-3 py-2.5">
                  {p.answer_language && <Badge variant="outline" className="text-xs">{p.answer_language}</Badge>}
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => toggleActive(p)} className="flex items-center gap-1 text-xs">
                    {p.is_active !== false
                      ? <><ToggleRight className="w-5 h-5 text-green-500" /><span className="text-green-600">사용</span></>
                      : <><ToggleLeft className="w-5 h-5 text-gray-400" /><span className="text-gray-400">미사용</span></>
                    }
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-7 w-7 p-0"><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {problems.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">문제가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Algorithm Type Manager */}
      <Dialog open={showTypeManager} onOpenChange={setShowTypeManager}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>알고리즘 유형 관리</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-2">
              <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="새 유형 이름" className="flex-1"
                onKeyDown={e => e.key === "Enter" && handleAddType()}
              />
              <Button onClick={handleAddType} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-1" />추가</Button>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {algoTypes.map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100">
                  {editingType?.id === t.id ? (
                    <Input
                      value={editingType.name}
                      onChange={e => setEditingType({ ...editingType, name: e.target.value })}
                      onBlur={() => handleSaveTypeName(t, editingType.name)}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveTypeName(t, editingType.name); if (e.key === "Escape") setEditingType(null); }}
                      className="h-7 text-sm flex-1 mr-2"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      <span className="text-xs text-gray-400">{typeProblemCountMap[t.name] || 0}문제</span>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button onClick={() => setEditingType({ id: t.id, name: t.name })} className="p-1 hover:text-blue-600 text-gray-400 transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteType(t)} className="p-1 hover:text-red-600 text-gray-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Problem Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open && !saving) setShowForm(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProblem ? "문제 수정" : "문제 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>문제 번호 *</Label>
                <Input type="number" value={form.problem_number} onChange={e => setForm({ ...form, problem_number: e.target.value })} placeholder="1001" className="mt-1" />
              </div>
              <div>
                <Label>난이도</Label>
                <Select value={form.difficulty} onValueChange={v => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="난이도 선택" /></SelectTrigger>
                  <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>알고리즘 유형</Label>
                <div className="flex gap-1 mt-1">
                  <Select value={form.algorithm_type} onValueChange={v => setForm({ ...form, algorithm_type: v })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="유형 선택" /></SelectTrigger>
                    <SelectContent>
                      {algoTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" className="h-9 px-2" onClick={() => setShowTypeManager(true)} title="유형 관리">
                    <Settings className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label>문제 제목 *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="문제 제목" className="mt-1" />
            </div>

            <div>
              <Label>문제 설명</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="문제 설명을 입력하세요" className="mt-1 h-28" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>입력 설명</Label>
                <Textarea value={form.input_description} onChange={e => setForm({ ...form, input_description: e.target.value })} placeholder="입력 형식" className="mt-1 h-20" />
              </div>
              <div>
                <Label>출력 설명</Label>
                <Textarea value={form.output_description} onChange={e => setForm({ ...form, output_description: e.target.value })} placeholder="출력 형식" className="mt-1 h-20" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">제한 조건</Label>
              <ConstraintsEditor value={form.constraints} onChange={v => setForm({ ...form, constraints: v })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>예제 입력</Label>
                <Textarea value={form.sample_input} onChange={e => setForm({ ...form, sample_input: e.target.value })} placeholder="예제 입력값" className="mt-1 h-20 font-mono text-sm" />
              </div>
              <div>
                <Label>예제 출력</Label>
                <Textarea value={form.sample_output} onChange={e => setForm({ ...form, sample_output: e.target.value })} placeholder="예제 출력값" className="mt-1 h-20 font-mono text-sm" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">테스트 케이스</Label>
              <TestCasesEditor
                value={form.test_cases}
                onChange={v => setForm({ ...form, test_cases: v })}
              />
            </div>

            <div>
              <Label className="mb-2 block">정답 코드</Label>
              <CodeEditor
                value={form.answer_code}
                language={form.answer_language || "python"}
                onValueChange={v => setForm({ ...form, answer_code: v })}
                onLanguageChange={v => setForm({ ...form, answer_language: v })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="prob_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="prob_active">사용 여부 (학생 화면에 표시)</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving} className="flex-1">취소</Button>
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