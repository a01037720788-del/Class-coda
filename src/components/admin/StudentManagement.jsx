import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { loadAllStudents, loadActiveSubjects, loadAllEnrollments, createStudent, updateStudent, deleteStudent, createEnrollment, updateEnrollment, deleteEnrollment, deleteProgressByStudent, deleteSubmissionsByStudent, verifyStudentExists, adminCreateStudent, listAppUsers, createAppUser, updateAppUser } from "@/lib/dataAccess";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, User, Eye, EyeOff, KeyRound, AlertCircle, Send, ShieldCheck, Loader2, Database } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import PasswordChangeModal from "./PasswordChangeModal";
import RepaymentModal from "./RepaymentModal";
import SubjectPermModal from "./SubjectPermModal";
import StudentDetailModal from "./StudentDetailModal";
import CreateLoginAccountModal from "./CreateLoginAccountModal";

const PRESET_SCHOOLS = ["SJA", "KIS", "NLCS", "BHA"];

// 활성 과목 요약 표시
function ActiveSubjectsSummary({ student, subjects }) {
  const perms = student.subject_permissions || {};
  const activeNames = subjects.filter(sub => {
    return perms[sub.id] === true || perms[sub.name] === true;
  }).map(s => s.name);

  if (activeNames.length === 0) return <span className="text-gray-300 text-xs">없음</span>;
  const shown = activeNames.slice(0, 2);
  const rest = activeNames.length - 2;
  return (
    <span className="text-xs text-gray-700">
      {shown.join(", ")}{rest > 0 ? ` 외 ${rest}개` : ""}
    </span>
  );
}

// 학교 입력 컴포넌트
const SchoolInput = memo(function SchoolInput({ schoolName, schoolType, onChange }) {
  const isCustom = schoolType === "custom" || (schoolName && !PRESET_SCHOOLS.includes(schoolName));
  const selectValue = isCustom ? "__custom__" : (schoolName || "");

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      onChange({ school_name: "", school_type: "custom" });
    } else {
      onChange({ school_name: val, school_type: "preset" });
    }
  };

  return (
    <div className="space-y-2">
      <select
        value={isCustom ? "__custom__" : selectValue}
        onChange={handleSelectChange}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">학교 선택</option>
        {PRESET_SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
        <option value="__custom__">직접 입력</option>
      </select>
      {isCustom && (
        <Input
          value={schoolName || ""}
          onChange={e => onChange({ school_name: e.target.value, school_type: "custom" })}
          placeholder="학교명 직접 입력"
          className="mt-1"
        />
      )}
    </div>
  );
});

const emptyForm = {
  name: "", login_id: "", password: "",
  grade: "",
  school_name: "", school_type: "preset",
  teacher_ids: [], teacher_names: [],
  subjects: [], student_phone: "", parent_phone: "", notes: "", is_active: true,
  subjectPermissions: {},
  paidLessons: {},
};

