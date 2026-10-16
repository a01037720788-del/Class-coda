import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, CheckCircle, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, Bell } from "lucide-react";
import { format, addDays, subDays, isSameDay, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import AttendanceBadge from "@/components/common/AttendanceBadge";

const ATTENDANCE_OPTIONS = ["출석", "결석", "지각", "보강 예정", "취소"];
const COUNT_LESSON_STATUSES = ["출석", "지각"];

const FILTER_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "today", label: "오늘 수업" },
  { value: "missing", label: "피드백 미작성" },
  { value: "past_missing", label: "지난 수업 미작성" },
  { value: "done", label: "작성 완료" },
];

export default function AdminFeedback() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("date"); // "date" | "filter"
  const [filterType, setFilterType] = useState("all");
  const [schedules, setSchedules] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [allFeedbacks, setAllFeedbacks] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({
    attendance_status: "출석",
    learned_content: "",
    homework: "",
    parent_memo: ""
  });
  const [shouldNotify, setShouldNotify] = useState(true);
  const { toast } = useToast();

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
  }, []);

  // 날짜 모드: 선택 날짜 기준 로드
  useEffect(() => {
    if (viewMode === "date") {
      loadDateData();
      setExpanded(null);
    }
  }, [dateStr, viewMode]);

  // 필터 모드: 전체 데이터 로드
  useEffect(() => {
    if (viewMode === "filter") {
      loadAllData();
      setExpanded(null);
    }
  }, [viewMode]);

  const loadAllData = async () => {
    const [scheds, fbs] = await Promise.all([
      base44.entities.ClassSchedule.list("-class_date", 1000),
      base44.entities.LessonFeedback.list("-class_date", 1000),
    ]);
    setAllSchedules(scheds);
    setAllFeedbacks(fbs.filter(f => !f.is_deleted));
  };

  const [cssMap, setCssMap] = useState({}); // scheduleId → css[]

  // 날짜 모드 로드 시 CSS도 함께 조회
  const loadDateData = async () => {
    const [scheds, fbs] = await Promise.all([
      base44.entities.ClassSchedule.filter({ class_date: dateStr }),
      base44.entities.LessonFeedback.filter({ class_date: dateStr }),
    ]);
    setSchedules(scheds);
    setFeedbacks(fbs.filter(f => !f.is_deleted));
    if (scheds.length > 0) {
      const results = await Promise.all(scheds.map(s =>
        base44.entities.ClassScheduleStudent.filter({ schedule_id: s.id })
      ));
      const map = {};
      scheds.forEach((s, i) => { map[s.id] = results[i].filter(c => !c.is_deleted); });
      setCssMap(map);
    } else {
      setCssMap({});
    }
  };

  // CSS 기준으로 entries 생성하는 헬퍼
  const buildEntriesFromCSS = (scheds, cssMapData) =>
    scheds.flatMap(s =>
      (cssMapData[s.id] || []).map(c => ({
        scheduleId: s.id,
        studentId: c.student_id,
        studentName: c.student_name,
        subjectName: s.subject_name,
        teacherName: s.teacher_name,
        startTime: s.start_time,
        lessonNumber: s.lesson_number,
        subjectId: s.subject_id,
        classDate: s.class_date,
      }))
    );

  // 날짜 모드 entries (CSS 기준)
  const dateEntries = useMemo(() =>
    buildEntriesFromCSS(schedules, cssMap),
    [schedules, cssMap]);

  // 필터 모드 entries (CSS 기준 — allSchedules 사용 시 cssMap에 없는 것은 student_ids 폴백)
  const allEntries = useMemo(() =>
    allSchedules.flatMap(s =>
      (s.student_ids || []).map((studentId, idx) => ({
        scheduleId: s.id,
        studentId,
        studentName: s.student_names?.[idx] || studentId,
        subjectName: s.subject_name,
        teacherName: s.teacher_name,
        startTime: s.start_time,
        lessonNumber: s.lesson_number,
        subjectId: s.subject_id,
        classDate: s.class_date,
      }))
    ), [allSchedules]);

  const getFeedback = (studentId, scheduleId, fbs = feedbacks) =>
    fbs.find(f => f.student_id === studentId && f.schedule_id === scheduleId);

  const filteredEntries = useMemo(() => {
    if (viewMode === "date") return dateEntries;
    switch (filterType) {
      case "today":
        return allEntries.filter(e => e.classDate === todayStr);
      case "missing":
        return allEntries.filter(e => !getFeedback(e.studentId, e.scheduleId, allFeedbacks));
      case "past_missing":
        return allEntries.filter(e =>
          e.classDate < todayStr && !getFeedback(e.studentId, e.scheduleId, allFeedbacks)
        );
      case "done":
        return allEntries.filter(e => !!getFeedback(e.studentId, e.scheduleId, allFeedbacks));
      default:
        return allEntries;
    }
  }, [viewMode, filterType, dateEntries, allEntries, allFeedbacks]);

  const activeFeedbacks = viewMode === "date" ? feedbacks : allFeedbacks;
  const activeGetFeedback = (sId, schId) => getFeedback(sId, schId, activeFeedbacks);

  const handleSelectEntry = (entry) => {
    const key = entry.studentId + entry.scheduleId;
    if (expanded === key) { setExpanded(null); return; }
    setExpanded(key);
    const existing = activeGetFeedback(entry.studentId, entry.scheduleId);
    setForm({
      attendance_status: existing?.attendance_status || "출석",
      learned_content: existing?.learned_content || "",
      homework: existing?.homework || "",
      parent_memo: existing?.parent_memo || "",
    });
    setShouldNotify(true);
  };

  const handleSave = async (entry) => {
    const existing = activeGetFeedback(entry.studentId, entry.scheduleId);
    const entryDateStr = entry.classDate || dateStr;
    const saveData = {
      ...form,
      student_id: entry.studentId,
      student_name: entry.studentName,
      subject_id: entry.subjectId,
      subject_name: entry.subjectName,
      teacher_id: user?.id,
      teacher_name: user?.name,
      schedule_id: entry.scheduleId,
      class_date: entryDateStr,
      lesson_number: entry.lessonNumber,
      is_completed: true,
    };

    const wasAlreadyCountingStatus = existing && COUNT_LESSON_STATUSES.includes(existing.attendance_status);
    const willCountNow = COUNT_LESSON_STATUSES.includes(form.attendance_status);

    if (existing) {
      await base44.entities.LessonFeedback.update(existing.id, saveData);
      if (!wasAlreadyCountingStatus && willCountNow) {
        await incrementLesson(entry, entryDateStr);
      } else if (wasAlreadyCountingStatus && !willCountNow) {
        await decrementLesson(entry);
      }
    } else {
      await base44.entities.LessonFeedback.create(saveData);
      if (willCountNow) {
        await incrementLesson(entry, entryDateStr);
      }
    }

    if (shouldNotify) {
      base44.functions.invoke("sendFeedbackNotification", {
        studentId: entry.studentId,
        studentName: entry.studentName,
        subjectName: entry.subjectName,
        classDate: entryDateStr,
        teacherName: user?.name,
        attendanceStatus: form.attendance_status,
        learnedContent: form.learned_content,
        homework: form.homework,
        parentMemo: form.parent_memo,
        notifyChannels: { inApp: true, sms: false, kakao: false },
      });
    }

    toast({ title: "저장 완료", description: `${entry.studentName} 피드백이 저장${shouldNotify ? " · 알림 전송" : ""}되었습니다.` });
    if (viewMode === "date") loadDateData();
    else loadAllData();
  };

  const incrementLesson = async (entry, entryDateStr) => {
    const enrollments = await base44.entities.Enrollment.filter({ student_id: entry.studentId });
    const enrollment = enrollments.find(e =>
      entry.subjectId ? e.subject_id === entry.subjectId : e.subject_name === entry.subjectName
    );
    if (enrollment) {
      const newCompleted = (enrollment.completed_lessons || 0) + 1;
      const remaining = (enrollment.paid_lessons || 0) - newCompleted;
      await base44.entities.Enrollment.update(enrollment.id, {
        completed_lessons: newCompleted,
        remaining_lessons: remaining,
        repayment_needed: remaining <= 0,
        last_class_date: entryDateStr,
      });
    }
  };

  const decrementLesson = async (entry) => {
    const enrollments = await base44.entities.Enrollment.filter({ student_id: entry.studentId });
    const enrollment = enrollments.find(e =>
      entry.subjectId ? e.subject_id === entry.subjectId : e.subject_name === entry.subjectName
    );
    if (enrollment && (enrollment.completed_lessons || 0) > 0) {
      const newCompleted = (enrollment.completed_lessons || 0) - 1;
      const remaining = (enrollment.paid_lessons || 0) - newCompleted;
      await base44.entities.Enrollment.update(enrollment.id, {
        completed_lessons: newCompleted,
        remaining_lessons: remaining,
        repayment_needed: remaining <= 0,
      });
    }
  };

  const isPresent = COUNT_LESSON_STATUSES.includes(form.attendance_status);
  const completedCount = filteredEntries.filter(e => activeGetFeedback(e.studentId, e.scheduleId)).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">피드백 관리</h2>
          <p className="text-gray-500 text-sm mt-1">수업 학생들에게 피드백을 작성하세요.</p>
        </div>
        {/* 모드 전환 */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("date")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "date" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >날짜별</button>
          <button
            onClick={() => setViewMode("filter")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${viewMode === "filter" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          ><Filter className="w-3 h-3" />필터</button>
        </div>
      </div>

      {/* 날짜 모드: Date Navigation */}
      {viewMode === "date" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5 flex items-center justify-between">
          <button onClick={() => setSelectedDate(d => subDays(d, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-900">{format(selectedDate, "yyyy년 M월 d일 (eee)", { locale: ko })}</p>
            {isSameDay(selectedDate, new Date()) && <span className="text-xs text-blue-600 font-medium">오늘</span>}
          </div>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 필터 모드: 필터 버튼 */}
      {viewMode === "filter" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFilterType(opt.value); setExpanded(null); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filterType === opt.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >{opt.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {filteredEntries.length > 0 && (
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{filteredEntries.length}</p>
            <p className="text-xs text-gray-500">수업 수</p>
          </div>
          <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-gray-500">피드백 완료</p>
          </div>
          <div className="flex-1 bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{filteredEntries.length - completedCount}</p>
            <p className="text-xs text-gray-500">미작성</p>
          </div>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">
            {viewMode === "date" ? "이 날 수업 일정이 없습니다." : "해당하는 수업이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map(entry => {
            const key = entry.studentId + entry.scheduleId;
            const fb = activeGetFeedback(entry.studentId, entry.scheduleId);
            const isExpanded = expanded === key;

            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div
                  onClick={() => handleSelectEntry(entry)}
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{entry.studentName}</span>
                      <span className="text-gray-400 text-sm">/</span>
                      <span className="text-gray-600 text-sm">{entry.subjectName}</span>
                      {/* 필터 모드에서 날짜 표시 */}
                      {viewMode === "filter" && entry.classDate && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {entry.classDate}
                          {entry.classDate < todayStr && " (지난 수업)"}
                        </span>
                      )}
                      {(entry.startTime || entry.endTime) && (
                        <span className="text-xs text-gray-400">
                          {entry.startTime}{entry.endTime ? ` ~ ${entry.endTime}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {fb ? (
                        <>
                          <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100 gap-1 border-0">
                            <CheckCircle className="w-2.5 h-2.5" />작성 완료
                          </Badge>
                          {fb.attendance_status && <AttendanceBadge status={fb.attendance_status} />}
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-400 gap-1">
                          <Clock className="w-2.5 h-2.5" />미작성
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-gray-100 space-y-3">
                    {/* 출석 상태 */}
                    <div>
                      <Label className="text-xs font-semibold text-gray-700">출석 상태</Label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {ATTENDANCE_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            onClick={() => setForm({ ...form, attendance_status: opt })}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              form.attendance_status === opt
                                ? opt === "출석" ? "bg-green-600 text-white border-green-600"
                                  : opt === "결석" ? "bg-red-500 text-white border-red-500"
                                  : opt === "지각" ? "bg-yellow-500 text-white border-yellow-500"
                                  : opt === "보강 예정" ? "bg-blue-500 text-white border-blue-500"
                                  : "bg-gray-500 text-white border-gray-500"
                                : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      {!COUNT_LESSON_STATUSES.includes(form.attendance_status) && (
                        <p className="text-xs text-amber-600 mt-1">※ 이 상태는 수업 차시가 증가하지 않습니다.</p>
                      )}
                    </div>

                    {isPresent && (
                      <>
                        <div>
                          <Label className="text-xs font-semibold text-gray-700">오늘 배운 내용</Label>
                          <Textarea
                            value={form.learned_content}
                            onChange={e => setForm({ ...form, learned_content: e.target.value })}
                            placeholder="오늘 배운 내용 입력..."
                            className="mt-1 text-sm h-16 resize-none"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-700">숙제</Label>
                          <Textarea
                            value={form.homework}
                            onChange={e => setForm({ ...form, homework: e.target.value })}
                            placeholder="숙제 입력..."
                            className="mt-1 text-sm h-14 resize-none"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-amber-700">📌 학부모 전달 메모 <span className="text-gray-400 font-normal">(선택)</span></Label>
                          <Textarea
                            value={form.parent_memo}
                            onChange={e => setForm({ ...form, parent_memo: e.target.value })}
                            placeholder="학부모 전달 메모 입력..."
                            className="mt-1 text-sm h-14 resize-none border-amber-200 bg-amber-50"
                          />
                        </div>
                      </>
                    )}
                    {/* 알림 전송 체크박스 */}
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <input
                        type="checkbox"
                        id={`notify-main-${entry.studentId}`}
                        checked={shouldNotify}
                        onChange={e => setShouldNotify(e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <label htmlFor={`notify-main-${entry.studentId}`} className="text-sm text-amber-800 flex items-center gap-1.5 cursor-pointer">
                        <Bell className="w-4 h-4" />
                        저장 시 학생/학부모에게 알림 전송
                      </label>
                    </div>

                    <Button onClick={() => handleSave(entry)} className="w-full bg-blue-600 hover:bg-blue-700">
                      저장 {fb ? "(수정)" : "(신규)"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}