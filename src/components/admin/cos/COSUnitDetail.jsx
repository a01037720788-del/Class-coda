import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Edit, Trash2, Upload, File, CheckCircle, X,
  Download, Eye, EyeOff, ChevronDown, ChevronUp, Layers, ExternalLink
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import COSBulkUpload from "@/components/admin/COSBulkUpload";

const LEVELS = ["기초", "초급", "중급", "고급"];
const GRADING_MODES = [
  { value: "ai", label: "🤖 AI 채점", desc: "sb3 압축 해제 후 AI가 블록 구조 분석" },
  { value: "structure", label: "📊 구조 비교", desc: "파일 내용을 직접 비교" },
  { value: "manual", label: "👨‍🏫 수동 채점", desc: "선생님이 직접 확인 후 채점" },
];
const DEFAULT_FORM = {
  title: "", description: "", problem_number: 1, order: 0,
  level: "초급", category: "", round: "",
  grading_mode: "ai",
  is_published: true, is_active: true,
};

export default function COSUnitDetail({ unit, problems, allProblems, isUnclassified, onRefresh }) {
  const [tab, setTab] = useState("problems");
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [openIdx, setOpenIdx] = useState(null);
  const [answerUpload, setAnswerUpload] = useState({ uploading: false, url: "", name: "" });
  const [problemUpload, setProblemUpload] = useState({ uploading: false, url: "", name: "" });
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const answerFileRef = useRef();
  const problemFileRef = useRef();
  const { toast } = useToast();

  const loadSubmissions = async () => {
    const subs = await base44.entities.COSSubmission.list("-submitted_at", 500);
    const unitProblemIds = new Set(problems.map(p => p.id));
    setAllSubmissions(subs.filter(s => unitProblemIds.has(s.problem_id)));
    setSubsLoaded(true);
  };

  const handleTabChange = (t) => {
    setTab(t);
    if (t === "submissions" && !subsLoaded) loadSubmissions();
  };

  const openAdd = () => {
    const next = problems.length > 0 ? Math.max(...problems.map(p => p.problem_number || 0)) + 1 : 1;
    setEditingProblem(null);
    setForm({ ...DEFAULT_FORM, problem_number: next, order: problems.length });
    setAnswerUpload({ uploading: false, url: "", name: "" });
    setProblemUpload({ uploading: false, url: "", name: "" });
    setShowForm(true);
  };

  const openEdit = (p, e) => {
    e.stopPropagation();
    setEditingProblem(p);
    setForm({ ...DEFAULT_FORM, ...p });
    setAnswerUpload({ uploading: false, url: p.answer_file_url || "", name: p.answer_file_name || "" });
    setProblemUpload({ uploading: false, url: p.problem_file_url || "", name: p.problem_file_name || "" });
    setShowForm(true);
  };

  const handleFileUpload = async (file, setUpload) => {
    if (!file) return;
    setUpload({ uploading: true, url: "", name: file.name });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUpload({ uploading: false, url: file_url, name: file.name });
  };

  const saveProblem = async () => {
    if (!form.title.trim()) { toast({ title: "제목을 입력해주세요.", variant: "destructive" }); return; }
    const payload = {
      ...form,
      unit_id: unit.id || "",
      answer_file_url: answerUpload.url || form.answer_file_url || "",
      answer_file_name: answerUpload.name || form.answer_file_name || "",
      problem_file_url: problemUpload.url || form.problem_file_url || "",
      problem_file_name: problemUpload.name || form.problem_file_name || "",
    };
    if (editingProblem) await base44.entities.COSProblem.update(editingProblem.id, payload);
    else await base44.entities.COSProblem.create(payload);
    toast({ title: editingProblem ? "저장 완료" : "문제 추가 완료" });
    setShowForm(false);
    onRefresh();
  };

  const deleteProblem = async (problem, e) => {
    e.stopPropagation();
    if (!confirm(`"${problem.title}" 문제와 관련 제출 기록을 모두 삭제하시겠습니까?`)) return;
    // 연결된 제출 기록 먼저 삭제
    const subs = await base44.entities.COSSubmission.filter({ problem_id: problem.id });
    for (const sub of subs) {
      await base44.entities.COSSubmission.delete(sub.id);
    }
    await base44.entities.COSProblem.delete(problem.id);
    toast({ title: `삭제 완료 (제출 기록 ${subs.length}건 함께 삭제)` });
    onRefresh();
  };

  const togglePublish = async (p, e) => {
    e.stopPropagation();
    await base44.entities.COSProblem.update(p.id, { is_published: !p.is_published });
    onRefresh();
  };

  const toggleCheck = async (sub) => {
    const val = !sub.reviewed_by_admin;
    await base44.entities.COSSubmission.update(sub.id, { reviewed_by_admin: val, is_checked: val });
    loadSubmissions();
  };

  const uncheckedCount = allSubmissions.filter(s => !s.reviewed_by_admin && !s.is_checked).length;
  const levelColor = { 기초: "bg-gray-100 text-gray-600", 초급: "bg-blue-100 text-blue-700", 중급: "bg-orange-100 text-orange-700", 고급: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{unit.title}</h3>
          {unit.description && <p className="text-sm text-gray-400">{unit.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button onClick={() => handleTabChange("problems")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "problems" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
              문제 관리 ({problems.length})
            </button>
            <button onClick={() => handleTabChange("submissions")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "submissions" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
              제출 확인
              {uncheckedCount > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">{uncheckedCount}</span>}
            </button>
          </div>
          {tab === "problems" && !isUnclassified && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50">
                <Layers className="w-4 h-4" />일괄 업로드
              </Button>
              <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                <Plus className="w-4 h-4" />문제 추가
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── 문제 목록 탭 ── */}
      {tab === "problems" && (
        <div className="space-y-2">
          {problems.map((p, i) => (
            <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className={`flex items-center justify-between px-4 py-3 cursor-pointer ${openIdx === i ? "bg-blue-50 border-b border-blue-100" : "bg-gray-50 hover:bg-gray-100"}`}
                onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{p.problem_number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{p.title}</span>
                      {p.level && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${levelColor[p.level] || "bg-gray-100 text-gray-600"}`}>{p.level}</span>}
                      {p.category && <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{p.category}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.problem_file_url && <span className="text-[10px] text-green-600">📄 문제파일</span>}
                      {p.answer_file_url && <span className="text-[10px] text-blue-600">📎 정답파일</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={e => togglePublish(p, e)} title={p.is_published !== false ? "공개 중" : "비공개"}
                    className={`p-1.5 rounded-lg transition-colors ${p.is_published !== false ? "text-green-600 bg-green-50 hover:bg-green-100" : "text-gray-400 bg-gray-100 hover:bg-gray-200"}`}>
                    {p.is_published !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <Button variant="ghost" size="sm" onClick={e => openEdit(p, e)} className="h-7 w-7 p-0"><Edit className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={e => deleteProblem(p, e)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                  {openIdx === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
              {openIdx === i && (
                <div className="p-4 space-y-2">
                  {p.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{p.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    {p.problem_file_url && (
                      <a href={p.problem_file_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100">
                        <Download className="w-3.5 h-3.5" />문제 파일 ({p.problem_file_name})
                      </a>
                    )}
                    {p.answer_file_url && (
                      <a href={p.answer_file_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100">
                        <ExternalLink className="w-3.5 h-3.5" />정답 파일 ({p.answer_file_name})
                      </a>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))}
          {problems.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
              {isUnclassified ? "미분류 문제가 없습니다." : "문제를 추가하거나 일괄 업로드해 주세요."}
            </div>
          )}
        </div>
      )}

      {/* ── 제출 확인 탭 ── */}
      {tab === "submissions" && (
        <div className="space-y-3">
          {!subsLoaded ? (
            <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
          ) : allSubmissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">제출된 내역이 없습니다.</div>
          ) : allSubmissions.map(sub => {
            const isCorrect = sub.is_correct || sub.grading_result?.status === "correct";
            const isReviewed = sub.reviewed_by_admin || sub.is_checked;
            return (
              <div key={sub.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-3 ${isCorrect ? "border-green-200" : "border-red-200"}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {isCorrect ? "✅ 맞음" : "❌ 틀림"}
                  </span>
                  <span className="font-bold text-gray-900 text-sm">{sub.student_name}</span>
                  <span className="text-xs text-gray-500 truncate">{sub.problem_title}</span>
                  {sub.submitted_file_url && (
                    <a href={sub.submitted_file_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline flex-shrink-0">
                      <Download className="w-3 h-3" />파일
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {sub.submitted_at && <span className="text-[10px] text-gray-400 hidden sm:block">{new Date(sub.submitted_at).toLocaleDateString("ko-KR")}</span>}
                  <button onClick={() => toggleCheck(sub)}
                    className={`p-1.5 rounded-lg transition-colors ${isReviewed ? "text-green-600 bg-green-50 hover:bg-green-100" : "text-gray-400 hover:bg-gray-100"}`}
                    title={isReviewed ? "확인됨" : "확인 전"}>
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 문제 추가/수정 Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProblem ? "문제 수정" : "문제 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>문제 번호</Label>
              <Input type="number" value={form.problem_number}
                onChange={e => setForm(f => ({ ...f, problem_number: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <Label>문제 제목 *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="예: COS 1급 실기 1번" className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>난이도</Label>
                <select value={form.level || "초급"} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <Label>유형</Label>
                <Input value={form.category || ""} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="스프레드시트" className="mt-1" />
              </div>
              <div>
                <Label>회차</Label>
                <Input value={form.round || ""} onChange={e => setForm(f => ({ ...f, round: e.target.value }))} placeholder="2024-1회" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>문제 설명</Label>
              <textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="문제에 대한 설명..."
                className="mt-1 w-full border border-gray-200 rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <Label>📄 문제 파일 (학생 다운로드용)</Label>
              <input type="file" ref={problemFileRef} className="hidden"
                onChange={e => handleFileUpload(e.target.files[0], setProblemUpload)} />
              <FileUploadBox upload={problemUpload} onClear={() => setProblemUpload({ uploading: false, url: "", name: "" })}
                onClick={() => problemFileRef.current?.click()} label="문제 파일 업로드" color="green" />
            </div>
            <div>
              <Label>📎 정답 파일 (AI/구조 채점용)</Label>
              <input type="file" ref={answerFileRef} className="hidden"
                onChange={e => handleFileUpload(e.target.files[0], setAnswerUpload)} />
              <FileUploadBox upload={answerUpload} onClear={() => setAnswerUpload({ uploading: false, url: "", name: "" })}
                onClick={() => answerFileRef.current?.click()} label="정답 파일 업로드 (.sb3)" color="blue" />
            </div>

            <div>
              <Label>채점 방식</Label>
              <div className="mt-1 space-y-1.5">
                {GRADING_MODES.map(m => (
                  <label key={m.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.grading_mode === m.value ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"}`}>
                    <input type="radio" name="grading_mode" value={m.value} checked={form.grading_mode === m.value}
                      onChange={e => setForm(f => ({ ...f, grading_mode: e.target.value }))} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{m.label}</p>
                      <p className="text-xs text-gray-500">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input type="checkbox" checked={form.is_published !== false} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
              <span className="text-sm text-gray-700">학생에게 공개</span>
            </label>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">취소</Button>
              <Button onClick={saveProblem} className="flex-1 bg-blue-600 hover:bg-blue-700">저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 일괄 업로드 */}
      <COSBulkUpload
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onDone={() => { setShowBulkUpload(false); onRefresh(); }}
        unitId={unit.id}
        nextNumber={problems.length > 0 ? Math.max(...problems.map(p => p.problem_number || 0)) + 1 : 1}
      />
    </div>
  );
}

function FileUploadBox({ upload, onClear, onClick, label, color = "blue" }) {
  const colors = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "text-blue-600", hover: "hover:border-blue-400 hover:text-blue-500" },
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: "text-green-600", hover: "hover:border-green-400 hover:text-green-500" },
  };
  const c = colors[color];
  if (upload.name) {
    return (
      <div className={`flex items-center gap-2 p-2 ${c.bg} border ${c.border} rounded-lg mt-1`}>
        <File className={`w-4 h-4 ${c.icon} flex-shrink-0`} />
        <span className={`text-xs ${c.text} flex-1 truncate`}>{upload.name}</span>
        {upload.uploading && <span className="text-[10px] text-gray-400">업로드 중...</span>}
        {!upload.uploading && upload.url && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
        <button onClick={onClear} className="text-gray-400 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }
  return (
    <button onClick={onClick}
      className={`mt-1 w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 ${c.hover} transition-colors text-sm`}>
      <Upload className="w-4 h-4" />{label}
    </button>
  );
}