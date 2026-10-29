import React, { useEffect, useState } from "react";
import { loadAllStudents, listAppUsers, updateStudent, updateAppUser, adminCreateStudent } from "@/lib/dataAccess";
import { getSessionToken, getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pencil, Users, Loader2 } from "lucide-react";
import StudentFormModal from "@/components/admin/StudentFormModal";
import { useToast } from "@/components/ui/use-toast";
import { SIMPLE_SUBJECT_NAMES } from "@/lib/subjects";

function displaySubjects(student) {
  const fromArray = (student.subjects || []).filter(s => SIMPLE_SUBJECT_NAMES.includes(s));
  if (fromArray.length > 0) return fromArray;
  return Object.entries(student.subject_permissions || {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .filter(k => SIMPLE_SUBJECT_NAMES.includes(k));
}

export default function AdminStudents() {
  const { toast } = useToast();
  const [students, setStudents] = useState([]);
  const [appUsers, setAppUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([loadAllStudents(), listAppUsers()]);
      setStudents(s || []);
      setAppUsers(u || []);
    } catch (err) {
      toast({ title: "데이터 로드 실패", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (student) => { setEditing(student); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const caller_login_id = getSessionUser()?.login_id || null;
      const names = form.subjects;
      const perms = Object.fromEntries(names.map(n => [n, true]));

      // 로그인 아이디 중복 검사
      const dup = appUsers.find(u =>
        u.login_id === form.login_id && (!editing || u.student_id !== editing.id)
      );
      if (dup) throw new Error("이미 사용 중인 아이디입니다.");

      if (editing) {
        await updateStudent(editing.id, {
          name: form.name,
          login_id: form.login_id,
          grade: form.grade,
          school_name: form.school_name,
          subjects: names,
          subject_permissions: perms,
          is_active: form.is_active,
        });

        // 학생 계정은 Students 시트의 같은 행에 저장됩니다.
        // Base44 계정 API를 별도로 호출하지 않습니다.
        if (form.newPassword) {
          const { adminResetStudentPassword } = await import("@/lib/sheetsApi");
          await adminResetStudentPassword(editing.student_id || editing.id, form.newPassword);
        }
        toast({ title: "수정 완료", description: `${form.name} 학생 정보가 저장되었습니다.` });
      } else {
        await adminCreateStudent({
          session_token: getSessionToken(),
          caller_login_id,
          student_id: crypto.randomUUID(),
          name: form.name,
          login_id: form.login_id,
          password: form.password,
          grade: form.grade,
          school_name: form.school_name,
          subjects: names,
          subject_permissions: perms,
        });
        toast({ title: "등록 완료", description: `${form.name} 학생이 등록되었습니다.` });
      }
      closeModal();
      await loadData();
    } catch (err) {
      toast({ title: "저장 실패", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = students.filter(s => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (s.name || "").toLowerCase().includes(q) || (s.login_id || "").toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">학생 관리</h1>
            <p className="text-xs text-gray-400">총 {students.length}명</p>
          </div>
        </div>
        <Button onClick={openAdd} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-1.5" />학생 추가
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="학생 이름 또는 아이디로 검색" className="pl-10" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">학생 목록을 불러오는 중...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">
            {students.length === 0 ? "등록된 학생이 없습니다." : "검색 결과가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(s => {
            const subs = displaySubjects(s);
            const inactive = s.is_active === false;
            return (
              <div key={s.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3 hover:shadow-sm transition-shadow">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    {inactive && <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-300">비활성</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    아이디: <span className="font-mono text-gray-700">{s.login_id || "-"}</span>
                    {s.grade && <span className="ml-3">학년: {s.grade}</span>}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {subs.length > 0 ? subs.map(sub => (
                      <Badge key={sub} variant="outline" className="text-[11px] text-violet-600 border-violet-200 bg-violet-50">{sub}</Badge>
                    )) : (
                      <span className="text-[11px] text-gray-300">수강 과목 없음</span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(s)} className="flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5 mr-1" />수정
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <StudentFormModal
        open={modalOpen}
        onClose={closeModal}
        student={editing}
        onSubmit={handleSave}
        saving={saving}
      />
    </div>
  );
}