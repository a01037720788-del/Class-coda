import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser, isSuperAdmin, getSessionToken } from "@/lib/auth";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Users, BookOpen, CheckCircle, XCircle, Clock, FileText, TrendingUp, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval } from "date-fns";

const PERIODS = ["weekly", "monthly", "yearly"];
const PERIOD_LABELS = { weekly: "주간", monthly: "월간", yearly: "연간" };

export default function TeacherStats() {
  const [user, setUser] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [cssRecords, setCssRecords] = useState([]); // ClassScheduleStudent
  const [schedules, setSchedules] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const [selectedTeacher, setSelectedTeacher] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    if (!isSuperAdmin(u)) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getTeacherStatsData", {
        session_token: getSessionToken(),
        caller_login_id: getSessionUser()?.login_id,
      });
      const data = res?.data || res;
      setTeachers(data.teachers || []);
      setSchedules(data.schedules || []);
      setEnrollments(data.enrollments || []);
      setCssRecords(data.cssRecords || []);
    } catch {
      setTeachers([]);
      setSchedules([]);
      setEnrollments([]);
      setCssRecords([]);
    }
    setLoading(false);
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "weekly") return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    if (period === "monthly") return { start: startOfMonth(now), end: endOfMonth(now) };
    return { start: startOfYear(now), end: endOfYear(now) };
  }, [period]);

  const inRange = useCallback((dateStr) => {
    if (!dateStr) return false;
    try { return isWithinInterval(parseISO(dateStr), dateRange); } catch { return false; }
  }, [dateRange]);

  const filteredTeachers = useMemo(() =>
    selectedTeacher === "all" ? teachers : teachers.filter(t => t.id === selectedTeacher),
  [teachers, selectedTeacher]);

  // 선생님별 통계: ClassScheduleStudent 기준
  const teacherStatsMap = useMemo(() => {
    const map = {};
    // schedule_id -> schedule 맵
    const schedMap = {};
    schedules.forEach(s => { schedMap[s.id] = s; });

    teachers.forEach(teacher => {
      // 해당 선생님의 수업 (기간 내)
      const mySchedules = schedules.filter(s =>
        s.teacher_id === teacher.id && inRange(s.class_date)
      );
      const myScheduleIds = new Set(mySchedules.map(s => s.id));

      // 해당 선생님 + 기간 내 + is_deleted 아닌 CSS 레코드
      const myCss = cssRecords.filter(c => {
        const sched = schedMap[c.schedule_id];
        return sched && sched.teacher_id === teacher.id && inRange(sched.class_date) && !c.is_deleted;
      });

      const attended = myCss.filter(c => c.attendance_status === "출석").length;
      const absent = myCss.filter(c => c.attendance_status === "결석").length;
      const tardy = myCss.filter(c => c.attendance_status === "지각").length;
      const makeup = myCss.filter(c => c.attendance_status === "보강 예정").length;
      const cancelled = myCss.filter(c => c.attendance_status === "취소").length;
      const feedbackDone = myCss.filter(c => c.feedback_completed).length;
      const feedbackPending = myCss.length - feedbackDone;
      const completedLessons = myCss.filter(c => c.lesson_count_applied).length;

      const myEnrollments = enrollments.filter(e => e.teacher_id === teacher.id);
      const lowRemaining = myEnrollments.filter(e => (e.remaining_lessons ?? (e.paid_lessons || 0) - (e.completed_lessons || 0)) <= 3);

      map[teacher.id] = {
        totalClasses: mySchedules.length,
        attended,
        absent,
        tardy,
        makeup,
        cancelled,
        feedbackDone,
        feedbackPending,
        completedLessons,
        studentCount: myEnrollments.length,
        lowRemainingCount: lowRemaining.length,
        cssCount: myCss.length,
      };
    });
    return map;
  }, [teachers, schedules, cssRecords, enrollments, inRange]);

  const getTeacherStats = useCallback((teacher) => teacherStatsMap[teacher.id] || {}, [teacherStatsMap]);

  // 연간 월별 차트 데이터 (CSS 기준)
  const monthlyDataMap = useMemo(() => {
    if (period !== "yearly") return {};
    const currentYear = new Date().getFullYear();
    const schedMap = {};
    schedules.forEach(s => { schedMap[s.id] = s; });

    const map = {};
    teachers.forEach(teacher => {
      map[teacher.id] = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthCss = cssRecords.filter(c => {
          const sched = schedMap[c.schedule_id];
          if (!sched || sched.teacher_id !== teacher.id || !sched.class_date || c.is_deleted) return false;
          const d = parseISO(sched.class_date);
          return d.getFullYear() === currentYear && d.getMonth() + 1 === month;
        });
        const total = monthCss.length;
        const att = monthCss.filter(c => c.attendance_status === "출석").length;
        return { label: `${month}월`, 수업수: total, 출석률: total > 0 ? Math.round((att / total) * 100) : 0 };
      });
    });
    return map;
  }, [teachers, cssRecords, schedules, period]);

  const getMonthlyData = useCallback((teacher) => monthlyDataMap[teacher.id] || [], [monthlyDataMap]);

  // 통계 초기화: Enrollment를 lesson_count_applied=true인 CSS 기준으로 재계산
  const handleReset = async () => {
    setResetting(true);
    try {
      const [allCss, allEnrs, allScheds] = await Promise.all([
        base44.entities.ClassScheduleStudent.list("-created_date", 5000),
        base44.entities.Enrollment.list(),
        base44.entities.ClassSchedule.list("-class_date", 2000),
      ]);

      const schedMap = {};
      allScheds.forEach(s => { schedMap[s.id] = s; });

      // student+subject 기준으로 lesson_count_applied=true 개수 집계
      const countMap = {};
      allCss.forEach(c => {
        if (!c.is_deleted && c.lesson_count_applied) {
          const sched = schedMap[c.schedule_id];
          if (!sched) return;
          const key = `${c.student_id}__${sched.subject_id || sched.subject_name}`;
          countMap[key] = (countMap[key] || 0) + 1;
        }
      });

      await Promise.all(allEnrs.map(async (enr) => {
        const key = `${enr.student_id}__${enr.subject_id || enr.subject_name}`;
        const completedCount = countMap[key] || 0;
        const remaining = (enr.paid_lessons || 0) - completedCount;
        await base44.entities.Enrollment.update(enr.id, {
          completed_lessons: completedCount,
          remaining_lessons: remaining,
          repayment_needed: remaining <= 0 && (enr.paid_lessons || 0) > 0,
        });
      }));

      await loadData();
      setShowResetConfirm(false);
    } finally {
      setResetting(false);
    }
  };

  if (!user || !isSuperAdmin(user)) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">접근 권한이 없습니다. 총 관리자만 확인할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">선생님별 통계</h2>
          <p className="text-sm text-gray-500 mt-1">총 관리자 전용 — 선생님별 수업 현황 (ClassScheduleStudent 기준)</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowResetConfirm(true)}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 gap-2"
        >
          <RefreshCw className="w-4 h-4" />차시 재계산
        </Button>
      </div>

      {/* 초기화 확인 모달 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">차시 재계산</p>
                <p className="text-xs text-gray-500">총 관리자 전용</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">Enrollment의 완료 차시를 ClassScheduleStudent 기준으로 재계산합니다.</p>
            <p className="text-xs text-gray-500 mb-5">되돌릴 수 없습니다. 계속하시겠습니까?</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowResetConfirm(false)} className="flex-1" disabled={resetting}>취소</Button>
              <Button onClick={handleReset} className="flex-1 bg-red-600 hover:bg-red-700" disabled={resetting}>
                {resetting ? "재계산 중..." : "재계산"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div>
          <label className="text-xs text-gray-500 block mb-1">선생님</label>
          <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400">
            <option value="all">전체 선생님</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">기간</label>
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-5 text-xs text-blue-700">
        📊 통계는 ClassScheduleStudent 기준으로 실시간 계산됩니다. super_admin은 통계에서 제외됩니다.
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          {filteredTeachers.map(teacher => {
            const stats = getTeacherStats(teacher);
            const monthlyData = period === "yearly" ? getMonthlyData(teacher) : null;
            return (
              <div key={teacher.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-purple-50 border-b border-purple-100 flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{teacher.name[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{teacher.name} 선생님</p>
                    <p className="text-xs text-gray-500">관리자 · {PERIOD_LABELS[period]} 통계</p>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <StatCard icon={BookOpen} label="총 수업 수" value={stats.totalClasses} color="blue" />
                    <StatCard icon={CheckCircle} label="출석" value={stats.attended} color="green" />
                    <StatCard icon={XCircle} label="결석" value={stats.absent} color="red" />
                    <StatCard icon={Clock} label="지각" value={stats.tardy} color="yellow" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={FileText} label="피드백 완료" value={stats.feedbackDone} color="purple" />
                    <StatCard icon={FileText} label="피드백 미작성" value={stats.feedbackPending} color="gray" />
                    <StatCard icon={TrendingUp} label="차시 차감됨" value={stats.completedLessons} color="blue" />
                    {period !== "weekly" && (
                      <StatCard icon={Users} label="담당 학생" value={stats.studentCount} color="indigo" />
                    )}
                    {period === "monthly" && (
                      <StatCard icon={Users} label="잔여 3회 이하" value={stats.lowRemainingCount} color="orange" />
                    )}
                  </div>

                  {period === "yearly" && monthlyData && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">월별 수업 수</p>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={monthlyData}>
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="수업수" fill="#7c3aed" radius={[3,3,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">월별 출석률 (%)</p>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={monthlyData}>
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="출석률" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredTeachers.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">선생님 데이터가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    yellow: "bg-yellow-50 text-yellow-700",
    purple: "bg-purple-50 text-purple-700",
    gray: "bg-gray-50 text-gray-600",
    indigo: "bg-indigo-50 text-indigo-700",
    orange: "bg-orange-50 text-orange-700",
  };
  return (
    <div className={`rounded-lg p-3 ${colors[color] || colors.gray}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value ?? 0}</p>
    </div>
  );
}