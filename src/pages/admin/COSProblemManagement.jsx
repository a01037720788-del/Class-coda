import React, { useEffect, useState } from "react";
import { loadAllUnits, saveUnit } from "@/lib/dataAccess";
import { adminClassifyCOSProblems } from "@/lib/sheetsApi";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Eye, EyeOff, Trash2, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TYPE_OPTIONS = [
  { value: "write", label: "직접 코드 작성", help: "빈 편집기에서 학생이 코드를 처음부터 작성합니다." },
  { value: "fix", label: "기존 코드 수정", help: "오류가 있는 시작 코드를 제공하고 학생이 수정합니다." },
  { value: "fill", label: "코드 빈칸 채우기", help: "시작 코드에 ___ 빈칸을 넣고 학생이 해당 부분을 완성합니다." },
];
const TYPE_GUIDES = {
  write: { heading: "직접 코드 작성 문제", description: "문제 설명과 입출력 조건을 작성합니다. 학생에게는 빈 코드 편집기가 제공됩니다.", fields: ["description", "input_condition", "output_condition", "example", "answer_code", "default_stdin", "expected_output"] },
  fix: { heading: "오류 코드 수정 문제", description: "일부러 오류가 있는 코드를 제공하고, 어떤 오류를 수정해야 하는지 설명합니다.", fields: ["description", "default_code", "input_condition", "output_condition", "example", "answer_code", "default_stdin", "expected_output"] },
  fill: { heading: "코드 빈칸 채우기 문제", description: "완성되지 않은 코드에 ___ 표시를 넣습니다. 학생이 빈칸을 올바른 코드로 바꿉니다.", fields: ["description", "default_code", "input_condition", "output_condition", "example", "answer_code", "default_stdin", "expected_output"] },
};
const FIELD_DEFINITIONS = [
  ["description", "문제 설명 *", "학생에게 보여줄 문제 내용을 입력하세요."],
  ["input_condition", "입력 조건", "입력값의 범위와 형식"],
  ["output_condition", "출력 조건", "출력해야 할 결과"],
  ["example", "입력·출력 예시", "입력: ...\n출력: ..."],
  ["default_code", "학생에게 제공할 코드 *", ""],
  ["answer_code", "관리자용 정답 코드 (학생 비공개)", "정답 코드"],
  ["default_stdin", "기본 입력값 (stdin)", "프로그램 실행 시 전달할 입력"],
  ["expected_output", "예상 출력 결과 (자동 채점)", "예상 출력"],
];
const blankMission = () => ({ problem_type: "write", number: 1, title: "", description: "", default_code: "", expected_output: "", input_condition: "", output_condition: "", example: "", uses_input: false, default_stdin: "", grading_mode: "normalize", ai_grading: false, ai_rubric: "", test_cases: [] });
const problemNumber = (n) => `Q${String(n).padStart(3, "0")}`;
const nextNumber = (items) => Math.max(0, ...items.map(u => Number(u.unit_number) || 0)) + 1;

