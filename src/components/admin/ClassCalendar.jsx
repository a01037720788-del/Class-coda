import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser, isSuperAdmin, isAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Plus, PanelRight, X, Filter,
  Megaphone, Ban, Users, Calendar as CalendarIcon
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, startOfWeek, endOfWeek, parseISO, addMonths, subMonths
} from "date-fns";
import { ko } from "date-fns/locale";
import ScheduleModal from "@/components/admin/ScheduleModal";
import FeedbackPanel from "@/components/admin/FeedbackPanel";
import DayStatsPanel from "@/components/admin/DayStatsPanel";
import NoticeModal from "@/components/admin/NoticeModal";
import HolidayModal from "@/components/admin/HolidayModal";
import ScheduleDeleteModal from "@/components/admin/ScheduleDeleteModal";
import GoogleCalendarSync from "@/components/admin/GoogleCalendarSync";
import ScheduleDetailDialog from "@/components/admin/ScheduleDetailDialog";
import { parseGoogleEventTitle } from "@/lib/googleEventParser";

// 대한민국 공휴일 (고정)
const KOREAN_HOLIDAYS = [
  { month: 1, day: 1, title: "신정" },
  { month: 3, day: 1, title: "삼일절" },
  { month: 5, day: 5, title: "어린이날" },
  { month: 6, day: 6, title: "현충일" },
  { month: 8, day: 15, title: "광복절" },
  { month: 10, day: 3, title: "개천절" },
  { month: 10, day: 9, title: "한글날" },
  { month: 12, day: 25, title: "크리스마스" },
];

function getHolidayForDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return KOREAN_HOLIDAYS.find(h => h.month === m && h.day === d) || null;
}

