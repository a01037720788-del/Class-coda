import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { loadAllUnits, loadUnitContent, saveUnit as saveUnitDA, deleteUnit as deleteUnitDA, toggleUnitActive, deleteProgressByUnit, deleteSubmissionsByUnit } from "@/lib/dataAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, ExternalLink, CheckCircle, Link, File, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TeachingButton from "@/components/teaching/TeachingButton";

const DEFAULT_UNIT = {
  unit_number: 1,
  title: "",
  description: "",
  entry_project_url: "",
  missions: [],
  is_active: true,
};

export default function EntryUnitManagement() {
  const [units, setUnits] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [tab, setTab] = useState("units"); // "units" | "submissions"
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(DEFAULT_UNIT);
  const [openIdx, setOpenIdx] = useState(null);
  const [expandedUnits, setExpandedUnits] = useState({});
  const [subError, setSubError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadUnits();
    loadSubmissions();
  }, []);

  const loadUnits = async () => {
    const data = await loadAllUnits("entry");
    setUnits(data);
  };

  const loadSubmissions = async () => {
    setSubError(null);
    try {
      const data = await base44.entities.EntrySubmission.list("-submitted_at", 500);
      setSubmissions(data);
    } catch (err) {
      setSubError("제출 기록을 불러올 수 없습니다. (Base44 서비스)");
      console.warn("EntrySubmission load 실패:", err);
    }
  };

  const openAdd = () => {
    const nextNum = units.length > 0 ? Math.max(...units.map(u => u.unit_number || 0)) + 1 : 1;
    setEditingUnit(null);
    setForm({ ...DEFAULT_UNIT, unit_number: nextNum });
    setShowForm(true);
  };

  const openEdit = async (u, e) => {
    e.stopPropagation();
    const fullUnit = await loadUnitContent(u.id);
    const data = fullUnit || u;
    setEditingUnit(data);
    setForm({ ...DEFAULT_UNIT, ...data });
    setShowForm(true);
  };

  const saveUnit = async () => {
    if (!form.title.trim()) {
      toast({ title: "제목을 입력해주세요.", variant: "destructive" });
      return;
    }
    const payload = {
      unit_number: form.unit_number,
      title: form.title,
      description: form.description || "",
      entry_project_url: form.entry_project_url || "",
      missions: form.missions || [],
      is_active: form.is_active !== false,
    };
    if (editingUnit) {
      await saveUnitDA({ ...payload, id: editingUnit.id, subject_type: "entry" });
      toast({ title: "저장 완료" });
    } else {
      await saveUnitDA({ ...payload, subject_type: "entry" });
      toast({ title: "Unit 추가 완료" });
    }
    setShowForm(false);
    loadUnits();
  };

  const deleteUnit = async (unit, e) => {
    e.stopPropagation();
    if (!confirm(`"${unit.title}" Unit과 관련 제출 기록을 모두 삭제하시겠습니까?`)) return;
    await Promise.all([
      deleteUnitDA(unit.id),
      deleteProgressByUnit(unit.id),
      deleteSubmissionsByUnit(unit.id),
    ]);
    // Base44: EntrySubmission 삭제 (보조 기능 — 실패 시 경고만)
    try {
      const subs = await base44.entities.EntrySubmission.filter({ unit_id: unit.id });
      for (const s of subs) await base44.entities.EntrySubmission.delete(s.id);
    } catch (err) {
      console.warn("EntrySubmission 삭제 실패 (무시 가능):", err);
    }
    toast({ title: "삭제 완료" });
    loadUnits();
    loadSubmissions();
  };

  const toggleCheck = async (sub) => {
    try {
      await base44.entities.EntrySubmission.update(sub.id, { is_checked: !sub.is_checked });
      loadSubmissions();
    } catch (err) {
      toast({ title: "상태 변경 실패", description: "Base44 서비스를 확인해 주세요.", variant: "destructive" });
    }
  };

  const addMission = () =>
    setForm(f => ({ ...f, missions: [...(f.missions || []), { number: (f.missions || []).length + 1, title: "", description: "" }] }));
  const updateMission = (i, field, val) => {
    const arr = [...form.missions];
    arr[i] = { ...arr[i], [field]: val };
    setForm(f => ({ ...f, missions: arr }));
  };
  const removeMission = (i) =>
    setForm(f => ({ ...f, missions: f.missions.filter((_, idx) => idx !== i) }));

  const uncheckedCount = submissions.filter(s => !s.is_checked).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-gray-800">엔트리 Unit 관리</h3>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setTab("units")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "units" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >
              Unit 목록
            </button>
            <button
              onClick={() => setTab("submissions")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "submissions" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >
              제출 확인
              {uncheckedCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1">{uncheckedCount}</span>
              )}
            </button>
          </div>
          {tab === "units" && (
            <Button size="sm" onClick={openAdd} className="bg-green-600 hover:bg-green-700 gap-1.5">
              <Plus className="w-4 h-4" />Unit 추가
            </Button>
          )}
        </div>
      </div>

      {/* ── Units 탭 ── */}
      {tab === "units" && (
        <div className="space-y-2">
          {units.map((u, i) => (
            <div
              key={u.id}
              className={`border rounded-xl overflow-hidden transition-all ${u.is_active !== false ? "border-green-200" : "border-gray-200"}`}
            >
              <div
                className={`flex items-center justify-between px-4 py-3 cursor-pointer ${openIdx === i ? "bg-green-50" : "bg-gray-50 hover:bg-gray-100"}`}
                onClick={async () => {
                  if (openIdx === i) {
                    setOpenIdx(null);
                  } else {
                    setOpenIdx(i);
                    if (!expandedUnits[u.id]) {
                      const full = await loadUnitContent(u.id);
                      if (full) setExpandedUnits(prev => ({ ...prev, [u.id]: full }));
                    }
                  }
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {u.unit_number}
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-900 text-sm">{u.title}</span>
                    {u.entry_project_url && <span className="ml-2 text-xs text-green-600">🔗 예제링크</span>}
                    <span className="ml-2 text-xs text-gray-400">Mission {u.missions_count || 0}개</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={u.is_active !== false ? "default" : "secondary"} className="text-[10px]">
                    {u.is_active !== false ? "활성" : "비활성"}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={e => openEdit(u, e)} className="h-7 w-7 p-0">
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <TeachingButton subjectType="entry" unitId={u.id} />
                  <Button variant="ghost" size="sm" onClick={e => deleteUnit(u, e)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {openIdx === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {openIdx === i && (
                <div className="p-4 border-t border-gray-100 space-y-3">
                  {(() => {
                    const ud = expandedUnits[u.id] || u;
                    return (
                      <>
                        {ud.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{ud.description}</p>}
                        {ud.entry_project_url && (
                          <a
                            href={ud.entry_project_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />엔트리 예제 작품 열기
                          </a>
                        )}
                        {(ud.missions || []).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Mission</p>
                            <div className="space-y-1">
                              {ud.missions.map((m, mi) => (
                                <div key={mi} className="text-xs text-gray-600 flex gap-2">
                                  <span className="text-orange-500 font-bold flex-shrink-0">M{m.number}.</span>
                                  <span className="font-medium">{m.title}</span>
                                  {m.description && <span className="text-gray-400">— {m.description}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}

          {units.length === 0 && (
            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
              엔트리 Unit이 없습니다. Unit을 추가해 주세요.
            </div>
          )}
        </div>
      )}

      {/* ── Submissions 탭 ── */}
      {tab === "submissions" && (
        <div className="space-y-2">
          {subError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-amber-50 rounded-xl border border-amber-200">
              <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-sm text-gray-600 font-medium mb-1">{subError}</p>
              <Button variant="outline" size="sm" onClick={loadSubmissions}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />다시 시도
              </Button>
            </div>
          ) : submissions.map(sub => (
            <div
              key={sub.id}
              className={`bg-white rounded-xl border p-4 ${sub.is_checked ? "border-green-200" : "border-orange-200"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-gray-900">{sub.student_name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{sub.unit_title}</span>
                    {sub.mission_title && (
                      <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        Mission {sub.mission_number}: {sub.mission_title}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sub.is_checked ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {sub.is_checked ? "✅ 확인됨" : "⏳ 미확인"}
                    </span>
                  </div>

                  {sub.file_url && (
                    <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline break-all">
                      <File className="w-3 h-3 flex-shrink-0" />{sub.file_name || "제출 파일"}
                    </a>
                  )}
                  {sub.project_url && (
                    <a
                      href={sub.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline break-all"
                    >
                      <Link className="w-3 h-3 flex-shrink-0" />{sub.project_url}
                    </a>
                  )}
                  {sub.description && (
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{sub.description}</p>
                  )}
                  {sub.submitted_at && (
                    <p className="text-[11px] text-gray-400 mt-1">{new Date(sub.submitted_at).toLocaleString("ko-KR")}</p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {sub.project_url && (
                    <a href={sub.project_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-300">
                        <ExternalLink className="w-3 h-3" />열기
                      </Button>
                    </a>
                  )}
                  <button
                    onClick={() => toggleCheck(sub)}
                    className={`p-2 rounded-lg transition-colors ${sub.is_checked ? "text-green-600 bg-green-50" : "text-gray-400 hover:bg-gray-100"}`}
                    title={sub.is_checked ? "확인 취소" : "확인 처리"}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!subError && submissions.length === 0 && (
            <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
              제출된 작품이 없습니다.
            </div>
          )}
        </div>
      )}

      {/* ── Unit Form Dialog ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Unit 수정" : "Unit 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit 번호</Label>
                <Input
                  type="number"
                  value={form.unit_number}
                  onChange={e => setForm(f => ({ ...f, unit_number: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  id="entry_active"
                  checked={form.is_active !== false}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                <label htmlFor="entry_active" className="text-sm">활성</label>
              </div>
            </div>

            <div>
              <Label>제목 *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="예: 오브젝트 움직이기"
                className="mt-1"
              />
            </div>

            <div>
              <Label>설명</Label>
              <textarea
                value={form.description || ""}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Unit 설명..."
                className="mt-1 w-full border border-gray-200 rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>

            <div>
              <Label>엔트리 예제 작품 링크</Label>
              <Input
                value={form.entry_project_url || ""}
                onChange={e => setForm(f => ({ ...f, entry_project_url: e.target.value }))}
                placeholder="https://playentry.org/project/..."
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">학생이 참고할 예제 작품의 엔트리 링크를 입력하세요.</p>
            </div>

            {/* Mission */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-bold">Mission</Label>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addMission}>
                  <Plus className="w-3 h-3 mr-1" />추가
                </Button>
              </div>
              {(form.missions || []).map((m, i) => (
                <div key={i} className="flex gap-2 mb-2 items-start">
                  <Input
                    type="number"
                    value={m.number}
                    onChange={e => updateMission(i, "number", Number(e.target.value))}
                    className="w-14 h-8 text-xs"
                    placeholder="번호"
                  />
                  <Input
                    value={m.title}
                    onChange={e => updateMission(i, "title", e.target.value)}
                    placeholder="Mission 제목"
                    className="flex-1 h-8 text-xs"
                  />
                  <Input
                    value={m.description || ""}
                    onChange={e => updateMission(i, "description", e.target.value)}
                    placeholder="설명 (선택)"
                    className="flex-1 h-8 text-xs"
                  />
                  <button onClick={() => removeMission(i)} className="text-red-400 text-xs hover:text-red-600 mt-1.5">✕</button>
                </div>
              ))}
              {(form.missions || []).length === 0 && (
                <p className="text-xs text-gray-400">Mission을 추가하면 학생이 작품 링크를 제출할 수 있습니다.</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">취소</Button>
              <Button onClick={saveUnit} className="flex-1 bg-green-600 hover:bg-green-700">저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}