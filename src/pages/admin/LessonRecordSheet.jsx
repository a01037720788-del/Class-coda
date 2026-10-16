import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, X, CheckCircle,
  Bell, Printer, RefreshCw
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

const ATTENDANCE_OPTIONS = ["출석", "결석", "지각", "보강 예정", "취소"];
const COUNT_STATUSES = ["출석", "지각"];

const ATTENDANCE_COLORS = {
  "출석":    { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300"   },
  "지각":    { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
  "결석":    { bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300"    },
  "취소":    { bg: "bg-gray-100",   text: "text-gray-500",   border: "border-gray-300"   },
  "보강 예정":{ bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
};

const TEACHER_PALETTE = [
  "#3b82f6","#f97316","#10b981","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f59e0b",
];

const DAY_KO = ["일","월","화","수","목","금","토"];

function teacherColor(name, teacherColorMap) {
  return teacherColorMap[name] || "#6b7280";
}

// ── 피드백 모달 ─────────────────────────────────────────────────────────────
function FeedbackModal({ cell, onClose, onSaved, user }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    attendance_status: cell.feedback?.attendance_status || cell.attendance || "출석",
    learned_content: cell.feedback?.learned_content || "",
    homework: cell.feedback?.homework || "",
    next_plan: cell.feedback?.next_plan || "",
    parent_memo: cell.feedback?.parent_memo || "",
  });
  const [saving, setSaving] = useState(false);
  const [shouldNotify, setShouldNotify] = useState(true);

  const handleSave = async () => {
    setSaving(true);
    const saveData = {
      ...form,
      student_id: cell.studentId,
      student_name: cell.studentName,
      subject_name: cell.subjectName,
      teacher_id: user?.id,
      teacher_name: user?.name,
      schedule_id: cell.scheduleId,
      class_date: cell.classDate,
      is_completed: true,
    };
    if (cell.feedback?.id) {
      await base44.entities.LessonFeedback.update(cell.feedback.id, saveData);
    } else {
      await base44.entities.LessonFeedback.create(saveData);
    }
    if (shouldNotify) {
      base44.functions.invoke("sendFeedbackNotification", {
        studentId: cell.studentId, studentName: cell.studentName,
        subjectName: cell.subjectName, classDate: cell.classDate,
        teacherName: user?.name, attendanceStatus: form.attendance_status,
        learnedContent: form.learned_content, homework: form.homework,
        parentMemo: form.parent_memo, notifyChannels: { inApp: true },
      });
    }
    toast({ title: "저장 완료" });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">{cell.studentName}</p>
            <p className="text-xs text-gray-500">
              {cell.classDate && format(parseISO(cell.classDate), "yyyy년 M월 d일 (eee)", { locale: ko })} ·
              {cell.subjectName} · {cell.teacherName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* 출석 상태 */}
          <div>
            <Label className="text-xs font-semibold text-gray-700">출석 상태</Label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {ATTENDANCE_OPTIONS.map(opt => {
                const c = ATTENDANCE_COLORS[opt] || {};
                const sel = form.attendance_status === opt;
                return (
                  <button key={opt} onClick={() => setForm(f => ({ ...f, attendance_status: opt }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${sel ? `${c.bg} ${c.text} ${c.border}` : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          {COUNT_STATUSES.includes(form.attendance_status) && (
            <>
              <div>
                <Label className="text-xs font-semibold text-gray-700">오늘 배운 내용</Label>
                <Textarea value={form.learned_content} onChange={e => setForm(f => ({...f, learned_content: e.target.value}))}
                  placeholder="수업 내용 입력..." className="mt-1 text-sm h-20 resize-none" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">숙제</Label>
                <Textarea value={form.homework} onChange={e => setForm(f => ({...f, homework: e.target.value}))}
                  placeholder="숙제 입력..." className="mt-1 text-sm h-14 resize-none" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">다음 수업 계획</Label>
                <Textarea value={form.next_plan} onChange={e => setForm(f => ({...f, next_plan: e.target.value}))}
                  placeholder="다음 수업 계획..." className="mt-1 text-sm h-14 resize-none" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-amber-700">학부모 전달 메모 <span className="text-gray-400 font-normal">(선택)</span></Label>
                <Textarea value={form.parent_memo} onChange={e => setForm(f => ({...f, parent_memo: e.target.value}))}
                  placeholder="학부모 전달 메모..." className="mt-1 text-sm h-14 resize-none border-amber-200 bg-amber-50" />
              </div>
            </>
          )}
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <input type="checkbox" id="notify-modal" checked={shouldNotify} onChange={e => setShouldNotify(e.target.checked)} className="w-4 h-4 accent-amber-500" />
            <label htmlFor="notify-modal" className="text-sm text-amber-800 flex items-center gap-1.5 cursor-pointer">
              <Bell className="w-4 h-4" />저장 시 알림 전송
            </label>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
            {saving ? "저장 중..." : cell.feedback?.id ? "수정 저장" : "신규 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── 셀 상세 보기 모달 ─────────────────────────────────────────────────────────
function DetailModal({ cell, onClose, onEdit }) {
  const c = cell.attendance ? ATTENDANCE_COLORS[cell.attendance] || {} : {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">{cell.studentName} — {cell.lessonNum}차시</p>
            <p className="text-xs text-gray-500">
              {cell.classDate && format(parseISO(cell.classDate), "yyyy년 M월 d일 (eee)", { locale: ko })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">과목</span>
            <span className="text-sm font-medium">{cell.subjectName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">선생님</span>
            <span className="text-sm font-medium">{cell.teacherName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">출석</span>
            {cell.attendance ? (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{cell.attendance}</span>
            ) : <span className="text-xs text-gray-400">미기록</span>}
          </div>
          {cell.feedback ? (
            <>
              {cell.feedback.learned_content && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">배운 내용</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-2 whitespace-pre-wrap">{cell.feedback.learned_content}</p>
                </div>
              )}
              {cell.feedback.homework && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">숙제</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-2">{cell.feedback.homework}</p>
                </div>
              )}
              {cell.feedback.next_plan && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">다음 계획</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-2">{cell.feedback.next_plan}</p>
                </div>
              )}
              {cell.feedback.parent_memo && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">학부모 메모</p>
                  <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-2">{cell.feedback.parent_memo}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">피드백이 없습니다.</p>
          )}
          <Button onClick={onEdit} className="w-full bg-blue-600 hover:bg-blue-700">
            {cell.feedback ? "피드백 수정" : "피드백 작성"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function LessonRecordSheet() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // raw data
  const [students, setStudents] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [cssRecords, setCssRecords] = useState([]); // ClassScheduleStudent
  const [feedbacks, setFeedbacks] = useState([]);
  const [enrollments, setEnrollments] = useState([]);

  // filters
  const [searchName, setSearchName] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterSchool, setFilterSchool] = useState("all");
  const [filterRepayment, setFilterRepayment] = useState(false);
  const [sortBy, setSortBy] = useState("name"); // name | recent | remaining

  // modal
  const [detailCell, setDetailCell] = useState(null);
  const [feedbackCell, setFeedbackCell] = useState(null);

  // teacher colors
  const [teacherColorMap, setTeacherColorMap] = useState({});

  useEffect(() => {
    setUser(getSessionUser());
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [studs, scheds, cssList, fbs, enrols] = await Promise.all([
      base44.entities.Student.list("name", 500),
      base44.entities.ClassSchedule.list("class_date", 2000),
      base44.entities.ClassScheduleStudent.list("-created_date", 5000),
      base44.entities.LessonFeedback.list("-class_date", 5000),
      base44.entities.Enrollment.list("-created_date", 2000),
    ]);
    setStudents(studs.filter(s => s.is_active !== false));
    setSchedules(scheds);
    setCssRecords(cssList.filter(c => !c.is_deleted));
    setFeedbacks(fbs.filter(f => !f.is_deleted));
    setEnrollments(enrols);

    // auto-assign teacher colors
    const teachers = [...new Set(scheds.map(s => s.teacher_name).filter(Boolean))];
    const colorMap = {};
    teachers.forEach((t, i) => { colorMap[t] = TEACHER_PALETTE[i % TEACHER_PALETTE.length]; });
    setTeacherColorMap(colorMap);

    setLoading(false);
  };

  // ── 학생별 수업 기록 계산 ─────────────────────────────────────────────────
  const studentRows = useMemo(() => {
    // scheduleId → schedule
    const schedMap = {};
    schedules.forEach(s => { schedMap[s.id] = s; });

    // feedbackKey: studentId_scheduleId → feedback
    const fbMap = {};
    feedbacks.forEach(f => { fbMap[`${f.student_id}_${f.schedule_id}`] = f; });

    // enrollmentKey: studentId_subjectName → enrollment
    const enrolMap = {};
    enrollments.forEach(e => { enrolMap[`${e.student_id}_${e.subject_name}`] = e; });

    // group cssRecords by student
    const byStudent = {};
    cssRecords.forEach(css => {
      if (!byStudent[css.student_id]) byStudent[css.student_id] = [];
      byStudent[css.student_id].push(css);
    });

    return students.map((student, idx) => {
      const recs = byStudent[student.id] || [];

      // group by subject
      const bySubject = {};
      recs.forEach(css => {
        const sched = schedMap[css.schedule_id];
        if (!sched) return;
        const subj = sched.subject_name || "미지정";
        if (!bySubject[subj]) bySubject[subj] = [];
        bySubject[subj].push({ css, sched });
      });

      // build per-subject lesson lists
      const subjectEntries = Object.entries(bySubject).map(([subj, items]) => {
        // sort by class_date
        items.sort((a, b) => (a.sched.class_date || "") < (b.sched.class_date || "") ? -1 : 1);

        // assign lesson numbers (only counting statuses)
        let lessonNum = 0;
        const lessons = items.map(({ css, sched }) => {
          const att = css.attendance_status;
          const counts = COUNT_STATUSES.includes(att);
          if (counts) lessonNum++;
          const fb = fbMap[`${student.id}_${sched.id}`] || null;
          return {
            studentId: student.id,
            studentName: student.name,
            scheduleId: sched.id,
            subjectName: subj,
            teacherName: sched.teacher_name || "",
            classDate: sched.class_date || "",
            attendance: att,
            counts,
            lessonNum: counts ? lessonNum : null, // null for non-counting
            feedback: fb,
            hasFeedback: !!fb,
          };
        });

        const enrollment = enrolMap[`${student.id}_${subj}`];
        const teacher = items[0]?.sched?.teacher_name || "";

        return {
          subject: subj,
          teacher,
          lessons,
          enrollment,
          countedLessons: lessonNum,
        };
      });

      return {
        idx: idx + 1,
        student,
        subjectEntries,
        lastDate: recs.length > 0
          ? Math.max(...recs.map(r => schedMap[r.schedule_id]?.class_date || "").filter(Boolean).map(d => new Date(d).getTime()))
          : 0,
      };
    });
  }, [students, schedules, cssRecords, feedbacks, enrollments]);

  // ── 필터 적용 ─────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = studentRows;
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      rows = rows.filter(r => r.student.name.toLowerCase().includes(q)
        || (r.student.school_name || "").toLowerCase().includes(q));
    }
    if (filterTeacher !== "all") {
      rows = rows.filter(r => r.subjectEntries.some(e => e.teacher === filterTeacher));
    }
    if (filterSubject !== "all") {
      rows = rows.filter(r => r.subjectEntries.some(e => e.subject === filterSubject));
    }
    if (filterSchool !== "all") {
      rows = rows.filter(r => (r.student.school_name || "") === filterSchool);
    }
    if (filterRepayment) {
      rows = rows.filter(r => r.subjectEntries.some(e => e.enrollment?.repayment_needed));
    }

    // sort
    if (sortBy === "name") {
      rows = [...rows].sort((a, b) => a.student.name.localeCompare(b.student.name, "ko"));
    } else if (sortBy === "recent") {
      rows = [...rows].sort((a, b) => b.lastDate - a.lastDate);
    } else if (sortBy === "remaining") {
      const minRemaining = r => Math.min(...r.subjectEntries.map(e => e.enrollment?.remaining_lessons ?? 999));
      rows = [...rows].sort((a, b) => minRemaining(a) - minRemaining(b));
    }
    return rows;
  }, [studentRows, searchName, filterTeacher, filterSubject, filterSchool, filterRepayment, sortBy]);

  // ── option lists ──────────────────────────────────────────────────────────
  const allTeachers = useMemo(() => [...new Set(schedules.map(s => s.teacher_name).filter(Boolean))], [schedules]);
  const allSubjects = useMemo(() => [...new Set(schedules.map(s => s.subject_name).filter(Boolean))], [schedules]);
  const allSchools  = useMemo(() => [...new Set(students.map(s => s.school_name).filter(Boolean))], [students]);

  // max lessons per row (for column count)
  const maxLessons = useMemo(() => {
    let m = 10;
    filteredRows.forEach(r => {
      r.subjectEntries.forEach(e => {
        if (e.lessons.length > m) m = e.lessons.length;
      });
    });
    return Math.max(m, 15);
  }, [filteredRows]);

  const colNums = Array.from({ length: maxLessons }, (_, i) => i + 1);

  const handleCellClick = (cell) => {
    setDetailCell(cell);
  };

  const openFeedback = (cell) => {
    setDetailCell(null);
    setFeedbackCell(cell);
  };

  const handleFeedbackSaved = () => {
    setFeedbackCell(null);
    loadAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />불러오는 중...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">수업 기록표</h2>
            <p className="text-xs text-gray-400">학생별 차시별 수업 기록 (엑셀 형태)</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={loadAll} className="p-2 hover:bg-gray-100 rounded-lg" title="새로고침">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
              <Printer className="w-3.5 h-3.5" />인쇄
            </button>
          </div>
        </div>

        {/* 검색 + 필터 */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={searchName} onChange={e => setSearchName(e.target.value)}
              placeholder="학생/학교 검색..." className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
            <option value="all">선생님 전체</option>
            {allTeachers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
            <option value="all">과목 전체</option>
            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
            <option value="all">학교 전체</option>
            {allSchools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
            <option value="name">이름순</option>
            <option value="recent">최신 수업순</option>
            <option value="remaining">남은 차시 적은순</option>
          </select>
          <button
            onClick={() => setFilterRepayment(s => !s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterRepayment ? "bg-red-100 text-red-700 border-red-300" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            재결제 필요만
          </button>
        </div>

        {/* 범례 */}
        <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-gray-500">
          {Object.entries(ATTENDANCE_COLORS).map(([k, v]) => (
            <span key={k} className={`px-2 py-0.5 rounded-full ${v.bg} ${v.text}`}>{k}</span>
          ))}
          <span className="ml-1">·</span>
          <span className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-300 inline-block" /> 피드백 완료
          <span className="w-3 h-3 rounded-sm bg-red-50 border border-red-300 inline-block" /> 피드백 미작성
        </div>
      </div>

      {/* 표 영역 — 틀 고정 스크롤 */}
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-auto">
          {filteredRows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <p>조건에 맞는 학생이 없습니다.</p>
            </div>
          ) : (
            <table className="border-collapse text-xs" style={{ minWidth: `${280 + maxLessons * 130}px` }}>
              {/* 헤더 */}
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  {/* 고정 컬럼 헤더 */}
                  <th className="sticky left-0 z-20 bg-gray-100 border border-gray-300 px-2 py-2 text-center font-semibold text-gray-600 w-8">#</th>
                  <th className="sticky left-8 z-20 bg-gray-100 border border-gray-300 px-2 py-2 text-left font-semibold text-gray-600 w-20">이름</th>
                  <th className="sticky left-28 z-20 bg-gray-100 border border-gray-300 px-2 py-2 text-left font-semibold text-gray-600 w-20">학교</th>
                  <th className="sticky left-48 z-20 bg-gray-100 border border-gray-300 px-2 py-2 text-left font-semibold text-gray-600 w-14">학년</th>
                  <th className="sticky left-[248px] z-20 bg-gray-100 border border-gray-300 px-2 py-2 text-left font-semibold text-gray-600 w-16">과목</th>
                  <th className="sticky left-[312px] z-20 bg-gray-100 border border-gray-300 px-2 py-2 text-left font-semibold text-gray-600 w-20 min-w-[80px]">선생님</th>
                  {/* 차시 헤더 */}
                  {colNums.map(n => (
                    <th key={n} className="border border-gray-300 px-1 py-2 text-center font-semibold text-gray-600 w-32 min-w-[120px]">
                      {n}차시
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, ri) => {
                  const { student, subjectEntries, idx } = row;
                  const rowSpan = Math.max(subjectEntries.length, 1);

                  if (subjectEntries.length === 0) {
                    return (
                      <tr key={student.id} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="sticky left-0 z-10 bg-inherit border border-gray-200 px-2 py-2 text-center text-gray-400">{idx}</td>
                        <td className="sticky left-8 z-10 bg-inherit border border-gray-200 px-2 py-2 font-semibold text-gray-900">{student.name}</td>
                        <td className="sticky left-28 z-10 bg-inherit border border-gray-200 px-2 py-2 text-gray-500">{student.school_name || ""}</td>
                        <td className="sticky left-48 z-10 bg-inherit border border-gray-200 px-2 py-2 text-gray-500">{student.grade || ""}</td>
                        <td className="sticky left-[248px] z-10 bg-inherit border border-gray-200 px-2 py-2 text-gray-400">-</td>
                        <td className="sticky left-[312px] z-10 bg-inherit border border-gray-200 px-2 py-2 text-gray-400">-</td>
                        {colNums.map(n => (
                          <td key={n} className="border border-gray-100 px-1 py-1 bg-gray-50/30" />
                        ))}
                      </tr>
                    );
                  }

                  return subjectEntries.map((entry, si) => {
                    const tColor = teacherColor(entry.teacher, teacherColorMap);
                    const bgRow = ri % 2 === 0 ? "bg-white" : "bg-gray-50/50";

                    return (
                      <tr key={`${student.id}_${entry.subject}`} className={bgRow}>
                        {/* 고정 컬럼 — 첫 과목 행에만 rowSpan */}
                        {si === 0 && (
                          <>
                            <td rowSpan={rowSpan} className="sticky left-0 z-10 bg-inherit border border-gray-200 px-2 py-2 text-center text-gray-400 font-medium align-middle">{idx}</td>
                            <td rowSpan={rowSpan} className="sticky left-8 z-10 bg-inherit border border-gray-200 px-2 py-2 font-bold text-gray-900 align-middle">{student.name}</td>
                            <td rowSpan={rowSpan} className="sticky left-28 z-10 bg-inherit border border-gray-200 px-2 py-2 text-gray-600 align-middle text-[11px]">{student.school_name || ""}</td>
                            <td rowSpan={rowSpan} className="sticky left-48 z-10 bg-inherit border border-gray-200 px-2 py-2 text-gray-600 align-middle">{student.grade || ""}</td>
                          </>
                        )}
                        {/* 과목 + 선생님 */}
                        <td className="sticky left-[248px] z-10 bg-inherit border border-gray-200 px-2 py-1.5">
                          <span className="font-semibold text-gray-800">{entry.subject}</span>
                          {entry.enrollment && (
                            <div className={`text-[10px] mt-0.5 ${entry.enrollment.repayment_needed ? "text-red-500 font-bold" : "text-gray-400"}`}>
                              {entry.enrollment.remaining_lessons ?? "-"}차시 남음
                            </div>
                          )}
                        </td>
                        <td className="sticky left-[312px] z-10 bg-inherit border border-gray-200 px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tColor }} />
                            <span className="text-[11px] text-gray-700">{entry.teacher}</span>
                          </div>
                        </td>
                        {/* 차시 셀 */}
                        {colNums.map(n => {
                          // find lesson at position n-1 in ALL lessons (including non-counting)
                          // but show n-th lesson by all order
                          const lesson = entry.lessons[n - 1];
                          if (!lesson) {
                            return <td key={n} className="border border-gray-100 px-1 py-1 bg-gray-50/20 min-w-[120px]" />;
                          }

                          const att = lesson.attendance;
                          const attColor = ATTENDANCE_COLORS[att] || {};
                          const hasFb = lesson.hasFeedback;
                          const cellBg = hasFb ? "bg-blue-50" : att && COUNT_STATUSES.includes(att) ? "bg-red-50" : "";
                          const borderColor = hasFb ? "border-blue-200" : att && COUNT_STATUSES.includes(att) ? "border-red-200" : "border-gray-100";

                          return (
                            <td key={n}
                              className={`border ${borderColor} px-1 py-1 cursor-pointer hover:brightness-95 transition-all min-w-[120px] ${cellBg}`}
                              onClick={() => handleCellClick(lesson)}>
                              <div className="space-y-0.5">
                                {/* 날짜 + 차시 번호 */}
                                <div className="flex items-center justify-between gap-1">
                                  {lesson.classDate && (() => {
                                    const d = parseISO(lesson.classDate);
                                    const dayIdx = d.getDay();
                                    return (
                                      <div className="text-[10px] text-gray-600 font-medium leading-tight">
                                        {format(d, "M/d")} ({DAY_KO[dayIdx]})
                                      </div>
                                    );
                                  })()}
                                  {lesson.lessonNum && (
                                    <span className="text-[9px] font-bold text-white bg-gray-500 px-1 py-0.5 rounded-sm leading-tight flex-shrink-0">
                                      {lesson.lessonNum}차
                                    </span>
                                  )}
                                </div>
                                {/* 출석 뱃지 */}
                                {att && (
                                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-sm font-bold border ${attColor.bg} ${attColor.text} ${attColor.border}`}>
                                    {att}
                                  </span>
                                )}
                                {/* 수업 내용 */}
                                {lesson.feedback?.learned_content && (
                                  <div className="text-[10px] text-gray-800 leading-tight line-clamp-2 font-medium">
                                    {lesson.feedback.learned_content}
                                  </div>
                                )}
                                {/* 피드백 여부 */}
                                <div className={`text-[9px] font-semibold ${hasFb ? "text-blue-600" : att && COUNT_STATUSES.includes(att) ? "text-red-500" : "text-gray-400"}`}>
                                  {hasFb ? "✓ 피드백" : att && COUNT_STATUSES.includes(att) ? "미작성" : ""}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 모달 */}
      {detailCell && (
        <DetailModal
          cell={detailCell}
          onClose={() => setDetailCell(null)}
          onEdit={() => openFeedback(detailCell)}
        />
      )}
      {feedbackCell && (
        <FeedbackModal
          cell={feedbackCell}
          user={user}
          onClose={() => setFeedbackCell(null)}
          onSaved={handleFeedbackSaved}
        />
      )}
    </div>
  );
}