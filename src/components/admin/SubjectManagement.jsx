// 과목 관리 대시보드 — 과목 CRUD + 유형별 Unit 관리 컴포넌트 렌더링
import React, { useState, useEffect } from "react";
import { loadAllSubjectsAdmin, createSubject, updateSubject, deleteSubject, hardDeleteSubject } from "@/lib/dataAccess";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, BookOpen, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import ProblemManagement from "@/components/admin/ProblemManagement";
import PythonUnitManagement from "@/components/admin/PythonUnitManagement";
import CppUnitManagement from "@/components/admin/CppUnitManagement";
import HTMLUnitManagement from "@/components/admin/HTMLUnitManagement";
import EntryUnitManagement from "@/components/admin/EntryUnitManagement";
import COSManagement from "@/components/admin/COSManagement";
import CommonUnitManagement from "@/components/admin/CommonUnitManagement";
import JuniorPythonUnitManagement from "@/components/admin/JuniorPythonUnitManagement";
import JavaUnitManagement from "@/components/admin/JavaUnitManagement";
import AlgorithmUnitManagement from "@/components/admin/AlgorithmUnitManagement";

// 기본 과목 목록 (없으면 자동 생성)
const DEFAULT_SUBJECTS = [
  { name: "알고리즘", type: "algorithm", color: "#F59E0B", description: "알고리즘 문제 풀이" },
  { name: "알고리즘 학습", type: "algorithm_learning", color: "#7C3AED", description: "개념→시뮬레이션→구현→문제풀이 알고리즘 학습" },
  { name: "Python", type: "python", color: "#3B82F6", description: "파이썬 프로그래밍" },
  { name: "저학년 Python", type: "junior_python", color: "#84CC16", description: "초등 저학년을 위한 쉬운 Python 기초 과정" },
  { name: "C++", type: "cpp", color: "#2563EB", description: "C++ 프로그래밍 기초부터 알고리즘 실습까지" },
  { name: "Java", type: "java", color: "#DC2626", description: "Java 프로그래밍 기초부터 실습까지" },
  { name: "HTML", type: "html", color: "#10B981", description: "웹 개발 (HTML/CSS/JS)" },
  { name: "엔트리", type: "entry", color: "#8B5CF6", description: "엔트리 블록 코딩" },
  { name: "블록코딩", type: "block", color: "#EC4899", description: "블록 기반 코딩" },
  { name: "COS", type: "cos", color: "#EF4444", description: "COS 자격증 대비" },
];

