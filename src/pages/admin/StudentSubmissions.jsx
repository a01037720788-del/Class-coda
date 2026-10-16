import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, ChevronDown, ChevronUp, User, Users,
  CheckCircle, XCircle, Clock, Download, Search, LayoutGrid, List
} from "lucide-react";

// ─── 과목 타입별 고정 색상 ─────────────────────────────────────────
const TYPE_COLORS = {
  algorithm: "bg-blue-100 text-blue-700 border-blue-200",
  python:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  cpp:       "bg-indigo-100 text-indigo-700 border-indigo-200",
  html:      "bg-orange-100 text-orange-700 border-orange-200",
  cos:       "bg-purple-100 text-purple-700 border-purple-200",
  entry:     "bg-green-100 text-green-700 border-green-200",
  block:     "bg-pink-100 text-pink-700 border-pink-200",
  other:     "bg-gray-100 text-gray-600 border-gray-200",
};

function typeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.other;
}

// ─── 상태 뱃지 ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === "correct")
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200"><CheckCircle className="w-3 h-3" />맞음</span>;
  if (status === "incorrect")
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200"><XCircle className="w-3 h-3" />틀림</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"><Clock className="w-3 h-3" />미확인</span>;
}

// ─── 개별 제출 행 ─────────────────────────────────────────────────
function SubmissionItem({ sub }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50 cursor-pointer gap-2" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${typeColor(sub.subject_type)}`}>
            {sub.subject_label}
          </span>
          <span className="text-sm text-gray-800 truncate">{sub.title}</span>
          {sub.unit_title && <span className="text-xs text-gray-400 hidden sm:block flex-shrink-0">{sub.unit_title}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={sub.status} />
          <span className="text-[10px] text-gray-400 hidden sm:block">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString("ko-KR") : ""}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </div>
      {open && (
        <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
          {sub.submitted_at && <p>제출 시각: {new Date(sub.submitted_at).toLocaleString("ko-KR")}</p>}
          {sub.grading_message && <p className="text-gray-500">채점 메시지: {sub.grading_message}</p>}
          {sub.admin_comment && <p className="text-blue-600">관리자 코멘트: {sub.admin_comment}</p>}
          {sub.file_url && (
            <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md hover:bg-blue-100">
              <Download className="w-3 h-3" />파일 보기
            </a>
          )}
          {sub.project_url && (
            <a href={sub.project_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-md hover:bg-green-100">
              🔗 작품 링크
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 학생 카드 ─────────────────────────────────────────────────────
function StudentCard({ student, submissions, subjectTypes }) {
  const [open, setOpen] = useState(false);

  const correctCount = submissions.filter(s => s.status === "correct").length;
  const incorrectCount = submissions.filter(s => s.status === "incorrect").length;

  const bySubject = useMemo(() => {
    const map = {};
    submissions.forEach(s => {
      if (!map[s.subject_type]) map[s.subject_type] = [];
      map[s.subject_type].push(s);
    });
    return map;
  }, [submissions]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#7c3aed]/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-[#7c3aed]" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-gray-900">{student.name}</span>
            {student.teacher_names?.length > 0 && (
              <span className="text-xs text-gray-400 ml-2">{student.teacher_names.join(", ")} 선생님</span>
            )}
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">{submissions.length}건</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✓{correctCount}</span>
          <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">✗{incorrectCount}</span>
          {Object.keys(bySubject).slice(0, 3).map(k => (
            <span key={k} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border hidden sm:inline ${typeColor(k)}`}>
              {subjectTypes[k] || k}
            </span>
          ))}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {Object.entries(bySubject).map(([subjType, subs]) => (
            <div key={subjType}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${typeColor(subjType)}`}>
                  {subjectTypes[subjType] || subjType}
                </span>
                <span className="text-xs text-gray-400">{subs.length}건</span>
              </div>
              <div className="space-y-1.5 pl-2">
                {subs.map((s, i) => <SubmissionItem key={i} sub={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 선생님 요약 대시보드 ──────────────────────────────────────────
function TeacherDashboard({ students, allSubs, subjectTypes, subjectList, enrollments }) {
  const [selectedTeacher, setSelectedTeacher] = useState("all");

  const allTeachers = useMemo(() => {
    const names = new Set();
    students.forEach(s => (s.teacher_names || []).forEach(n => names.add(n)));
    return [...names].sort();
  }, [students]);

  // 수강 중인 과목 (enrollment 기반) studentId → Set<subject_type>
  const enrolledSubjectTypes = useMemo(() => {
    const map = {};
    enrollments.forEach(e => {
      if (!map[e.student_id]) map[e.student_id] = new Set();
      // subject_name → type 매핑
      const subj = subjectList.find(s => s.name === e.subject_name || s.id === e.subject_id);
      if (subj?.type) map[e.student_id].add(subj.type);
    });
    return map;
  }, [enrollments, subjectList]);

  // 제출 인덱스: studentId → subject_type → count
  const subIndex = useMemo(() => {
    const map = {};
    allSubs.forEach(s => {
      if (!map[s.student_id]) map[s.student_id] = {};
      map[s.student_id][s.subject_type] = (map[s.student_id][s.subject_type] || 0) + 1;
    });
    return map;
  }, [allSubs]);

  const filteredStudents = useMemo(() =>
    students.filter(s =>
      selectedTeacher === "all" || (s.teacher_names || []).includes(selectedTeacher)
    ), [students, selectedTeacher]);

  // 사용 중인 과목 타입만 (전체 학생의 수강 + 제출 기준)
  const activeTypes = useMemo(() => {
    const types = new Set();
    filteredStudents.forEach(s => {
      (enrolledSubjectTypes[s.id] || new Set()).forEach(t => types.add(t));
      Object.keys(subIndex[s.id] || {}).forEach(t => types.add(t));
    });
    return [...types].filter(t => subjectTypes[t]);
  }, [filteredStudents, enrolledSubjectTypes, subIndex, subjectTypes]);

  return (
    <div className="space-y-5">
      {/* 선생님 탭 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">담당 선생님 선택</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTeacher("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedTeacher === "all" ? "bg-[#7c3aed] text-white border-[#7c3aed]" : "bg-white text-gray-600 border-gray-200 hover:border-[#7c3aed]/40"}`}
          >
            전체 ({students.length}명)
          </button>
          {allTeachers.map(t => {
            const cnt = students.filter(s => (s.teacher_names || []).includes(t)).length;
            return (
              <button key={t}
                onClick={() => setSelectedTeacher(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedTeacher === t ? "bg-[#7c3aed] text-white border-[#7c3aed]" : "bg-white text-gray-600 border-gray-200 hover:border-[#7c3aed]/40"}`}
              >
                {t} ({cnt}명)
              </button>
            );
          })}
        </div>
      </div>

      {/* 요약 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">
            {selectedTeacher === "all" ? "전체 학생" : `${selectedTeacher} 선생님`} 담당 학생 제출 현황
          </h3>
          <span className="text-xs text-gray-400">{filteredStudents.length}명</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs whitespace-nowrap">학생</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs whitespace-nowrap">담당 선생님</th>
                <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-xs whitespace-nowrap">총 제출</th>
                <th className="text-center px-3 py-2.5 font-semibold text-green-600 text-xs whitespace-nowrap">맞음</th>
                <th className="text-center px-3 py-2.5 font-semibold text-red-500 text-xs whitespace-nowrap">틀림</th>
                {activeTypes.map(t => (
                  <th key={t} className="text-center px-3 py-2.5 text-xs whitespace-nowrap">
                    <span className={`font-semibold px-2 py-0.5 rounded border ${typeColor(t)}`}>{subjectTypes[t] || t}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredStudents.map(s => {
                const subs = allSubs.filter(sub => sub.student_id === s.id);
                const correct = subs.filter(sub => sub.status === "correct").length;
                const incorrect = subs.filter(sub => sub.status === "incorrect").length;
                const enrolled = enrolledSubjectTypes[s.id] || new Set();
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{s.name}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{(s.teacher_names || []).join(", ") || "-"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-sm font-bold text-gray-700">{subs.length}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {correct > 0 ? <span className="text-sm font-bold text-green-600">{correct}</span> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {incorrect > 0 ? <span className="text-sm font-bold text-red-500">{incorrect}</span> : <span className="text-gray-300">-</span>}
                    </td>
                    {activeTypes.map(t => {
                      const cnt = (subIndex[s.id] || {})[t] || 0;
                      const isEnrolled = enrolled.has(t);
                      return (
                        <td key={t} className="px-3 py-2.5 text-center">
                          {cnt > 0 ? (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${typeColor(t)}`}>{cnt}</span>
                          ) : isEnrolled ? (
                            <span className="text-xs text-gray-400">수강중</span>
                          ) : (
                            <span className="text-gray-200 text-xs">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr><td colSpan={5 + activeTypes.length} className="px-4 py-10 text-center text-gray-400 text-sm">학생이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────
export default function StudentSubmissions() {
  const [students, setStudents] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("list"); // "list" | "dashboard"

  // list 탭 필터
  const [search, setSearch] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [
      studs, subjects, enrolls,
      pythonSubs, cppSubs, htmlSubs, cosSubs, entrySubs,
      htmlUnits, cosProblems, pythonUnits, cppUnits,
    ] = await Promise.all([
      base44.entities.Student.filter({ is_active: true }, "name"),
      base44.entities.Subject.list("name"),
      base44.entities.Enrollment.list("-created_date", 2000),
      base44.entities.UnitMissionSubmission.list("-submitted_at", 2000),
      base44.entities.CppMissionSubmission.list("-submitted_at", 2000),
      base44.entities.HTMLMissionSubmission.list("-submitted_at", 2000),
      base44.entities.COSSubmission.list("-submitted_at", 2000),
      base44.entities.EntrySubmission.list("-submitted_at", 2000),
      base44.entities.HTMLUnit.list("unit_number", 100),
      base44.entities.COSProblem.list("-created_date", 500),
      base44.entities.PythonUnit.list("unit_number", 100),
      base44.entities.CppUnit.list("unit_number", 100),
    ]);

    const htmlUnitMap = {};
    htmlUnits.forEach(u => { htmlUnitMap[u.id] = u; });
    const cosProbMap = {};
    cosProblems.forEach(p => { cosProbMap[p.id] = p; });
    const pythonUnitMap = {};
    pythonUnits.forEach(u => { pythonUnitMap[u.id] = u; });
    const cppUnitMap = {};
    cppUnits.forEach(u => { cppUnitMap[u.id] = u; });

    const typeLabels = {
      algorithm: "알고리즘", python: "Python", cpp: "C++", html: "HTML",
      cos: "COS", entry: "엔트리", block: "블록코딩", other: "기타",
    };
    subjects.forEach(s => {
      if (s.type && s.name) typeLabels[s.type] = s.name;
    });

    const raw = [];

    // Python 미션 (UnitMissionSubmission)
    pythonSubs.forEach(s => {
      const unit = pythonUnitMap[s.unit_id];
      raw.push({
        _dedup_key: `${s.student_id}|python|${s.unit_id}|${s.mission_number}`,
        subject_type: "python", subject_label: typeLabels.python,
        title: s.mission_description || (unit ? `${unit.title} - 미션 ${s.mission_number}` : `미션 ${s.mission_number}`),
        unit_title: s.unit_title || unit?.title || "",
        status: s.is_correct === true ? "correct" : s.is_correct === false ? "incorrect" : null,
        submitted_at: s.submitted_at || s.created_date, file_url: null,
        grading_message: s.execution_result || "", admin_comment: "",
        student_id: s.student_id, student_name: s.student_name,
      });
    });

    // C++ 미션 (CppMissionSubmission)
    cppSubs.forEach(s => {
      const unit = cppUnitMap[s.unit_id];
      raw.push({
        _dedup_key: `${s.student_id}|cpp|${s.unit_id}|${s.mission_number}`,
        subject_type: "cpp", subject_label: typeLabels.cpp,
        title: s.mission_description || (unit ? `${unit.title} - 미션 ${s.mission_number}` : `미션 ${s.mission_number}`),
        unit_title: s.unit_title || unit?.title || "",
        status: s.is_correct === true ? "correct" : s.is_correct === false ? "incorrect" : null,
        submitted_at: s.submitted_at || s.created_date, file_url: null,
        grading_message: s.execution_result || "", admin_comment: "",
        student_id: s.student_id, student_name: s.student_name,
      });
    });

    // HTML 미션
    htmlSubs.forEach(s => {
      raw.push({
        _dedup_key: `${s.student_id}|html|${s.unit_id}|${s.mission_number}`,
        subject_type: "html", subject_label: typeLabels.html,
        title: s.mission_title || `미션 ${s.mission_number}`,
        unit_title: s.unit_title || htmlUnitMap[s.unit_id]?.title || "",
        status: s.is_completed ? "correct" : "incorrect",
        submitted_at: s.submitted_at || s.updated_at || s.created_date,
        file_url: null, grading_message: "", admin_comment: "",
        student_id: s.student_id, student_name: s.student_name,
      });
    });

    // COS
    cosSubs.forEach(s => {
      const res = s.grading_result;
      const status = res?.status === "correct" ? "correct"
        : res?.status === "incorrect" ? "incorrect"
        : s.is_correct === true ? "correct"
        : s.is_correct === false ? "incorrect" : null;
      raw.push({
        _dedup_key: `${s.student_id}|cos|${s.problem_id}`,
        subject_type: "cos", subject_label: typeLabels.cos,
        title: s.problem_title || cosProbMap[s.problem_id]?.title || s.problem_id,
        unit_title: "", status,
        submitted_at: s.submitted_at || s.created_date,
        file_url: s.submitted_file_url || null,
        grading_message: res?.message || "", admin_comment: res?.admin_comment || "",
        student_id: s.student_id, student_name: s.student_name,
      });
    });

    // 엔트리
    entrySubs.forEach(s => {
      raw.push({
        _dedup_key: `${s.student_id}|entry|${s.unit_id}|${s.mission_number}`,
        subject_type: "entry", subject_label: typeLabels.entry,
        title: s.mission_title || `미션 ${s.mission_number}`,
        unit_title: s.unit_title || "",
        status: s.is_checked ? "correct" : null,
        submitted_at: s.submitted_at || s.created_date,
        file_url: s.file_url || null,
        project_url: s.project_url || null,
        grading_message: s.description || "", admin_comment: "",
        student_id: s.student_id, student_name: s.student_name,
      });
    });

    // ── 중복 제거: 같은 dedup_key는 최신 제출 1건만 유지 ──
    const seen = new Set();
    const normalized = raw.filter(s => {
      if (seen.has(s._dedup_key)) return false;
      seen.add(s._dedup_key);
      return true;
    });

    setStudents(studs);
    setSubjectList(subjects);
    setEnrollments(enrolls);
    setAllSubs(normalized);
    setLoading(false);
  };

  // 동적 과목 타입 라벨 맵
  const subjectTypes = useMemo(() => {
    const map = { algorithm: "알고리즘", python: "Python", html: "HTML", cos: "COS", entry: "엔트리", block: "블록코딩", other: "기타" };
    subjectList.forEach(s => { if (s.type && s.name) map[s.type] = s.name; });
    return map;
  }, [subjectList]);

  // 실제 제출에 존재하는 과목 타입들
  const activeSubjectTypes = useMemo(() => {
    const types = new Set(allSubs.map(s => s.subject_type));
    return [...types].filter(t => subjectTypes[t]);
  }, [allSubs, subjectTypes]);

  const allTeachers = useMemo(() => {
    const names = new Set();
    students.forEach(s => (s.teacher_names || []).forEach(n => names.add(n)));
    return [...names].sort();
  }, [students]);

  // 학생 목록 + 제출 그룹
  const studentGroups = useMemo(() => {
    return students
      .filter(s => {
        if (search && !s.name.includes(search)) return false;
        if (filterTeacher !== "all" && !(s.teacher_names || []).includes(filterTeacher)) return false;
        return true;
      })
      .map(s => {
        let subs = allSubs.filter(sub => sub.student_id === s.id);
        if (filterSubject !== "all") subs = subs.filter(sub => sub.subject_type === filterSubject);
        if (filterStatus !== "all") subs = subs.filter(sub =>
          filterStatus === "correct" ? sub.status === "correct"
          : filterStatus === "incorrect" ? sub.status === "incorrect"
          : sub.status == null
        );
        return { student: s, submissions: subs };
      })
      .filter(g => g.submissions.length > 0);
  }, [students, allSubs, search, filterTeacher, filterSubject, filterStatus]);

  const totalSubs = studentGroups.reduce((acc, g) => acc + g.submissions.length, 0);
  const totalCorrect = studentGroups.reduce((acc, g) => acc + g.submissions.filter(s => s.status === "correct").length, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">제출 현황</h2>
          <p className="text-gray-500 text-sm">모든 과목의 제출을 학생별·선생님별로 확인합니다.</p>
        </div>
        <Button size="sm" variant="outline" onClick={loadAll} className="gap-1.5 text-xs h-8">
          <RefreshCw className="w-3.5 h-3.5" />새로고침
        </Button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
        <button onClick={() => setTab("list")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          <List className="w-3.5 h-3.5" />학생별 제출 목록
        </button>
        <button onClick={() => setTab("dashboard")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === "dashboard" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          <LayoutGrid className="w-3.5 h-3.5" />선생님별 요약
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">불러오는 중...</div>
      ) : tab === "list" ? (
        <>
          {/* ── 필터 바 ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input placeholder="학생 이름" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs pl-8 w-32" />
            </div>
            <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
              className="h-8 rounded-md border border-input bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="all">선생님 전체</option>
              {allTeachers.map(t => <option key={t} value={t}>{t} 선생님</option>)}
            </select>
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              className="h-8 rounded-md border border-input bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="all">과목 전체</option>
              {activeSubjectTypes.map(t => <option key={t} value={t}>{subjectTypes[t]}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="h-8 rounded-md border border-input bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="all">상태 전체</option>
              <option value="correct">맞음</option>
              <option value="incorrect">틀림</option>
              <option value="null">미확인</option>
            </select>
            {(search || filterTeacher !== "all" || filterSubject !== "all" || filterStatus !== "all") && (
              <button onClick={() => { setSearch(""); setFilterTeacher("all"); setFilterSubject("all"); setFilterStatus("all"); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline">초기화</button>
            )}
          </div>

          {/* ── 요약 수치 ── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-[#7c3aed]/5 border border-[#7c3aed]/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-[#7c3aed]">{studentGroups.length}</p>
              <p className="text-xs text-gray-500">학생 수</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{totalSubs}</p>
              <p className="text-xs text-gray-500">총 제출</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-600">{totalCorrect}</p>
              <p className="text-xs text-gray-500">정답</p>
            </div>
          </div>

          {studentGroups.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">
              해당하는 제출이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {studentGroups.map(({ student, submissions }) => (
                <StudentCard key={student.id} student={student} submissions={submissions} subjectTypes={subjectTypes} />
              ))}
            </div>
          )}
        </>
      ) : (
        <TeacherDashboard
          students={students}
          allSubs={allSubs}
          subjectTypes={subjectTypes}
          subjectList={subjectList}
          enrollments={enrollments}
        />
      )}
    </div>
  );
}