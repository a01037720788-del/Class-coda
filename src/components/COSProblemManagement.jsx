import React, { useEffect, useState } from "react";
import { loadAllUnits, saveUnit } from "@/lib/dataAccess";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const blankMission = () => ({ number: 1, title: "", description: "", default_code: "# 여기에 파이썬 코드를 작성하세요.\n", expected_output: "", input_condition: "", output_condition: "", example: "", uses_input: false, default_stdin: "", grading_mode: "normalize", test_cases: [] });
const problemNumber = (n) => `Q${String(n).padStart(3, "0")}`;
const nextNumber = (items) => Math.max(0, ...items.map(u => Number(u.unit_number) || 0)) + 1;

export default function COSProblemManagement({ subject, subjectName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
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
    setForm({ ...item, title: String(item.title || "").replace(/^Q\d+\.?\s*/, ""), missions: item.missions?.length ? item.missions : [blankMission()] });
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
    if (!title || !mission?.description?.trim()) { toast({ title: "문제 제목과 문제 설명을 입력하세요.", variant: "destructive" }); return; }
    const n = Number(form.unit_number);
    if (items.some(i => Number(i.unit_number) === n && i.id !== editing?.id)) { toast({ title: "중복된 문제 번호입니다.", variant: "destructive" }); return; }
    const number = problemNumber(n);
    const saved = {
      ...(editing || {}), ...form,
      id: editing?.id || `${subject}_q${String(n).padStart(3,"0")}_${Date.now()}`,
      subject_type: subject, unit_number: n,
      title: `${number}. ${title}`,
      subtitle: form.subtitle || `${subjectName} 코딩 문제`,
      learning_objectives: form.learning_objectives || [], concept_sections: form.concept_sections || [],
      tables: form.tables || [], example_codes: form.example_codes || [], questions: form.questions || [],
      missions: [{ ...mission, number: 1, title: `${number}. ${title}` }], summary: form.summary || "",
    };
    if (await persist(saved, editing ? "문제 수정 완료" : "문제 추가 완료")) setOpen(false);
  }
  async function setActive(item, active) {
    if (!active && !window.confirm(`${item.title} 문제를 비공개 처리할까요? 기존 제출 기록은 유지됩니다.`)) return;
    await persist({ ...item, is_active: active }, active ? "문제 공개 완료" : "문제 비공개 완료");
  }
  const visibleCount = items.filter(i => i.is_active !== false).length;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">{subjectName} 문제 관리</h2><p className="text-sm text-gray-500">전체 {items.length}문제 · 공개 {visibleCount}문제 · 문제 개수 자동 계산</p></div>
      <Button onClick={add}><Plus className="w-4 h-4 mr-1" />문제 추가</Button>
    </div>
    {loading ? <p className="text-gray-500">문제 목록을 불러오는 중입니다...</p> : items.length === 0 ? <p className="border rounded-lg p-8 text-center text-gray-500">등록된 문제가 없습니다. 문제 추가 버튼을 눌러주세요.</p> :
      <div className="space-y-2">{[...items].sort((a,b) => a.unit_number-b.unit_number).map(item => <div key={item.id} className="border rounded-lg bg-white p-3 flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{item.title}</p><p className="text-xs text-gray-500">{item.is_active === false ? "비공개" : "공개"} · {item.missions?.[0]?.description?.slice(0, 75) || "문제 설명 없음"}</p></div>
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
          {[
            ["description", "문제 설명 *", "학생에게 보여줄 문제 내용을 입력하세요."],
            ["input_condition", "입력 조건", "입력값의 범위와 형식"],
            ["output_condition", "출력 조건", "출력해야 할 결과"],
            ["example", "입력·출력 예시", "입력: ...\n출력: ..."],
            ["default_code", "학생용 시작 코드", "# 여기에 코드를 작성하세요."],
            ["answer_code", "관리자용 정답 코드 (학생 비공개)", "정답 코드"],
            ["default_stdin", "기본 입력값 (stdin)", "프로그램 실행 시 전달할 입력"],
            ["expected_output", "예상 출력 결과 (자동 채점)", "예상 출력"],
          ].map(([field, label, placeholder]) => <div key={field}>
            <Label>{label}</Label>
            <Textarea className={field.includes("code") ? "font-mono mt-1" : "mt-1"} rows={field === "description" ? 5 : field.includes("code") ? 4 : 2}
              value={form.missions?.[0]?.[field] || ""} placeholder={placeholder}
              onChange={e => setForm(f => ({ ...f, missions: [{ ...f.missions[0], [field]: e.target.value }] }))} />
          </div>)}
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