const TYPE_OPTIONS = [
  { value: "algorithm", label: "알고리즘 (문제풀이)" },
  { value: "algorithm_learning", label: "알고리즘 학습 (Unit 기반)" },
  { value: "python", label: "Python" },
  { value: "junior_python", label: "저학년 Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
  { value: "html", label: "HTML/웹" },
  { value: "entry", label: "엔트리" },
  { value: "block", label: "블록코딩" },
  { value: "cos", label: "COS 자격증" },
  { value: "other", label: "기타" },
];

// 이름 정규화 (소문자 + 공백/특수문자 제거) — "알고리즘 학습" → "알고리즘학습"
function normalizeName(name = "") {
  return (name || "").toLowerCase().replace(/[\s\-_./]/g, "");
}

// type이 없는 기존 과목 → 이름으로 type 추론
function inferType(subject) {
  // type이 명시적으로 설정된 경우("other" 제외) 그대로 사용
  if (subject.type && subject.type !== "other") return subject.type;
  const name = normalizeName(subject.name);
  if (name.includes("알고리즘학습") || name.includes("algorithmlearning")) return "algorithm_learning";
  if (name.includes("알고리즘") || name.includes("algorithm")) return "algorithm";
  if (name.includes("저학년") || name.includes("junior")) return "junior_python";
  if (name === "python" || name.includes("파이썬")) return "python";
  if (name === "c++" || name === "cpp" || name.includes("씨플")) return "cpp";
  if (name === "java" || name.includes("자바")) return "java";
  if (name === "html" || name.includes("web") || name.includes("웹")) return "html";
  if (name === "엔트리" || name === "entry") return "entry";
  if (name.includes("블록") || name.includes("block")) return "block";
  if (name === "cos" || name.includes("cos")) return "cos";
  return "other";
}

function renderManagement(subject) {
  const type = inferType(subject);
  // 전용 관리 컴포넌트가 있는 과목
  if (type === "python") return <PythonUnitManagement />;
  if (type === "cpp") return <CppUnitManagement />;
  if (type === "java") return <JavaUnitManagement />;
  if (type === "html") return <HTMLUnitManagement />;
  if (type === "entry") return <EntryUnitManagement />;
  if (type === "cos") return <COSManagement />;
  if (type === "junior_python") return <JuniorPythonUnitManagement />;
  // 알고리즘 학습 (Unit 기반): 전용 AlgorithmUnit 관리
  if (type === "algorithm_learning") return <AlgorithmUnitManagement />;
  // 알고리즘: 기존 문제 관리 + 공통 Unit 관리 둘 다 표시
  if (type === "algorithm") return (
    <div className="space-y-6">
      <ProblemManagement subject={subject} />
      <div className="border-t border-gray-200 pt-4">
        <p className="text-xs text-gray-400 mb-3">📚 단원(Unit) 기반 학습 콘텐츠도 관리할 수 있습니다.</p>
        <CommonUnitManagement subjectType="algorithm" subjectId={subject.id} label="알고리즘" />
      </div>
    </div>
  );
  // 블록코딩, 기타 → 공통 Unit 관리
  if (type === "block") return <CommonUnitManagement subjectType="block" subjectId={subject.id} label="블록코딩" />;
  return <CommonUnitManagement subjectType="other" subjectId={subject.id} label={subject.name || "기타"} />;
}

export default function SubjectManagement() {
  // SubjectManagement — 과목 관리 대시보드
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [form, setForm] = useState({ name: "", type: "other", description: "", color: "#3B82F6", is_active: true });
  const [deleteTarget, setDeleteTarget] = useState(null); // 삭제 확인 모달용
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [hardDeleteMode, setHardDeleteMode] = useState(false);
  const [base44Subjects, setBase44Subjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const { toast } = useToast();
  const currentUser = getSessionUser();
  const superAdmin = isSuperAdmin(currentUser);

  useEffect(() => { loadSubjects(); }, []);

  // 누락된 기본 과목 자동 생성/보정 (DEFAULT_SUBJECTS 기준)
  // - type 기준으로 존재 여부 확인 → 없으면 생성
  // - 이름은 일치하나 type이 없는 과목 → type 보정 (중복 생성 방지)
  const ensureDefaultSubjects = async (existing) => {
    const existingTypes = new Set(existing.map(s => inferType(s)));
    const toCreate = [];
    const toFix = [];
    for (const def of DEFAULT_SUBJECTS) {
      if (existingTypes.has(def.type)) continue;
      // 이름이 일치하지만 type이 없는 과목 → type 보정
      const matchByName = existing.find(
        s => (!s.type || s.type === "other") && normalizeName(s.name) === normalizeName(def.name)
      );
      if (matchByName) {
        toFix.push({ id: matchByName.id, type: def.type });
      } else {
        toCreate.push(def);
      }
    }
    if (toCreate.length === 0 && toFix.length === 0) return false;
    for (const def of toCreate) {
      try { await createSubject(def); }
      catch (e) { console.warn("[Subject] 기본 과목 자동 생성 실패:", def.name, e.message); }
    }
    for (const fix of toFix) {
      try { await updateSubject(fix.id, { type: fix.type }); }
      catch (e) { console.warn("[Subject] type 보정 실패:", fix.id, e.message); }
    }
    return true;
  };

  const loadSubjects = async () => {
    setLoadingSubjects(true);
    try {
      let data = await loadAllSubjectsAdmin();
      // 누락된 기본 과목 자동 생성/보정 후 재조회
      const changed = await ensureDefaultSubjects(data);
      if (changed) {
        data = await loadAllSubjectsAdmin();
      }
      setSubjects(data);
      setBase44Subjects([]);
    } catch {
      // Supabase 접근 실패 시 Base44 확인
      try {
        const b44Subjects = await base44.entities.Subject.list();
        setBase44Subjects(b44Subjects);
      } catch { setBase44Subjects([]); }
    }
    setLoadingSubjects(false);
  };

  const openAdd = () => {
    setEditingSubject(null);
    setForm({ name: "", type: "other", description: "", color: "#3B82F6", is_active: true });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditingSubject(s);
    setForm({
      name: s.name || "",
      type: inferType(s),
      description: s.description || "",
      color: s.color || "#3B82F6",
      is_active: s.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "오류", description: "과목명을 입력해주세요.", variant: "destructive" }); return; }
    if (editingSubject) {
      await updateSubject(editingSubject.id, form);
      toast({ title: "수정 완료" });
      if (selectedSubject?.id === editingSubject.id) setSelectedSubject({ ...selectedSubject, ...form });
    } else {
      await createSubject(form);
      toast({ title: "등록 완료" });
    }
    setShowForm(false);
    loadSubjects();
  };

  const openDeleteConfirm = (s, e) => {
    e.stopPropagation();
    setDeleteTarget(s);
    setDeleteConfirmName("");
    setHardDeleteMode(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (hardDeleteMode) {
        // 영구 삭제 (super_admin only)
        await hardDeleteSubject(deleteTarget.id);
        toast({ title: "영구 삭제 완료", description: "과목이 완전히 삭제되었습니다." });
      } else {
        // 숨기기 (soft delete)
        await deleteSubject(deleteTarget.id);
        toast({ title: "숨김 완료", description: "과목이 숨김 처리되었습니다. (영구 삭제 아님)" });
      }
      if (selectedSubject?.id === deleteTarget.id) setSelectedSubject(null);
      setDeleteTarget(null);
      setDeleteConfirmName("");
      setHardDeleteMode(false);
    } catch (err) {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    }
    setDeleting(false);
    loadSubjects();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">과목 관리</h2>
          <p className="text-gray-500 text-sm mt-1">과목을 선택하면 상세 정보를 볼 수 있습니다</p>
        </div>
        {!(base44Subjects.length > 0 && subjects.length === 0) && (
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />과목 추가
          </Button>
        )}
      </div>

      {/* Subject List */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {subjects.map(s => (
          <div
            key={s.id}
            onClick={() => setSelectedSubject(s)}
            className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedSubject?.id === s.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color || "#3B82F6"}20` }}>
                <BookOpen className="w-4 h-4" style={{ color: s.color || "#3B82F6" }} />
              </div>
              <Badge variant={s.is_active !== false ? "default" : "secondary"} className="text-xs">
                {s.is_active !== false ? "사용" : "미사용"}
              </Badge>
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">{s.name}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{TYPE_OPTIONS.find(t => t.value === inferType(s))?.label || "기타"}</p>
            {s.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</p>}
            <div className="flex items-center gap-1 mt-3">
              <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openEdit(s); }} className="h-6 px-2 text-xs">
                <Edit className="w-3 h-3 mr-1" />수정
              </Button>
              {superAdmin && (
                <Button variant="ghost" size="sm" onClick={e => openDeleteConfirm(s, e)} className="h-6 px-2 text-xs text-red-500 hover:text-red-600">
                  <Trash2 className="w-3 h-3 mr-1" />삭제
                </Button>
              )}
            </div>
          </div>
        ))}
        {loadingSubjects && (
          <div className="col-span-full text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
        )}
        {subjects.length === 0 && !loadingSubjects && base44Subjects.length > 0 && (
          <>
            <div className="col-span-full bg-amber-50 border border-amber-200 rounded-xl p-4 mb-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-800 text-sm mb-1">
                    Supabase에 과목 데이터가 없습니다 — Base44 기존 과목 {base44Subjects.length}개 (읽기 전용)
                  </p>
                  <p className="text-xs text-amber-700 mb-2">
                    데이터 마이그레이션을 실행하면 기존 과목이 Supabase로 복사됩니다. 마이그레이션 완료까지 새 과목 생성/수정이 제한됩니다.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = "/admin/settings"} className="h-7 text-xs gap-1.5">
                    마이그레이션 페이지로 이동 →
                  </Button>
                </div>
              </div>
            </div>
            {base44Subjects.map(s => (
              <div key={s.id} className="bg-white rounded-xl border-2 border-gray-200 p-4 opacity-75">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color || "#3B82F6"}20` }}>
                    <BookOpen className="w-4 h-4" style={{ color: s.color || "#3B82F6" }} />
                  </div>
                  <Badge variant="secondary" className="text-xs">읽기 전용</Badge>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{s.name}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">{TYPE_OPTIONS.find(t => t.value === inferType(s))?.label || "기타"}</p>
                {s.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</p>}
              </div>
            ))}
          </>
        )}
        {subjects.length === 0 && !loadingSubjects && base44Subjects.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-400 text-sm">
            등록된 과목이 없습니다. "과목 추가" 버튼으로 새 과목을 만들어주세요.
          </div>
        )}
      </div>

      {/* Subject Detail */}
      {selectedSubject && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${selectedSubject.color || "#3B82F6"}20` }}>
              <BookOpen className="w-5 h-5" style={{ color: selectedSubject.color || "#3B82F6" }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{selectedSubject.name}</h3>
              <p className="text-sm text-gray-500">{selectedSubject.description || "설명 없음"}</p>
            </div>
          </div>
          {renderManagement(selectedSubject)}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteConfirmName(""); setHardDeleteMode(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />과목 삭제
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-500">과목명: </span>
              <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>
            </div>
            {!hardDeleteMode ? (
              <>
                <p className="text-sm text-gray-700 leading-relaxed">
                  과목을 <b>숨김 처리</b>합니다. 숨긴 과목은 목록에서 사라지지만 데이터는 보존되며, 언제든 복구할 수 있습니다.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }} className="flex-1">취소</Button>
                  <Button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {deleting ? "처리 중..." : "숨기기"}
                  </Button>
                </div>
                {superAdmin && (
                  <button
                    onClick={() => setHardDeleteMode(true)}
                    className="w-full text-xs text-red-500 hover:text-red-600 pt-1"
                  >
                    ⚠ 영구 삭제 (super_admin 전용) →
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <p className="font-semibold mb-1">⚠ 영구 삭제 모드</p>
                  <p className="text-xs">과목과 연결된 모든 학습 데이터가 완전히 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>
                </div>
                <p className="text-sm text-gray-700">
                  영구 삭제하려면 <b>영구 삭제</b>라고 정확히 입력해주세요.
                </p>
                <div>
                  <Input
                    value={deleteConfirmName}
                    onChange={e => setDeleteConfirmName(e.target.value)}
                    placeholder="영구 삭제"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setHardDeleteMode(false); setDeleteConfirmName(""); }} className="flex-1">← 숨기기로 변경</Button>
                  <Button
                    onClick={handleDelete}
                    disabled={deleteConfirmName !== "영구 삭제" || deleting}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
                  >
                    {deleting ? "처리 중..." : "영구 삭제"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSubject ? "과목 수정" : "과목 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>과목명 *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="과목명" className="mt-1" />
            </div>
            <div>
              <Label>과목 유형 *</Label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TYPE_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>설명</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="과목 설명" className="mt-1" />
            </div>
            <div>
              <Label>색상</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-9 w-16 rounded border border-gray-200 cursor-pointer" />
                <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="#3B82F6" className="flex-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="subj_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="subj_active">사용 중</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">취소</Button>
              <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700">저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}