export default function COSProblemManagement({ subject, subjectName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState({});
  const [sortBy, setSortBy] = useState("number");
  const { toast } = useToast();
  async function refresh() {
    setLoading(true);
    try { setItems(await loadAllUnits(subject)); }
    catch (e) { toast({ title: "문제 불러오기 실패", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [subject]);
  function add() {
    const n = nextNumber(items);
    setEditing(null);
    setForm({ unit_number: n, title: "", is_active: true, missions: [blankMission()] });
    setOpen(true);
  }
  function modify(item) {
    setEditing(item);
    setForm({ ...item, title: String(item.title || "").replace(/^Q\d+\.?\s*/, ""), missions: item.missions?.length ? item.missions.map((m, idx) => idx === 0 ? { ...blankMission(), ...m, problem_type: m.problem_type || item.problem_type || "write" } : m) : [blankMission()] });
    setOpen(true);
  }
  async function persist(item, success = "저장 완료") {
    setSaving(true);
    try { await saveUnit(subject, item); await refresh(); toast({ title: success }); return true; }
    catch (e) { toast({ title: "저장 실패", description: e.message, variant: "destructive" }); return false; }
    finally { setSaving(false); }
  }
  async function save() {
    const title = String(form.title || "").trim();
    const mission = form.missions?.[0];
    const problemType = mission?.problem_type || "write";
    if (!title || !mission?.description?.trim()) { toast({ title: "문제 제목과 문제 설명을 입력하세요.", variant: "destructive" }); return; }
    if ((problemType === "fix" || problemType === "fill") && !String(mission.default_code || "").trim()) { toast({ title: "이 유형에는 학생에게 제공할 시작 코드가 필요합니다.", variant: "destructive" }); return; }
    if (problemType === "fill" && !String(mission.default_code || "").includes("___")) { toast({ title: "빈칸 채우기 문제의 시작 코드에는 ___ 표시를 하나 이상 넣어주세요.", variant: "destructive" }); return; }

    const n = Number(form.unit_number);
    if (items.some(i => Number(i.unit_number) === n && i.id !== editing?.id)) { toast({ title: "중복된 문제 번호입니다.", variant: "destructive" }); return; }
    const number = problemNumber(n);
    const saved = {
      ...(editing || {}), ...form,
      id: editing?.id || `${subject}_q${String(n).padStart(3,"0")}_${Date.now()}`,
      subject_type: subject, unit_number: n, problem_type: problemType,
      title: `${number}. ${title}`,
      subtitle: form.subtitle || `${subjectName} 코딩 문제`,
      learning_objectives: form.learning_objectives || [], concept_sections: form.concept_sections || [],
      tables: form.tables || [], example_codes: form.example_codes || [], questions: form.questions || [],
      missions: [{ ...mission, default_code: problemType === "write" ? "" : mission.default_code, problem_type: problemType, number: 1, title: `${number}. ${title}` }], summary: form.summary || "",
    };
    if (await persist(saved, editing ? "문제 수정 완료" : "문제 추가 완료")) setOpen(false);
  }
  async function setActive(item, active) {
    if (!active && !window.confirm(`${item.title} 문제를 비공개 처리할까요? 기존 제출 기록은 유지됩니다.`)) return;
    await persist({ ...item, is_active: active }, active ? "문제 공개 완료" : "문제 비공개 완료");
  }
  async function classifyAll() {
    if (!items.length) return;
    setClassifying(true);
    try {
      const next = {};
      for (let offset = 0; offset < items.length; offset += 20) {
        const batch = items.slice(offset, offset + 20).map(item => ({
          id: item.id, title: item.title,
          description: item.missions?.[0]?.description || "",
          default_code: item.missions?.[0]?.default_code || "",
          problem_type: item.missions?.[0]?.problem_type || item.problem_type || "write",
        }));
        const response = await adminClassifyCOSProblems(subject, batch);
        (response.results || []).forEach(result => { next[result.id] = result; });
      }
      setSuggestions(next);
      toast({ title: "AI 분류 완료", description: `${Object.keys(next).length}개 문제를 분석했습니다. 저장 전 결과를 확인하세요.` });
    } catch (e) { toast({ title: "AI 분류 실패", description: e.message, variant: "destructive" }); }
    finally { setClassifying(false); }
  }
  async function applySuggestions() {
    const targets = items.filter(item => suggestions[item.id]);
    if (!targets.length) return;
    if (!window.confirm(`${targets.length}개 문제에 AI 분류를 저장할까요? 문제 번호와 ID는 변경하지 않습니다.`)) return;
    setApplying(true);
    let saved = 0;
    try {
      for (const item of targets) {
        const suggestion = suggestions[item.id];
        // 문제 유형은 AI가 제안만 합니다. 학생 시작 코드와의 호환성을 위해 자동 변경하지 않습니다.
        await saveUnit(subject, {
          ...item,
          ai_category: suggestion.category,
          ai_difficulty: suggestion.difficulty,
          ai_classified_at: new Date().toISOString(),
        });
        saved++;
      }
      setSuggestions({});
      await refresh();
      toast({ title: "분류 저장 완료", description: `${saved}개 문제에 분류 정보를 저장했습니다.` });
    } catch (e) {
      await refresh();
      toast({ title: "일부 저장 실패", description: `${saved}개 저장 후 중단: ${e.message}`, variant: "destructive" });
    } finally { setApplying(false); }
  }
  const difficultyOrder = {"쉬움":0,"보통":1,"어려움":2};
  const orderedItems = [...items].sort((a,b) => {
    const av = suggestions[a.id] || a, bv = suggestions[b.id] || b;
    if (sortBy === "category") return String(av.category || av.ai_category || "기타").localeCompare(String(bv.category || bv.ai_category || "기타"), "ko") || a.unit_number - b.unit_number;
    if (sortBy === "difficulty") return (difficultyOrder[av.difficulty || av.ai_difficulty] ?? 3) - (difficultyOrder[bv.difficulty || bv.ai_difficulty] ?? 3) || a.unit_number - b.unit_number;
    if (sortBy === "type") return String(a.missions?.[0]?.problem_type || a.problem_type || "write").localeCompare(String(b.missions?.[0]?.problem_type || b.problem_type || "write")) || a.unit_number - b.unit_number;
    return a.unit_number - b.unit_number;
  });
  const visibleCount = items.filter(i => i.is_active !== false).length;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">{subjectName} 문제 관리</h2><p className="text-sm text-gray-500">전체 {items.length}문제 · 공개 {visibleCount}문제 · 문제 개수 자동 계산</p></div>
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="문제 정렬 기준" className="border rounded-md px-3 py-2 text-sm bg-white" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="number">문제 번호순</option><option value="category">학습 주제순</option><option value="difficulty">난이도순</option><option value="type">문제 유형순</option>
        </select>
        <Button variant="outline" onClick={classifyAll} disabled={loading || classifying || applying || !items.length}><Sparkles className="w-4 h-4 mr-1" />{classifying ? "AI 분석 중..." : "AI 자동 분류"}</Button>
        {Object.keys(suggestions).length > 0 && <Button onClick={applySuggestions} disabled={applying || classifying}>{applying ? "저장 중..." : `분류 결과 저장 (${Object.keys(suggestions).length})`}</Button>}
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" />문제 추가</Button>
      </div>
    </div>
    {loading ? <p className="text-gray-500">문제 목록을 불러오는 중입니다...</p> : items.length === 0 ? <p className="border rounded-lg p-8 text-center text-gray-500">등록된 문제가 없습니다. 문제 추가 버튼을 눌러주세요.</p> :
      <div className="space-y-2">{orderedItems.map(item => <div key={item.id} className="border rounded-lg bg-white p-3 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{item.title}</p>
          <p className="text-xs mt-1 text-indigo-700">{(suggestions[item.id] || item).category || item.ai_category || "미분류"} · {(suggestions[item.id] || item).difficulty || item.ai_difficulty || "난이도 미설정"}{suggestions[item.id] ? " · AI 제안 (미저장)" : ""}</p>
          {suggestions[item.id]?.reason && <p className="text-xs text-gray-500 mt-1">AI 분석: {suggestions[item.id].reason} · 추천 유형: {TYPE_OPTIONS.find(t => t.value === suggestions[item.id].problem_type)?.label || "직접 코드 작성"}</p>}<p className="text-xs text-gray-500">{item.is_active === false ? "비공개" : "공개"} · {TYPE_OPTIONS.find(t => t.value === (item.missions?.[0]?.problem_type || item.problem_type || "write"))?.label} · {item.missions?.[0]?.description?.slice(0, 75) || "문제 설명 없음"}</p></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => modify(item)}><Pencil className="w-3 h-3 mr-1" />수정</Button>
          <Button size="sm" variant="outline" onClick={() => setActive(item, item.is_active === false)}>{item.is_active === false ? <Eye className="w-3 h-3 mr-1"/> : <EyeOff className="w-3 h-3 mr-1"/>}{item.is_active === false ? "공개" : "비공개"}</Button>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setActive(item, false)} disabled={item.is_active === false}><Trash2 className="w-3 h-3 mr-1"/>삭제</Button>
        </div>
      </div>)}</div>}
    <Dialog open={open} onOpenChange={v => { if (!saving) setOpen(v); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "문제 수정" : "문제 추가"} — {subjectName}</DialogTitle></DialogHeader>
      {form && <div className="space-y-4"><p className="text-sm font-semibold text-orange-600">문제 번호: {problemNumber(form.unit_number)} (자동 부여)</p>
        <div><Label>문제 제목 *</Label><Input value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} placeholder="문제 제목" /></div>
        <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold">문제 내용</h3>
          <div className="space-y-2"><Label>문제 유형 *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(t => <button key={t.value} type="button"
                className={`rounded-lg border p-3 text-left transition-colors ${ (form.missions?.[0]?.problem_type || "write") === t.value ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-400"}`}
                onClick={() => setForm(f => ({...f, missions: [{...f.missions[0], problem_type: t.value }]}))}>
                <p className="text-sm font-semibold">{t.label}</p><p className="text-xs text-gray-500 mt-1">{t.help}</p>
              </button>)}
            </div>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
            <p className="font-semibold text-orange-900">{TYPE_GUIDES[form.missions?.[0]?.problem_type || "write"].heading}</p>
            <p className="mt-1 text-orange-800">{TYPE_GUIDES[form.missions?.[0]?.problem_type || "write"].description}</p>
          </div>
          {(form.missions?.[0]?.problem_type || "write") === "fix" && <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">예: <code>print(totle)</code>처럼 잘못된 변수명을 넣고, 문제 설명에 어떤 동작으로 수정해야 하는지 작성하세요.</div>}
          {(form.missions?.[0]?.problem_type || "write") === "fill" && <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">예: <code>result = a + ___</code>처럼 빈칸을 표시하세요. 학생은 ___를 직접 코드로 바꿉니다.</div>}
          {FIELD_DEFINITIONS.filter(([field]) => TYPE_GUIDES[form.missions?.[0]?.problem_type || "write"].fields.includes(field)).map(([field, label, placeholder]) => <div key={field}>
            <Label>{label}</Label>
            <Textarea className={field.includes("code") ? "font-mono mt-1" : "mt-1"} rows={field === "description" ? 5 : field.includes("code") ? 4 : 2}
              value={form.missions?.[0]?.[field] || ""} placeholder={field === "default_code" ? ((form.missions?.[0]?.problem_type || "write") === "fix" ? "# 학생이 수정할 오류 코드를 입력하세요." : (form.missions?.[0]?.problem_type || "write") === "fill" ? "result = ___\nprint(result)" : "학생은 빈 편집기에서 시작합니다.") : placeholder}
              onChange={e => setForm(f => ({ ...f, missions: [{ ...f.missions[0], [field]: e.target.value }] }))} />
          </div>)}
          {(form.missions?.[0]?.problem_type || "write") !== "write" && <p className="text-xs text-orange-700">학생용 시작 코드에 {form.missions?.[0]?.problem_type === "fill" ? "___ 빈칸을 넣어주세요. 학생이 코드를 직접 수정해 완성합니다." : "일부러 잘못된 코드를 입력해 주세요. 학생이 해당 코드를 수정합니다."}</p>}
          <div className="border rounded-lg p-3 bg-white space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.missions?.[0]?.ai_grading === true} onChange={e => setForm(f => ({...f, missions:[{...f.missions[0], ai_grading:e.target.checked}]}))}/>AI 코드 분석 및 자동 채점 사용 (COS PRO 전용)</label>
            <p className="text-xs text-gray-600">테스트 케이스가 있으면 실행 결과를 우선 채점하고 AI는 피드백을 제공합니다. 테스트가 없으면 AI가 정답 여부를 판정합니다. Google Apps Script에 OPENAI_API_KEY 설정이 필요합니다.</p>
            {form.missions?.[0]?.ai_grading && <><Label>AI 채점 기준 (관리자 전용)</Label><Textarea rows={3} value={form.missions?.[0]?.ai_rubric || ""} onChange={e => setForm(f => ({...f,missions:[{...f.missions[0],ai_rubric:e.target.value}]}))} placeholder="반드시 만족해야 하는 조건, 허용할 다른 풀이 등을 작성하세요."/></>}
          </div>
          <div><Label>채점 방식</Label>
            <select className="mt-1 w-full border rounded-md p-2 bg-white" value={form.missions?.[0]?.grading_mode || "normalize"}
              onChange={e => setForm(f => ({ ...f, missions: [{ ...f.missions[0], grading_mode: e.target.value }] }))}>
              <option value="normalize">공백·줄바꿈 정규화 후 비교</option><option value="exact">정확히 비교</option>
            </select>
          </div>
          <div className="space-y-2"><div className="flex items-center justify-between"><Label>추가 테스트 케이스</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({...f, missions:[{...f.missions[0], test_cases:[...(f.missions[0].test_cases || []), {input:"", expected_output:""}]}]}))}><Plus className="w-3 h-3 mr-1"/>테스트 추가</Button></div>
            {(form.missions?.[0]?.test_cases || []).map((test,i) => <div key={i} className="border rounded-md p-2 bg-white space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">테스트 {i+1}<Button type="button" size="sm" variant="ghost" onClick={() => setForm(f => ({...f, missions:[{...f.missions[0], test_cases:f.missions[0].test_cases.filter((_,j)=>i!==j)}]}))}>삭제</Button></div>
              {[["input","입력"],["expected_output","예상 출력"]].map(([key,label]) => <div key={key}><Label>{label}</Label><Textarea className="font-mono" rows={2} value={test[key] || ""} onChange={e => setForm(f => ({...f, missions:[{...f.missions[0],test_cases:f.missions[0].test_cases.map((t,j)=>j===i?{...t,[key]:e.target.value}:t)}]}))}/></div>)}
            </div>)}
          </div>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>취소</Button><Button onClick={save} disabled={saving}>{saving ? "저장 중..." : "문제 저장"}</Button></div>
      </div>}
    </DialogContent></Dialog>
  </div>;
}
