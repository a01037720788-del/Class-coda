import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle, Clock, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import AttendanceBadge from "@/components/common/AttendanceBadge";

const ATTENDANCE_OPTIONS = ["출석", "결석", "지각", "보강 예정", "취소"];
const COUNT_LESSON_STATUSES = ["출석", "지각"];

export default function FeedbackPanel({ selectedDate, schedules }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [cssRecords, setCssRecords] = useState([]); // ClassScheduleStudent records
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [forms, setForms] = useState({});
  const [notifyMap, setNotifyMap] = useState({});
  const { toast } = useToast();

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const scheduleIds = schedules.map(s => s.id).filter(Boolean);
  const scheduleIdsKey = scheduleIds.join(",");

  useEffect(() => {
    if (dateStr) loadData();
    setExpandedEntry(null);
    setForms({});
  }, [dateStr, scheduleIdsKey]);

  useEffect(() => {
    // schedules가 비면 즉시 stale 데이터 정리 (캘린더 초기화 대응)
    if (scheduleIds.length === 0) {
      setCssRecords([]);
      setFeedbacks([]);
    }
  }, [scheduleIdsKey]);

  const loadData = async () => {
    const [fbs, cssAll] = await Promise.all([
      base44.entities.LessonFeedback.filter({ class_date: dateStr }),
      scheduleIds.length > 0
        ? Promise.all(scheduleIds.map(sid => base44.entities.ClassScheduleStudent.filter({ schedule_id: sid }))).then(r => r.flat())
        : Promise.resolve([]),
    ]);
    setFeedbacks(fbs.filter(f => !f.is_deleted));
    setCssRecords(cssAll.filter(c => !c.is_deleted));
  };

  // entries: ClassScheduleStudent 기준으로 생성 (is_deleted 제외)
  const entries = schedules.flatMap(s => {
    const schedCss = cssRecords.filter(c => c.schedule_id === s.id);
    if (schedCss.length > 0) {
      // CSS 레코드가 있으면 CSS 기준
      return schedCss.map(c => ({
        scheduleId: s.id,
        studentId: c.student_id,
        studentName: c.student_name,
        subjectName: s.subject_name,
        lessonNumber: s.lesson_number,
        subjectId: s.subject_id,
        teacherId: s.teacher_id,
        teacherName: s.teacher_name,
        css: c,
      }));
    } else {
      // CSS 레코드 없으면 ClassSchedule.student_ids 기준 (하위호환)
      return (s.student_ids || []).map((studentId, idx) => ({
        scheduleId: s.id,
        studentId,
        studentName: s.student_names?.[idx] || studentId,
        subjectName: s.subject_name,
        lessonNumber: s.lesson_number,
        subjectId: s.subject_id,
        teacherId: s.teacher_id,
        teacherName: s.teacher_name,
        css: null,
      }));
    }
  });

  const getFeedback = (studentId, scheduleId) =>
    feedbacks.find(f => f.student_id === studentId && f.schedule_id === scheduleId);

  const getForm = (key, existing) => forms[key] || {
    attendance_status: existing?.attendance_status || "출석",
    learned_content: existing?.learned_content || "",
    homework: existing?.homework || "",
    parent_memo: existing?.parent_memo || "",
  };

  const updateForm = (key, field, value) =>
    setForms(f => ({ ...f, [key]: { ...getForm(key, null), ...f[key], [field]: value } }));

  const handleToggle = (entry) => {
    const key = entry.studentId + entry.scheduleId;
    if (expandedEntry === key) { setExpandedEntry(null); return; }
    setExpandedEntry(key);
    const existing = getFeedback(entry.studentId, entry.scheduleId);
    // CSS에서 attendance_status 우선
    const cssStatus = entry.css?.attendance_status;
    setForms(f => ({
      ...f,
      [key]: {
        attendance_status: existing?.attendance_status || cssStatus || "출석",
        learned_content: existing?.learned_content || "",
        homework: existing?.homework || "",
        parent_memo: existing?.parent_memo || "",
      }
    }));
    setNotifyMap(n => ({ ...n, [key]: n[key] ?? true }));
  };

  const handleSave = async (entry) => {
    const key = entry.studentId + entry.scheduleId;
    const form = forms[key];
    if (!form) return;
    const existing = getFeedback(entry.studentId, entry.scheduleId);
    const shouldNotify = notifyMap[key] ?? true;

    const wasCountStatus = existing && COUNT_LESSON_STATUSES.includes(existing.attendance_status);
    const willCount = COUNT_LESSON_STATUSES.includes(form.attendance_status);

    // CSS lesson_count_applied 기준으로 차시 중복 차감 방지
    const cssRecord = entry.css || cssRecords.find(c => c.schedule_id === entry.scheduleId && c.student_id === entry.studentId);
    const wasApplied = cssRecord?.lesson_count_applied === true;

    const saveData = {
      ...form,
      student_id: entry.studentId,
      student_name: entry.studentName,
      subject_id: entry.subjectId,
      subject_name: entry.subjectName,
      teacher_id: entry.teacherId,
      teacher_name: entry.teacherName,
      schedule_id: entry.scheduleId,
      class_date: dateStr,
      lesson_number: entry.lessonNumber,
      is_completed: true,
    };

    if (existing) {
      await base44.entities.LessonFeedback.update(existing.id, saveData);
      // 출석→출석 유지: wasApplied=true면 추가 차감 안 함
      if (!wasCountStatus && willCount && !wasApplied) {
        await incrementLesson(entry);
        await updateCssRecord(cssRecord, entry, form.attendance_status, true);
      } else if (wasCountStatus && !willCount && wasApplied) {
        await decrementLesson(entry);
        await updateCssRecord(cssRecord, entry, form.attendance_status, false);
      } else if (willCount && wasApplied) {
        // 이미 차감됨, 출석상태만 업데이트
        await updateCssRecord(cssRecord, entry, form.attendance_status, true);
      } else if (!willCount && !wasApplied) {
        await updateCssRecord(cssRecord, entry, form.attendance_status, false);
      }
    } else {
      await base44.entities.LessonFeedback.create(saveData);
      if (willCount && !wasApplied) {
        await incrementLesson(entry);
        await updateCssRecord(cssRecord, entry, form.attendance_status, true);
      } else {
        await updateCssRecord(cssRecord, entry, form.attendance_status, false);
      }
    }

    if (shouldNotify) {
      base44.functions.invoke("sendFeedbackNotification", {
        studentId: entry.studentId,
        studentName: entry.studentName,
        subjectName: entry.subjectName,
        classDate: dateStr,
        teacherName: entry.teacherName,
        attendanceStatus: form.attendance_status,
        learnedContent: form.learned_content,
        homework: form.homework,
        parentMemo: form.parent_memo,
        notifyChannels: { inApp: true, sms: false, kakao: false },
      });
    }

    toast({ title: "저장 완료", description: `${entry.studentName} 피드백이 저장${shouldNotify ? " · 알림 전송" : ""}되었습니다.` });
    loadData();
  };

  // ClassScheduleStudent 레코드 업데이트 또는 생성
  const updateCssRecord = async (cssRecord, entry, attendanceStatus, lessonCountApplied) => {
    if (cssRecord) {
      await base44.entities.ClassScheduleStudent.update(cssRecord.id, {
        attendance_status: attendanceStatus,
        lesson_count_applied: lessonCountApplied,
        feedback_completed: true,
      });
    } else {
      await base44.entities.ClassScheduleStudent.create({
        schedule_id: entry.scheduleId,
        student_id: entry.studentId,
        student_name: entry.studentName,
        attendance_status: attendanceStatus,
        lesson_count_applied: lessonCountApplied,
        feedback_completed: true,
        is_deleted: false,
      });
    }
  };

  const incrementLesson = async (entry) => {
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
        last_class_date: dateStr,
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-gray-900">수업 피드백</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {selectedDate ? format(selectedDate, "yyyy년 M월 d일 (eee)", { locale: ko }) : "날짜를 선택하세요"}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {entries.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>이 날 수업 일정이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => {
              const key = entry.studentId + entry.scheduleId;
              const fb = getFeedback(entry.studentId, entry.scheduleId);
              const isExpanded = expandedEntry === key;
              const cssStatus = entry.css?.attendance_status;
              const form = forms[key] || {
                attendance_status: fb?.attendance_status || cssStatus || "출석",
                learned_content: fb?.learned_content || "",
                homework: fb?.homework || "",
                parent_memo: fb?.parent_memo || ""
              };
              const isPresent = COUNT_LESSON_STATUSES.includes(form.attendance_status);

              return (
                <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    onClick={() => handleToggle(entry)}
                    className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{entry.studentName}</span>
                        <span className="text-gray-400 text-xs">/</span>
                        <span className="text-gray-600 text-xs">{entry.subjectName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {fb ? (
                          <>
                            <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100 gap-1 border-0">
                              <CheckCircle className="w-2.5 h-2.5" />완료
                            </Badge>
                            {fb.attendance_status && <AttendanceBadge status={fb.attendance_status} />}
                          </>
                        ) : cssStatus ? (
                          <>
                            <Badge variant="outline" className="text-xs text-blue-500 gap-1">출석상태 기록됨</Badge>
                            <AttendanceBadge status={cssStatus} />
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
                    <div className="p-3 border-t border-gray-100 bg-white space-y-3">
                      {/* 출석 상태 */}
                      <div>
                        <Label className="text-xs font-semibold text-gray-700">출석 상태</Label>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {ATTENDANCE_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              onClick={() => updateForm(key, "attendance_status", opt)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
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
                        {!isPresent && (
                          <p className="text-xs text-amber-600 mt-1">※ 이 상태는 수업 차시가 증가하지 않습니다.</p>
                        )}
                      </div>

                      {/* 피드백 필드 (출석/지각인 경우만) */}
                      {isPresent && (
                        <>
                          <div>
                            <Label className="text-xs font-semibold text-gray-700">오늘 배운 내용</Label>
                            <Textarea
                              value={form.learned_content}
                              onChange={e => updateForm(key, "learned_content", e.target.value)}
                              placeholder="오늘 배운 내용 입력..."
                              className="mt-1 text-sm h-16 resize-none"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-gray-700">숙제</Label>
                            <Textarea
                              value={form.homework}
                              onChange={e => updateForm(key, "homework", e.target.value)}
                              placeholder="숙제 입력..."
                              className="mt-1 text-sm h-14 resize-none"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-amber-700">📌 학부모 전달 메모 <span className="text-gray-400 font-normal">(선택)</span></Label>
                            <Textarea
                              value={form.parent_memo}
                              onChange={e => updateForm(key, "parent_memo", e.target.value)}
                              placeholder="학부모 전달 메모 입력..."
                              className="mt-1 text-sm h-14 resize-none border-amber-200 bg-amber-50"
                            />
                          </div>
                        </>
                      )}

                      {/* 알림 전송 체크박스 */}
                      <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                        <input
                          type="checkbox"
                          id={`notify-${key}`}
                          checked={notifyMap[key] ?? true}
                          onChange={e => setNotifyMap(n => ({ ...n, [key]: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <label htmlFor={`notify-${key}`} className="text-xs text-amber-800 flex items-center gap-1.5 cursor-pointer">
                          <Bell className="w-3.5 h-3.5" />
                          저장 시 학생/학부모에게 알림 전송
                        </label>
                      </div>

                      <Button onClick={() => handleSave(entry)} className="w-full bg-blue-600 hover:bg-blue-700 text-sm">
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
    </div>
  );
}