export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterSchool, setFilterSchool] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [passwordModalStudent, setPasswordModalStudent] = useState(null);
  const [repaymentModal, setRepaymentModal] = useState({ open: false, student: null, enrollment: null });
  const [editingEnrollments, setEditingEnrollments] = useState([]);
  const [permModal, setPermModal] = useState({ open: false, student: null });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [detailStudent, setDetailStudent] = useState(null);
  const [appUsers, setAppUsers] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [createAccountStudent, setCreateAccountStudent] = useState(null);
  const currentUser = getSessionUser();
  const { toast } = useToast();

  // 검색어 debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoadError("");
      const [studs, allUsers, subjs, enrs] = await Promise.all([
        loadAllStudents(),
        listAppUsers(),
        loadActiveSubjects(),
        loadAllEnrollments(),
      ]);
      const adminUsers = (allUsers || []).filter(u => u.role === "admin");
      const teacherUsers = (allUsers || []).filter(u => u.role === "teacher");
      setStudents(studs);
      setAppUsers(allUsers || []);
      setTeachers([...adminUsers, ...teacherUsers]);
      setSubjects(subjs);
      setEnrollments(enrs);
    } catch (err) {
      setLoadError(err?.message || "학생 정보를 불러오지 못했습니다.");
    }
  }, []);

  // app_users를 student_id로 매핑 (상세 모달에서 로그인 계정 표시용)
  const appUserByStudentId = useMemo(() => {
    const map = {};
    (appUsers || []).forEach(u => {
      if (u.student_id) map[u.student_id] = u;
    });
    return map;
  }, [appUsers]);

  // enrollment lookup map: studentId → enrollments[]
  const enrollmentMap = useMemo(() => {
    const map = {};
    enrollments.forEach(e => {
      if (!map[e.student_id]) map[e.student_id] = [];
      map[e.student_id].push(e);
    });
    return map;
  }, [enrollments]);

  const getStudentEnrollments = useCallback((studentId) => enrollmentMap[studentId] || [], [enrollmentMap]);

  const getCompletedLessons = useCallback((studentId) =>
    (enrollmentMap[studentId] || []).reduce((sum, e) => sum + (e.completed_lessons || 0), 0),
  [enrollmentMap]);

  const getRemainingLessons = useCallback((studentId) =>
    (enrollmentMap[studentId] || []).reduce((sum, e) => sum + (e.remaining_lessons ?? (e.paid_lessons || 0) - (e.completed_lessons || 0)), 0),
  [enrollmentMap]);

  const hasRepaymentNeeded = useCallback((studentId) =>
    (enrollmentMap[studentId] || []).some(e => {
      const rem = e.remaining_lessons ?? (e.paid_lessons || 0) - (e.completed_lessons || 0);
      return rem <= 0 && (e.paid_lessons || 0) > 0;
    }),
  [enrollmentMap]);

  // 학교 필터 목록 (기본 선택지 + 직접 입력된 학교들)
  const { presetSchoolsInUse, customSchools } = useMemo(() => {
    const allSchools = [...new Set(students.map(s => s.school_name).filter(Boolean))];
    return {
      presetSchoolsInUse: PRESET_SCHOOLS.filter(s => allSchools.includes(s)),
      customSchools: allSchools.filter(s => !PRESET_SCHOOLS.includes(s)),
    };
  }, [students]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    let list = students.filter(s => {
      const matchSearch = !q ||
        s.name?.toLowerCase().includes(q) ||
        s.login_id?.toLowerCase().includes(q) ||
        s.school_name?.toLowerCase().includes(q) ||
        s.teacher_names?.some(t => t.toLowerCase().includes(q)) ||
        s.subjects?.some(sub => sub.toLowerCase().includes(q));
      const isSuper = isSuperAdmin(currentUser);
      const matchTeacher = isSuper
        ? (filterTeacher === "all" || s.teacher_ids?.includes(filterTeacher))
        : s.teacher_ids?.includes(currentUser?.id);
      const matchSubject = filterSubject === "all" || s.subjects?.includes(filterSubject);
      const matchSchool = filterSchool === "all" || s.school_name === filterSchool;
      return matchSearch && matchTeacher && matchSubject && matchSchool;
    });
    return list.sort((a, b) => {
      if (sortBy === "latest") return new Date(b.created_date) - new Date(a.created_date);
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "completed_desc") return getCompletedLessons(b.id) - getCompletedLessons(a.id);
      if (sortBy === "remaining_asc") return getRemainingLessons(a.id) - getRemainingLessons(b.id);
      return 0;
    });
  }, [students, debouncedSearch, filterTeacher, filterSubject, filterSchool, sortBy, getCompletedLessons, getRemainingLessons]);

  const openAdd = useCallback(() => { setEditingStudent(null); setEditingEnrollments([]); setForm(emptyForm); setError(""); setShowForm(true); }, []);

  const openEdit = useCallback((s) => {
    setEditingStudent(s);
    const sEnrollments = enrollments.filter(e => e.student_id === s.id);
    setEditingEnrollments(sEnrollments);
    const paidLessons = {};
    sEnrollments.forEach(e => { paidLessons[e.subject_name] = e.paid_lessons || 0; });
    setForm({
      name: s.name || "", login_id: s.login_id || "", password: "",
      grade: s.grade || "",
      school_name: s.school_name || "",
      school_type: s.school_type || (PRESET_SCHOOLS.includes(s.school_name) ? "preset" : s.school_name ? "custom" : "preset"),
      teacher_ids: s.teacher_ids || [], teacher_names: s.teacher_names || [],
      subjects: s.subjects || [], student_phone: s.student_phone || s.phone || "",
      parent_phone: s.parent_phone || "", notes: s.notes || "", is_active: s.is_active !== false,
      subjectPermissions: { ...(s.subject_permissions || {}) },
      paidLessons,
    });
    setError("");
    setShowForm(true);
  }, [enrollments]);

  const toggleTeacher = useCallback((teacher) => {
    const ids = form.teacher_ids || [];
    const names = form.teacher_names || [];
    if (ids.includes(teacher.id)) {
      setForm(f => ({ ...f, teacher_ids: ids.filter(id => id !== teacher.id), teacher_names: names.filter(n => n !== teacher.name) }));
    } else {
      setForm(f => ({ ...f, teacher_ids: [...ids, teacher.id], teacher_names: [...names, teacher.name] }));
    }
  }, []);

  const toggleSubject = useCallback((subjectName) => {
    setForm(f => {
      const subs = f.subjects || [];
      return subs.includes(subjectName)
        ? { ...f, subjects: subs.filter(s => s !== subjectName) }
        : { ...f, subjects: [...subs, subjectName] };
    });
  }, []);

  const setPaidLesson = (subjectName, value) => {
    setForm(f => ({ ...f, paidLessons: { ...(f.paidLessons || {}), [subjectName]: Number(value) || 0 } }));
  };

  const upsertParentAccount = async (studentId, studentName, parentPhone) => {
    if (!parentPhone) return;
    const digits = parentPhone.replace(/[^0-9]/g, "");
    if (!digits) return;
    const allUsers = await listAppUsers();
    const allParents = (allUsers || []).filter(u => u.role === "parent");
    const existing = allParents.find(p => (p.login_id || "").replace(/[^0-9]/g, "") === digits);
    if (existing) {
      const linked = existing.linked_student_ids || [];
      if (!linked.includes(studentId)) {
        await updateAppUser(existing.id, {
          linked_student_ids: [...linked, studentId],
        });
      }
    } else {
      await createAppUser({
        name: `${studentName} 학부모`, login_id: digits, phone: parentPhone,
        password: "1234", role: "parent", linked_student_ids: [studentId], is_active: true,
      });
    }
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) { setError("이름을 입력해주세요."); return; }
    if (!editingStudent) {
      if (!form.login_id.trim()) { setError("학생 로그인 계정을 만들려면 아이디와 비밀번호가 필요합니다."); return; }
      if (!form.password) { setError("학생 로그인 계정을 만들려면 아이디와 비밀번호가 필요합니다."); return; }
    }

    // 전체 app_users에서 login_id 중복 확인
    if (form.login_id) {
      try {
        const allUsers = await listAppUsers();
        const dup = (allUsers || []).find(u => u.login_id === form.login_id && u.student_id !== editingStudent?.id);
        if (dup) { setError("이미 사용 중인 아이디입니다."); return; }
      } catch (err) {
        setError("사용자 목록 조회 실패: " + (err?.message || "알 수 없는 오류"));
        return;
      }
    }

    setSaving(true);
    try {
      const basePerms = editingStudent?.subject_permissions || {};
      const mergedPerms = form.subjectPermissions ? { ...basePerms, ...form.subjectPermissions } : basePerms;

      const saveData = {
        name: form.name, login_id: form.login_id, grade: form.grade,
        school_name: form.school_name, school_type: form.school_type,
        teacher_ids: form.teacher_ids, teacher_names: form.teacher_names,
        subjects: form.subjects, student_phone: form.student_phone,
        parent_phone: form.parent_phone, notes: form.notes, is_active: form.is_active,
        subject_permissions: mergedPerms,
      };

      if (editingStudent) {
        // ─── 수정 ───
        try { await updateStudent(editingStudent.id, saveData); }
        catch (err) { throw new Error(`학생 정보 저장 실패: ${err?.message || err}`); }

        try {
          const allUsers = await listAppUsers();
          const appUser = (allUsers || []).find(u => u.student_id === editingStudent.id);
          if (appUser) {
            const updateData = { name: form.name };
            if (form.login_id) updateData.login_id = form.login_id;
            await updateAppUser(appUser.id, updateData);
          }
        } catch (err) { throw new Error(`로그인 계정 수정 실패: ${err?.message || err}`); }

        if (form.parent_phone) {
          try { await upsertParentAccount(editingStudent.id, form.name, form.parent_phone); }
          catch (err) { throw new Error(`학부모 계정 처리 실패: ${err?.message || err}`); }
        }

        for (const subjectName of form.subjects) {
          const paid = (form.paidLessons || {})[subjectName] || 0;
          const existing = editingEnrollments.find(e => e.subject_name === subjectName);
          const subj = subjects.find(s => s.name === subjectName);
          if (existing) {
            const newRemaining = paid - (existing.completed_lessons || 0);
            try {
              await updateEnrollment(existing.id, {
                paid_lessons: paid, remaining_lessons: newRemaining, repayment_needed: newRemaining <= 0,
              });
            } catch (err) { throw new Error(`수강 정보 수정 실패 (${subjectName}): ${err?.message || err}`); }
          } else if (paid > 0) {
            try {
              await createEnrollment({
                id: crypto.randomUUID(),
                student_id: editingStudent.id, student_name: form.name,
                subject_id: subj?.id || "", subject_name: subjectName,
                paid_lessons: paid, completed_lessons: 0, remaining_lessons: paid, repayment_needed: false,
              });
            } catch (err) { throw new Error(`수강 정보 저장 실패 (${subjectName}): ${err?.message || err}`); }
          }
        }
        toast({ title: "수정 완료", description: "학생 정보가 수정되었습니다." });
      } else {
        // ─── 신규 추가 — 하나의 백엔드 RPC로 통합 (보상 트랜잭션) ───
        const studentId = crypto.randomUUID();

        // enrollment 데이터 준비
        const enrollmentsData = (form.subjects || [])
          .filter(subjectName => ((form.paidLessons || {})[subjectName] || 0) > 0)
          .map(subjectName => {
            const paid = (form.paidLessons || {})[subjectName] || 0;
            const subj = subjects.find(s => s.name === subjectName);
            return {
              id: crypto.randomUUID(),
              subject_id: subj?.id || "",
              subject_name: subjectName,
              paid_lessons: paid,
            };
          });

        let result;
        try {
          result = await adminCreateStudent({
            student_id: studentId,
            name: form.name,
            login_id: form.login_id,
            password: form.password,
            grade: form.grade,
            school_name: form.school_name,
            school_type: form.school_type,
            teacher_ids: form.teacher_ids,
            teacher_names: form.teacher_names,
            subjects: form.subjects,
            subject_permissions: mergedPerms,
            student_phone: form.student_phone,
            parent_phone: form.parent_phone,
            email: form.email,
            notes: form.notes,
            enrollments: enrollmentsData,
          });
        } catch (err) {
          throw new Error(err?.message || err);
        }

        // 학부모 계정은 별도 처리 (RPC 외부 — 실패해도 학생 데이터는 유지)
        if (form.parent_phone) {
          try { await upsertParentAccount(studentId, form.name, form.parent_phone); }
          catch (err) { throw new Error(`학부모 계정 처리 실패: ${err?.message || err}`); }
        }

        toast({ title: "등록 완료", description: `학생이 등록되었습니다. (수강 ${result.enrollment_count}개)` });
      }
      setShowForm(false);
      loadAll();
    } catch (err) {
      console.error("학생 저장 실패:", err);
      const msg = err?.message || "저장 중 오류가 발생했습니다.";
      setError(msg);
      toast({ title: "저장 실패", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    if (!confirm(`"${s.name}" 학생을 삭제하시겠습니까?\n관련된 수강 정보, 진도, 제출 데이터, 로그인 계정이 모두 서버에서 안전하게 삭제됩니다.`)) return;
    setDeletingId(s.id);
    try {
      await deleteStudent(s.id);
      toast({ title: "삭제 완료", description: `${s.name} 학생이 삭제되었습니다.` });

      // LessonFeedback 정리
      try {
        const feedbacks = await base44.entities.LessonFeedback.filter({ student_id: s.id });
        if (feedbacks.length > 0) {
          await Promise.all(feedbacks.map(f => base44.entities.LessonFeedback.delete(f.id)));
          console.log(`[삭제] LessonFeedback ${feedbacks.length}건 정리됨`);
        }
      } catch (err) {
        console.warn(`[삭제] LessonFeedback 정리 실패 (무시됨):`, err.message);
      }

      await loadAll();
    } catch (err) {
      console.error("학생 삭제 실패:", err);
      toast({ title: "삭제 실패", description: err?.message || "삭제 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const { teacherGroups, unassigned } = useMemo(() => {
    const isSuper = isSuperAdmin(currentUser);
    if (!isSuper) {
      return {
        teacherGroups: teachers.filter(t => t.id === currentUser?.id).map(t => ({
          teacher: t,
          students: students.filter(s => s.teacher_ids?.includes(t.id)),
        })).filter(g => g.students.length > 0),
        unassigned: [],
      };
    }
    return {
      teacherGroups: teachers.map(t => ({
        teacher: t,
        students: students.filter(s => s.teacher_ids?.includes(t.id)),
      })).filter(g => g.students.length > 0),
      unassigned: students.filter(s => !s.teacher_ids || s.teacher_ids.length === 0),
    };
  }, [teachers, students, currentUser]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">학생 관리</h2>
          <p className="text-gray-500 text-sm mt-1">
            전체 학생 {students.length}명
            {filtered.length !== students.length && (
              <span className="text-blue-600 ml-1">· 검색 결과 {filtered.length}명</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />학생 추가
          </Button>
        </div>
      </div>

      {/* 데이터 출처 표시 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
          <Database className="w-3 h-3" />학생 데이터: Base44 기준
        </span>
      </div>

      {/* 로드 에러 */}
      {loadError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {loadError}
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab("list")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "list" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>전체 목록</button>
        <button onClick={() => setActiveTab("byTeacher")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "byTeacher" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>선생님별 보기</button>
      </div>

      {activeTab === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="이름, 아이디, 학교, 선생님, 과목으로 검색" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="latest">최신순</option>
                <option value="name">이름순</option>
                <option value="completed_desc">수업 많은순</option>
                <option value="remaining_asc">남은 차시 적은순</option>
              </select>
              {isSuperAdmin(currentUser) && (
              <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="all">전체 선생님</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              )}
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="all">전체 과목</option>
                {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="all">전체 학교</option>
                {presetSchoolsInUse.map(s => <option key={s} value={s}>{s}</option>)}
                {customSchools.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">학생</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">학교</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">아이디 / 비밀번호</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">담당 선생님</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">수강 과목</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">결제/수업/남은 차시</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">활성 과목</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => {
                  const enrs = getStudentEnrollments(s.id);
                  const needRepayment = hasRepaymentNeeded(s.id);
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${needRepayment ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                            {s.grade && <p className="text-xs text-gray-400">{s.grade}</p>}
                            {needRepayment && (
                              <span className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" />재결제 필요
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.school_name ? (
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{s.school_name}</span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="text-xs font-mono text-gray-700">ID: <span className="font-semibold">{s.login_id || "-"}</span></p>
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-mono text-gray-600">PW: {visiblePasswords[s.id] ? (s.password || "-") : "••••••"}</p>
                            <button onClick={() => setVisiblePasswords(prev => ({ ...prev, [s.id]: !prev[s.id] }))} className="text-gray-400 hover:text-gray-700">
                              {visiblePasswords[s.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                          {(s.student_phone || s.phone) && <p className="text-[10px] text-gray-400">학생: {s.student_phone || s.phone}</p>}
                          {s.parent_phone && <p className="text-[10px] text-gray-400">학부모: {s.parent_phone}</p>}
                          {/* app_users 연결 상태 표시 */}
                          {appUserByStudentId[s.id] ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-medium">
                              <ShieldCheck className="w-2.5 h-2.5" />로그인 계정 연결됨
                            </span>
                          ) : (
                            <button
                              onClick={() => setCreateAccountStudent(s)}
                              className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-700 hover:underline font-medium"
                            >
                              <KeyRound className="w-2.5 h-2.5" />로그인 계정 생성
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.teacher_names?.length > 0 ? s.teacher_names.join(", ") : <span className="text-gray-300">미배정</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.subjects || []).slice(0, 3).map(sub => (
                            <Badge key={sub} variant="outline" className="text-xs">{sub}</Badge>
                          ))}
                          {(s.subjects || []).length > 3 && <Badge variant="outline" className="text-xs">+{(s.subjects || []).length - 3}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {enrs.length > 0 ? (
                          <div className="space-y-1">
                            {enrs.map(e => {
                              const rem = e.remaining_lessons ?? (e.paid_lessons || 0) - (e.completed_lessons || 0);
                              const isLow = rem <= 0 && (e.paid_lessons || 0) > 0;
                              return (
                                <div key={e.id}>
                                  <div className="text-gray-500 mb-0.5">{e.subject_name}</div>
                                  <div className={`text-xs ${isLow ? "text-red-600 font-semibold" : "text-gray-700"}`}>
                                    결제 {e.paid_lessons || 0} · 수업 {e.completed_lessons || 0} · 남은 {rem}
                                    {isLow && " 🔴"}
                                  </div>
                                  {isLow && (
                                    <button
                                      onClick={() => setRepaymentModal({ open: true, student: s, enrollment: e })}
                                      className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5 mt-0.5"
                                    >
                                      <Send className="w-2.5 h-2.5" />재결제 안내 문구 만들기
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={s.is_active !== false ? "bg-green-100 text-green-700 hover:bg-green-100 border-0" : "bg-gray-100 text-gray-500 border-0"}>
                          {s.is_active !== false ? "재원" : "퇴원"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <ActiveSubjectsSummary student={s} subjects={subjects} />
                          <button
                            onClick={() => setPermModal({ open: true, student: s })}
                            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 hover:underline mt-0.5"
                          >
                            <ShieldCheck className="w-3 h-3" />과목 권한 설정
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailStudent(s)} className="h-7 w-7 p-0" title="상세">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="h-7 w-7 p-0" title="수정">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setPasswordModalStudent(s)} className="h-7 w-7 p-0 text-blue-500 hover:bg-blue-50" title="비밀번호 변경">
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(s)}
                            disabled={deletingId === s.id}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                            title={deletingId === s.id ? "삭제 중..." : "삭제"}
                          >
                            {deletingId === s.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">학생이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "byTeacher" && (
        <div className="space-y-6">
          {teacherGroups.map(({ teacher, students: ts }) => (
            <div key={teacher.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">{teacher.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{teacher.name} 선생님</p>
                    <p className="text-xs text-gray-500">담당 학생 {ts.length}명</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {ts.map(s => {
                  const enrs = getStudentEnrollments(s.id);
                  const needRepayment = hasRepaymentNeeded(s.id);
                  return (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900 text-sm">{s.name}</span>
                        {s.grade && <span className="text-xs text-gray-400">{s.grade}</span>}
                        {s.school_name && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{s.school_name}</span>}
                        {needRepayment && (
                          <span className="text-xs text-red-600 font-semibold flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" />재결제 필요
                          </span>
                        )}
                        {s.subjects?.length > 0 && (
                          <div className="flex gap-1">{s.subjects.slice(0, 3).map(sub => <Badge key={sub} variant="outline" className="text-xs">{sub}</Badge>)}</div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="h-7 w-7 p-0">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {unassigned.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                <p className="font-bold text-gray-500">미배정 학생 ({unassigned.length}명)</p>
              </div>
              <div className="divide-y divide-gray-50">
                {unassigned.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 text-sm">{s.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="h-7 w-7 p-0">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 과목 권한 설정 모달 */}
      {permModal.open && permModal.student && (
        <SubjectPermModal
          student={permModal.student}
          subjects={subjects}
          open={permModal.open}
          onClose={() => setPermModal({ open: false, student: null })}
          onSaved={(newPerms) => {
            setStudents(prev => prev.map(s =>
              s.id === permModal.student.id ? { ...s, subject_permissions: newPerms } : s
            ));
          }}
        />
      )}

      {/* 재결제 안내 모달 */}
      <RepaymentModal
        open={repaymentModal.open}
        onClose={() => setRepaymentModal({ open: false, student: null, enrollment: null })}
        student={repaymentModal.student}
        enrollment={repaymentModal.enrollment}
      />

      {/* 비밀번호 변경 모달 */}
      {passwordModalStudent && (
        <PasswordChangeModal
          student={passwordModalStudent}
          open={!!passwordModalStudent}
          onClose={() => setPasswordModalStudent(null)}
        />
      )}

      {/* 학생 상세 모달 (Supabase students 기준) */}
      {detailStudent && (
        <StudentDetailModal
          student={detailStudent}
          appUser={appUserByStudentId[detailStudent.id] || null}
          enrollments={enrollments.filter(e => e.student_id === detailStudent.id)}
          subjects={subjects}
          teachers={teachers}
          open={!!detailStudent}
          onClose={() => setDetailStudent(null)}
          onEdit={() => {
            const s = detailStudent;
            setDetailStudent(null);
            openEdit(s);
          }}
        />
      )}

      {/* 로그인 계정 생성 모달 (app_users가 없는 기존 학생용) */}
      {createAccountStudent && (
        <CreateLoginAccountModal
          student={createAccountStudent}
          open={!!createAccountStudent}
          onClose={() => setCreateAccountStudent(null)}
          onCreated={loadAll}
        />
      )}

      {/* 학생 추가/수정 다이얼로그 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "학생 수정" : "학생 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>}

            <div>
              <Label>학생 이름 *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="학생 이름" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>학생 아이디 {!editingStudent && <span className="text-red-500">*</span>}</Label>
                <Input value={form.login_id} onChange={e => setForm({ ...form, login_id: e.target.value })} placeholder="student01" className="mt-1" />
                {!editingStudent && <p className="text-[10px] text-gray-400 mt-0.5">학생 로그인 계정 생성에 필수입니다.</p>}
              </div>
              <div>
                {!editingStudent ? (
                  <>
                    <Label>비밀번호 <span className="text-red-500">*</span></Label>
                    <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="초기 비밀번호" className="mt-1" />
                  </>
                ) : (
                  <div className="mt-5">
                    <p className="text-xs text-gray-400">비밀번호 변경은 목록의 🔑 버튼을 이용하세요.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 학년 + 학교 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>학년</Label>
                <Input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="예: 중2, 고1" className="mt-1" />
              </div>
              <div>
                <Label>학교</Label>
                <div className="mt-1">
                  <SchoolInput
                    schoolName={form.school_name}
                    schoolType={form.school_type}
                    onChange={({ school_name, school_type }) => setForm(f => ({ ...f, school_name, school_type }))}
                  />
                </div>
              </div>
            </div>

            {/* 전화번호 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>학생 전화번호</Label>
                <Input value={form.student_phone} onChange={e => setForm({ ...form, student_phone: e.target.value })} placeholder="010-1111-2222" className="mt-1" />
              </div>
              <div>
                <Label>학부모 전화번호</Label>
                <Input value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })} placeholder="010-3333-4444" className="mt-1" />
                {!editingStudent && form.parent_phone && (
                  <p className="text-[10px] text-blue-500 mt-0.5">저장 시 학부모 계정이 자동 생성됩니다 (초기 비밀번호: 1234)</p>
                )}
              </div>
            </div>

            {/* 담당 선생님 */}
            <div>
              <Label>담당 선생님</Label>
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                {teachers.map(t => (
                  <div key={t.id} onClick={() => toggleTeacher(t)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors ${(form.teacher_ids || []).includes(t.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <input type="checkbox" checked={(form.teacher_ids || []).includes(t.id)} onChange={() => {}} className="pointer-events-none" />
                    <span className="font-medium text-gray-900">{t.name}</span>
                    <span className="text-xs text-gray-400">관리자</span>
                  </div>
                ))}
                {teachers.length === 0 && <div className="px-3 py-3 text-center text-gray-400 text-sm">등록된 선생님 없음</div>}
              </div>
              {(form.teacher_names || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {form.teacher_names.map(n => <Badge key={n} variant="outline" className="text-xs">{n}</Badge>)}
                </div>
              )}
            </div>

            {/* 수강 과목 + 결제 차시 */}
            <div>
              <Label>수강 과목 및 결제 차시</Label>
              <div className="mt-2 space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                {subjects.map(s => {
                  const isSelected = (form.subjects || []).includes(s.name);
                  const paid = (form.paidLessons || {})[s.name] || "";
                  const existingEnr = editingEnrollments.find(e => e.subject_name === s.name);
                  return (
                    <div key={s.id}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSubject(s.name)}
                          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors text-left ${isSelected ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"}`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-white border-white" : "border-gray-400"}`}>
                            {isSelected && <span className="w-2 h-2 bg-blue-600 rounded-sm block" />}
                          </span>
                          {s.name}
                        </button>
                        {isSelected && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Input type="number" min="0" value={paid} onChange={e => setPaidLesson(s.name, e.target.value)}
                              placeholder="차시" className="w-20 h-9 text-sm text-center" onClick={e => e.stopPropagation()} />
                            <span className="text-xs text-gray-500 whitespace-nowrap">회</span>
                          </div>
                        )}
                      </div>
                      {isSelected && editingStudent && existingEnr && (
                        <div className="ml-2 mt-1 text-xs text-gray-500 flex gap-3">
                          <span>결제 {existingEnr.paid_lessons || 0}회</span>
                          <span>수업 {existingEnr.completed_lessons || 0}회</span>
                          <span className={`font-medium ${((existingEnr.remaining_lessons ?? (existingEnr.paid_lessons || 0) - (existingEnr.completed_lessons || 0)) <= 0) ? "text-red-600" : "text-green-700"}`}>
                            남은 {existingEnr.remaining_lessons ?? ((existingEnr.paid_lessons || 0) - (existingEnr.completed_lessons || 0))}회
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 과목 접근 권한 */}
            <div>
              <Label>과목 접근 권한 (학생 메뉴 표시)</Label>
              <div className="mt-2 space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                {subjects.map(subject => {
                  const permsObj = form.subjectPermissions || {};
                  const isOn = permsObj[subject.id] === true || permsObj[subject.name] === true;
                  const togglePerm = () => {
                    setForm(f => ({
                      ...f,
                      subjectPermissions: {
                        ...(f.subjectPermissions || {}),
                        [subject.id]: !isOn,
                        [subject.name]: !isOn,
                      }
                    }));
                  };
                  return (
                    <div key={subject.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{subject.name}</span>
                      <button
                        type="button"
                        onClick={togglePerm}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          isOn ? "bg-green-50 border-green-300 text-green-700" : "bg-gray-100 border-gray-300 text-gray-400"
                        }`}
                      >
                        {isOn ? "ON" : "OFF"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1">ON인 과목만 학생 메뉴에 표시됩니다.</p>
            </div>

            <div>
              <Label>메모</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="메모" className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="is_active">재원 중</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1" disabled={saving}>취소</Button>
              <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}