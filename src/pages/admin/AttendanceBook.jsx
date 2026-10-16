import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, AlertCircle, Minus, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = [
  { value: "출석", label: "출석", icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-300", dot: "bg-green-500" },
  { value: "결석", label: "결석", icon: XCircle, color: "bg-red-100 text-red-700 border-red-300", dot: "bg-red-500" },
  { value: "지각", label: "지각", icon: Clock, color: "bg-yellow-100 text-yellow-700 border-yellow-300", dot: "bg-yellow-500" },
  { value: "보강 예정", label: "보강", icon: RefreshCw, color: "bg-blue-100 text-blue-700 border-blue-300", dot: "bg-blue-500" },
  { value: "취소", label: "취소", icon: AlertCircle, color: "bg-gray-100 text-gray-500 border-gray-300", dot: "bg-gray-400" },
  { value: "미정", label: "미정", icon: Minus, color: "bg-white text-gray-400 border-gray-200", dot: "bg-gray-300" },
];

const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

export default function AttendanceBook() {
  const [user, setUser] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [cssRecords, setCssRecords] = useState([]); // ClassScheduleStudent
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("all");
  const [selectedDate, setSelectedDate] = useState(null);
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    loadBase(u);
  }, []);

  useEffect(() => {
    if (user) loadMonth();
  }, [currentMonth, user]);

  const loadBase = async (u) => {
    const admins = await base44.entities.AppUser.filter({ role: "admin" });
    setTeachers(admins);
    // super_admin이면 본인도 포함
    if (u?.role === "super_admin") {
      const superAdmins = await base44.entities.AppUser.filter({ role: "super_admin" });
      setTeachers([...admins, ...superAdmins]);
    }
  };

  const loadMonth = async () => {
    setLoading(true);
    const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const [scheds, css] = await Promise.all([
      base44.entities.ClassSchedule.list("-class_date", 2000),
      base44.entities.ClassScheduleStudent.list("-created_date", 5000),
    ]);

    const monthScheds = scheds.filter(s => s.class_date >= monthStart && s.class_date <= monthEnd);
    const monthScheduleIds = new Set(monthScheds.map(s => s.id));
    const monthCss = css.filter(c => monthScheduleIds.has(c.schedule_id) && !c.is_deleted);

    setSchedules(monthScheds);
    setCssRecords(monthCss);
    setLoading(false);
  };

  // 달력 날짜 목록
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  // 날짜별 수업 목록
  const schedulesByDate = useMemo(() => {
    const map = {};
    schedules.forEach(s => {
      const key = s.class_date;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [schedules]);

  // 선택된 날짜의 수업 필터
  const todaySchedules = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    const dayScheds = (schedulesByDate[key] || []);
    if (selectedTeacher === "all") return dayScheds;
    return dayScheds.filter(s => s.teacher_id === selectedTeacher);
  }, [selectedDate, schedulesByDate, selectedTeacher]);

  // CSS 레코드 맵 (schedule_id -> student_id -> record)
  const cssMap = useMemo(() => {
    const map = {};
    cssRecords.forEach(c => {
      if (!map[c.schedule_id]) map[c.schedule_id] = {};
      map[c.schedule_id][c.student_id] = c;
    });
    return map;
  }, [cssRecords]);

  // 날짜별 출석 요약
  const dateSummary = useMemo(() => {
    const map = {};
    schedules.forEach(s => {
      const css = cssMap[s.id] || {};
      Object.values(css).forEach(c => {
        if (!map[s.class_date]) map[s.class_date] = { total: 0, attended: 0, absent: 0, pending: 0 };
        map[s.class_date].total++;
        if (c.attendance_status === "출석") map[s.class_date].attended++;
        else if (c.attendance_status === "결석") map[s.class_date].absent++;
        else if (c.attendance_status === "미정") map[s.class_date].pending++;
      });
    });
    return map;
  }, [schedules, cssMap]);

  const updateStatus = async (cssRecord, newStatus) => {
    const key = `${cssRecord.schedule_id}_${cssRecord.student_id}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await base44.entities.ClassScheduleStudent.update(cssRecord.id, { attendance_status: newStatus });
      setCssRecords(prev => prev.map(c => c.id === cssRecord.id ? { ...c, attendance_status: newStatus } : c));
    } catch (e) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
  const firstDayOfMonth = startOfMonth(currentMonth).getDay(); // 0=일
  const offsetDays = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // 월 시작 기준 offset

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">출석부</h2>
          <p className="text-xs text-gray-500 mt-0.5">날짜를 클릭해 출석을 관리하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400">
            <option value="all">전체 선생님</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* 달력 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:w-80 flex-shrink-0">
          {/* 월 네비 */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <p className="font-bold text-gray-900 text-sm">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </p>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEK_DAYS.map(d => (
              <div key={d} className={`text-center text-[11px] font-semibold py-1 ${d === "일" ? "text-red-400" : d === "토" ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: offsetDays }).map((_, i) => <div key={`e${i}`} />)}
            {calendarDays.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const summary = dateSummary[key];
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const dayOfWeek = day.getDay();
              const hasSchedule = !!(schedulesByDate[key]?.length);

              return (
                <button key={key} onClick={() => setSelectedDate(day)}
                  className={`relative flex flex-col items-center justify-start rounded-xl p-1 min-h-[52px] transition-all ${
                    isSelected ? "bg-purple-600 text-white shadow-md" :
                    isToday ? "bg-purple-50 text-purple-700" :
                    "hover:bg-gray-50 text-gray-700"
                  }`}>
                  <span className={`text-xs font-semibold mb-0.5 ${
                    isSelected ? "text-white" :
                    isToday ? "text-purple-700" :
                    dayOfWeek === 0 ? "text-red-400" :
                    dayOfWeek === 6 ? "text-blue-400" : ""
                  }`}>{format(day, "d")}</span>

                  {/* 출석 요약 도트 */}
                  {summary && (
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {summary.attended > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-green-300" : "bg-green-500"}`} />
                      )}
                      {summary.absent > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-red-300" : "bg-red-500"}`} />
                      )}
                      {summary.pending > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/60" : "bg-gray-300"}`} />
                      )}
                    </div>
                  )}
                  {hasSchedule && !summary && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/60" : "bg-gray-300"}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
            {[
              { label: "출석", dot: "bg-green-500" },
              { label: "결석", dot: "bg-red-500" },
              { label: "미정", dot: "bg-gray-300" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                <span className="text-xs text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 출석 상세 패널 */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          {!selectedDate ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium">날짜를 선택하세요</p>
              <p className="text-xs text-gray-300">달력에서 날짜를 클릭하면 출석 현황이 표시됩니다</p>
            </div>
          ) : (
            <>
              {/* 헤더 */}
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">
                    {format(selectedDate, "M월 d일 (EEE)", { locale: ko })} 출석부
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {todaySchedules.length}개 수업 · 총 {todaySchedules.reduce((a, s) => a + (cssMap[s.id] ? Object.keys(cssMap[s.id]).length : 0), 0)}명
                  </p>
                </div>
                <button onClick={loadMonth} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                  <RefreshCw className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* 수업 목록 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                  <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
                ) : todaySchedules.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-sm">이 날짜에 수업이 없습니다</p>
                  </div>
                ) : (
                  todaySchedules.map(schedule => {
                    const students = cssMap[schedule.id] || {};
                    const studentList = Object.values(students);
                    const attendedCount = studentList.filter(c => c.attendance_status === "출석").length;
                    const totalCount = studentList.length;

                    return (
                      <div key={schedule.id} className="border border-gray-100 rounded-xl overflow-hidden">
                        {/* 수업 헤더 */}
                        <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {schedule.title || schedule.subject_name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {schedule.start_time && (
                                <span className="text-xs text-gray-500">{schedule.start_time}</span>
                              )}
                              {schedule.teacher_name && (
                                <span className="text-xs text-purple-600 font-medium">{schedule.teacher_name} 선생님</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-purple-700">{attendedCount}/{totalCount}</p>
                            <p className="text-[11px] text-gray-400">출석</p>
                          </div>
                        </div>

                        {/* 학생 목록 */}
                        {studentList.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-400">등록된 학생이 없습니다</div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {studentList.map(css => {
                              const savingKey = `${css.schedule_id}_${css.student_id}`;
                              const isSaving = saving[savingKey];
                              const current = STATUS_MAP[css.attendance_status] || STATUS_MAP["미정"];

                              return (
                                <div key={css.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${current.dot}`} />
                                    <span className="text-sm font-medium text-gray-800 truncate">
                                      {css.student_name}
                                    </span>
                                    {css.feedback_completed && (
                                      <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 rounded px-1.5 py-0.5 flex-shrink-0">피드백완료</span>
                                    )}
                                  </div>

                                  {/* 출석 상태 버튼들 */}
                                  <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                                    {STATUS_OPTIONS.slice(0, 4).map(opt => {
                                      const isActive = css.attendance_status === opt.value;
                                      return (
                                        <button key={opt.value}
                                          onClick={() => !isSaving && updateStatus(css, opt.value)}
                                          disabled={isSaving}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                            isActive ? opt.color + " shadow-sm" :
                                            "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
                                          } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}>
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                    <button
                                      onClick={() => !isSaving && updateStatus(css, "미정")}
                                      disabled={isSaving}
                                      className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                                        css.attendance_status === "미정" ? "bg-gray-100 text-gray-500 border-gray-300" :
                                        "bg-white text-gray-300 border-gray-100 hover:border-gray-200 hover:text-gray-400"
                                      } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}>
                                      미정
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 수업 하단 요약 */}
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
                          {STATUS_OPTIONS.slice(0, 5).map(opt => {
                            const cnt = studentList.filter(c => c.attendance_status === opt.value).length;
                            if (cnt === 0) return null;
                            return (
                              <span key={opt.value} className="flex items-center gap-1 text-xs text-gray-500">
                                <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                                {opt.label} {cnt}
                              </span>
                            );
                          })}
                          {studentList.filter(c => c.attendance_status === "미정").length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                              미정 {studentList.filter(c => c.attendance_status === "미정").length}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}