export default function ClassCalendar() {
  const [user, setUser] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [notices, setNotices] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState("전체");
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [noticeDate, setNoticeDate] = useState(null);
  const [holidayDate, setHolidayDate] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // 삭제 모달 대상 스케줄
  const [attendanceMap, setAttendanceMap] = useState({});
  const [detailSchedule, setDetailSchedule] = useState(null); // 상세 다이얼로그 대상
  const [allStudents, setAllStudents] = useState([]); // 학생 목록 (수동 연결용)

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
  }, []);

  useEffect(() => {
    loadAll(currentMonth);
  }, [currentMonth]);

  const loadAll = useCallback(async (monthDate) => {
    setLoadingData(true);
    try {
      const m = monthDate || currentMonth;
      const rangeStart = format(startOfWeek(startOfMonth(m), { weekStartsOn: 0 }), "yyyy-MM-dd");
      const rangeEnd = format(endOfWeek(endOfMonth(m), { weekStartsOn: 0 }), "yyyy-MM-dd");
      const [scheds, nots, hols, allCss, studs] = await Promise.all([
        base44.entities.ClassSchedule.filter(
          { class_date: { $gte: rangeStart, $lte: rangeEnd } },
          "class_date",
          2000
        ),
        base44.entities.CalendarNotice.list("-notice_date", 500),
        base44.entities.AcademyHoliday.list("-holiday_date", 500),
        base44.entities.ClassScheduleStudent.list("-created_date", 5000),
        base44.entities.Student.list("-created_date", 5000),
      ]);
      // is_deleted !== true 인 일정만 캘린더에 표시
      const activeScheds = scheds.filter(s => s.is_deleted !== true);
      setSchedules(activeScheds);
      setNotices(nots);
      setHolidays(hols);
      // 출석 데이터 맵 구축 (schedule_id -> student_id -> attendance_status)
      // 결석 학생 검정색 표시용 — DB 색상값 변경 없이 렌더링 시에만 사용
      const scheduleIdSet = new Set(activeScheds.map(s => s.id).filter(Boolean));
      const aMap = {};
      (allCss || []).forEach(c => {
        if (c.is_deleted) return;
        if (!scheduleIdSet.has(c.schedule_id)) return;
        if (!aMap[c.schedule_id]) aMap[c.schedule_id] = {};
        aMap[c.schedule_id][c.student_id] = c.attendance_status;
      });
      setAttendanceMap(aMap);
      setAllStudents(studs || []);
    } finally {
      setLoadingData(false);
    }
  }, [currentMonth]);

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }),
  }), [currentMonth]);

  // 선생님 목록
  const teachers = useMemo(() => {
    const names = [...new Set(schedules.map(s => s.teacher_name).filter(Boolean))];
    return names;
  }, [schedules]);

  // 날짜별 일정/공지/휴일 룩업 맵 (schedules/notices/holidays 변경 시만 재계산)
  const schedulesByDate = useMemo(() => {
    const map = {};
    schedules.forEach(s => {
      if (s.class_date) {
        const key = s.class_date.substring(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(s);
      }
    });
    return map;
  }, [schedules]);

  const noticesByDate = useMemo(() => {
    const map = {};
    notices.forEach(n => {
      if (n.notice_date) {
        const key = n.notice_date.substring(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(n);
      }
    });
    return map;
  }, [notices]);

  const holidaysByDate = useMemo(() => {
    const map = {};
    holidays.forEach(h => {
      if (h.holiday_date) {
        const key = h.holiday_date.substring(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(h);
      }
    });
    return map;
  }, [holidays]);

  const getSchedulesForDay = useCallback((date) => {
    const key = format(date, "yyyy-MM-dd");
    const list = schedulesByDate[key] || [];
    return teacherFilter !== "전체" ? list.filter(s => s.teacher_name === teacherFilter) : list;
  }, [schedulesByDate, teacherFilter]);

  const getNoticesForDay = useCallback((date) => {
    const key = format(date, "yyyy-MM-dd");
    return noticesByDate[key] || [];
  }, [noticesByDate]);

  const getHolidaysForDay = useCallback((date) => {
    const key = format(date, "yyyy-MM-dd");
    const dbHolidays = holidaysByDate[key] || [];
    const national = getHolidayForDate(date);
    if (national) {
      return [...dbHolidays, { title: national.title, holiday_type: "공휴일", color: "red", id: "national_" + national.title }];
    }
    return dbHolidays;
  }, [holidaysByDate]);

  const selectedDaySchedules = useMemo(() => getSchedulesForDay(selectedDate), [getSchedulesForDay, selectedDate]);
  const selectedDayNotices = useMemo(() => getNoticesForDay(selectedDate), [getNoticesForDay, selectedDate]);
  const selectedDayHolidays = useMemo(() => getHolidaysForDay(selectedDate), [getHolidaysForDay, selectedDate]);

  const handleOpenAdd = useCallback(() => { setEditingSchedule(null); setShowModal(true); }, []);
  const handleOpenEdit = useCallback((schedule) => { setEditingSchedule(schedule); setShowModal(true); }, []);
  const handleSaved = useCallback(() => { setShowModal(false); loadAll(); }, [loadAll]);
  const handleDelete = useCallback((schedule) => {
    setDeleteTarget(schedule);
  }, []);

  const handleDayClick = useCallback((day) => {
    setSelectedDate(day);
  }, []);

  // 캘린더 초기화/동기화 완료 후: 상태를 즉시 비우고 서버에서 재조회
  const handleCalendarResetComplete = useCallback(() => {
    setSchedules([]);
    setAttendanceMap({});
    setDetailSchedule(null);
    setEditingSchedule(null);
    // 서버에서 재조회 (검증)
    setTimeout(() => loadAll(), 100);
  }, [loadAll]);

  const canManage = user && (isSuperAdmin(user) || isAdmin(user));

  const colorMap = {
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    purple: "bg-purple-100 text-purple-700",
    gray: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="flex h-full">
      {/* Left: Calendar */}
      <div className="flex-1 p-3 md:p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">수업 캘린더</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {canManage && (
              <>
                <Button variant="outline" size="sm"
                  onClick={() => { setNoticeDate(selectedDate); setShowNoticeModal(true); }}
                  className="text-amber-600 border-amber-200">
                  <Megaphone className="w-3.5 h-3.5 mr-1" />공지
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => { setHolidayDate(selectedDate); setShowHolidayModal(true); }}
                  className="text-red-600 border-red-200">
                  <Ban className="w-3.5 h-3.5 mr-1" />휴무
                </Button>
                <Button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700" size="sm">
                  <Plus className="w-4 h-4 mr-1" />일정 추가
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Google Calendar 연동 */}
        {canManage && (
          <div className="mb-3">
            <GoogleCalendarSync onSynced={handleCalendarResetComplete} />
          </div>
        )}

        {/* Teacher Filter */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 font-medium">선생님:</span>
          {["전체", ...teachers].map(t => (
            <button key={t} onClick={() => setTeacherFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                teacherFilter === t
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Month Navigation */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-gray-900">
              {format(currentMonth, "yyyy년 M월", { locale: ko })}
            </span>
            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2 md:p-3">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["일", "월", "화", "수", "목", "금", "토"].map(d => (
                <div key={d} className={`text-center text-xs font-semibold py-1.5 ${d === "일" ? "text-red-500" : d === "토" ? "text-blue-500" : "text-gray-400"}`}>{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map(day => {
                const daySchedules = getSchedulesForDay(day);
                const dayNotices = getNoticesForDay(day);
                const dayHolidays = getHolidaysForDay(day);
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const dow = day.getDay();
                const isHoliday = dayHolidays.length > 0;
                const studentCount = [...new Set(daySchedules.flatMap(s => s.student_ids || []))].length;

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[56px] md:min-h-[72px] p-1 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50 ring-1 ring-blue-300" : isHoliday ? "bg-red-50/50" : "hover:bg-gray-50"
                    } ${!isCurrentMonth ? "opacity-30" : ""}`}
                  >
                    <span className={`text-xs font-medium inline-flex w-5 h-5 items-center justify-center rounded-full ${
                      isToday ? "bg-blue-600 text-white" :
                      isHoliday ? "text-red-500" :
                      dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-700"
                    }`}>
                      {format(day, "d")}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {/* 공휴일/휴무 */}
                      {dayHolidays.slice(0, 1).map(h => (
                        <div key={h.id || h.title} className="text-[9px] font-medium text-red-600 truncate">
                          🚫 {h.title}
                        </div>
                      ))}
                      {/* 공지 */}
                      {dayNotices.length > 0 && (
                        <div className="text-[9px] font-medium text-amber-600">
                          📢 공지{dayNotices.length > 1 ? ` ${dayNotices.length}` : ""}
                        </div>
                      )}
                      {/* 선생님별 인원 */}
                      {(() => {
                        const tMap = {};
                        daySchedules.forEach(s => {
                          if (!s.teacher_name) return;
                          if (!tMap[s.teacher_name]) tMap[s.teacher_name] = new Set();
                          (s.student_ids || []).forEach(id => tMap[s.teacher_name].add(id));
                        });
                        const entries = Object.entries(tMap).sort((a, b) => b[1].size - a[1].size);
                        const shown = entries.slice(0, 2);
                        const rest = entries.length - 2;
                        return (
                          <>
                            {shown.map(([t, ids]) => (
                              <div key={t} className="text-[9px] leading-tight text-blue-700 bg-blue-50 rounded px-1 truncate flex items-center justify-between gap-0.5">
                                <span className="truncate">{t.length > 3 ? t.slice(0, 3) : t}</span>
                                <span className="font-bold flex-shrink-0">{ids.size}</span>
                              </div>
                            ))}
                            {rest > 0 && (
                              <div className="text-[9px] text-gray-400">외 {rest}명</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Day Detail */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">
              {format(selectedDate, "M월 d일 (eee)", { locale: ko })} 상세
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSidePanel(true)}
              className="lg:hidden text-blue-600 border-blue-200 text-xs"
            >
              <PanelRight className="w-3.5 h-3.5 mr-1" />출석/피드백 보기
            </Button>
          </div>

          {/* 공휴일/휴무 */}
          {selectedDayHolidays.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {selectedDayHolidays.map(h => (
                <div key={h.id || h.title} className="flex items-center gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100">
                  <Ban className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">{h.title}</p>
                    {h.holiday_type && <p className="text-xs text-red-400">{h.holiday_type}</p>}
                    {h.description && <p className="text-xs text-gray-500">{h.description}</p>}
                  </div>
                  {canManage && h.id && !String(h.id).startsWith("national_") && (
                    <button onClick={async () => { await base44.entities.AcademyHoliday.delete(h.id); loadAll(); }}
                      className="ml-auto text-xs text-red-400 hover:text-red-600">삭제</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 공지 */}
          {selectedDayNotices.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {selectedDayNotices.map(n => (
                <div key={n.id} className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <Megaphone className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">{n.title}</p>
                    {n.content && <p className="text-xs text-gray-600 mt-0.5">{n.content}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5">대상: {n.target_type} · {n.created_by_name}</p>
                  </div>
                  {canManage && (
                    <button onClick={async () => { await base44.entities.CalendarNotice.delete(n.id); loadAll(); }}
                      className="text-xs text-gray-400 hover:text-red-500">삭제</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 수업 목록 — 시간순 정렬 */}
          {selectedDaySchedules.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">이 날 수업이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {[...selectedDaySchedules]
                .sort((a, b) => {
                  const t = (a.start_time || "99:99").localeCompare(b.start_time || "99:99");
                  if (t !== 0) return t;
                  const tn = (a.teacher_name || "").localeCompare(b.teacher_name || "");
                  if (tn !== 0) return tn;
                  return (a.student_names?.[0] || "").localeCompare(b.student_names?.[0] || "");
                })
                .map(s => {
                  const parsed = s.parsed_info || (s.calendar_source === "google" ? parseGoogleEventTitle(s.google_original_title || s.title || "") : null);
                  const hasStudentLink = (s.student_ids || []).length > 0;
                  const needsLink = s.calendar_source === "google" && !hasStudentLink && parsed?.student_name;
                  return (
                    <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                      needsLink ? "bg-amber-50 border border-amber-200 hover:bg-amber-100" : "bg-gray-50 hover:bg-gray-100"
                    }`} onClick={() => setDetailSchedule(s)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-8 rounded-full ${needsLink ? "bg-amber-400" : "bg-blue-400"}`} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {s.start_time && (
                              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                {s.start_time}{s.end_time ? `~${s.end_time}` : ""}
                              </span>
                            )}
                            <p className="font-medium text-gray-900 text-sm">
                              {s.student_names?.[0] || parsed?.student_name || s.subject_name || "제목 없음"}
                            </p>
                            {(s.subject_name && s.subject_name !== "미지정") && (
                              <Badge className="bg-purple-50 text-purple-600 border-0 text-[9px] px-1 py-0">{s.subject_name}</Badge>
                            )}
                            {parsed?.subject_code && (
                              <span className="text-[10px] text-gray-400 font-mono">{parsed.subject_code}</span>
                            )}
                            {s.calendar_source === "google" && (
                              <Badge className="bg-blue-50 text-blue-600 border-0 text-[9px] gap-0.5 px-1 py-0">
                                <CalendarIcon className="w-2.5 h-2.5" />G
                              </Badge>
                            )}
                            {needsLink && (
                              <Badge className="bg-amber-100 text-amber-700 border-0 text-[9px] gap-0.5 px-1 py-0">
                                ⚠ 연결필요
                              </Badge>
                            )}
                            {s.student_link_source === "manual" && (
                              <Badge className="bg-indigo-50 text-indigo-600 border-0 text-[9px] px-1 py-0">수동연결</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap">
                            {s.teacher_name && <span>{s.teacher_name}</span>}
                            {s.student_names?.length > 0 && <span>·</span>}
                            {s.student_names?.map((name, i) => {
                              const studentId = s.student_ids?.[i];
                              const isAbsent = studentId && attendanceMap[s.id]?.[studentId] === "결석";
                              return (
                                <span key={i} className={isAbsent ? "bg-black text-white px-1.5 py-0.5 rounded text-[10px] font-medium" : ""}>
                                  {name}
                                </span>
                              );
                            })}
                            {s.schedule_type === "weekly" && <span>· 매주반복</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {canManage && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(s)} className="h-7 px-2 text-xs">수정</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(s)} className="h-7 px-2 text-xs text-red-500">삭제</Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — 데스크탑 항상 표시 */}
      <div className="hidden lg:flex w-96 border-l border-gray-200 bg-white overflow-auto flex-col">
        <DayStatsPanel selectedDate={selectedDate} schedules={selectedDaySchedules} />
        {canManage && <FeedbackPanel selectedDate={selectedDate} schedules={selectedDaySchedules} />}
      </div>

      {/* 모바일 드로어 */}
      {showSidePanel && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSidePanel(false)} />
          <div className="relative w-[85vw] max-w-sm bg-white h-full overflow-auto flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-800">
                {format(selectedDate, "M월 d일 출석/피드백", { locale: ko })}
              </span>
              <button onClick={() => setShowSidePanel(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <DayStatsPanel selectedDate={selectedDate} schedules={selectedDaySchedules} />
            {canManage && <FeedbackPanel selectedDate={selectedDate} schedules={selectedDaySchedules} />}
          </div>
        </div>
      )}

      {/* 수업 일정 모달 */}
      {showModal && (
        <ScheduleModal schedule={editingSchedule} defaultDate={selectedDate} onSave={handleSaved} onClose={() => setShowModal(false)} />
      )}

      {/* 공지 모달 */}
      {showNoticeModal && (
        <NoticeModal
          defaultDate={noticeDate}
          user={user}
          onSave={() => { setShowNoticeModal(false); loadAll(); }}
          onClose={() => setShowNoticeModal(false)}
        />
      )}

      {/* 휴무일 모달 */}
      {showHolidayModal && (
        <HolidayModal
          defaultDate={holidayDate}
          user={user}
          onSave={() => { setShowHolidayModal(false); loadAll(); }}
          onClose={() => setShowHolidayModal(false)}
        />
      )}

      {/* 수업 삭제 범위 선택 모달 */}
      {deleteTarget && (
        <ScheduleDeleteModal
          schedule={deleteTarget}
          allSchedules={schedules}
          onDeleted={() => { setDeleteTarget(null); loadAll(); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* 수업 상세/출석 관리 다이얼로그 */}
      {detailSchedule && (
        <ScheduleDetailDialog
          schedule={detailSchedule}
          attendanceMap={attendanceMap}
          students={allStudents}
          onClose={() => setDetailSchedule(null)}
          onUpdated={loadAll}
        />
      )}
    </div>
  );
}