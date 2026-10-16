import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addWeeks } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

import StudentSelector from "@/components/admin/schedule/StudentSelector";
import TeacherSelector from "@/components/admin/schedule/TeacherSelector";
import TimeSlotSelector from "@/components/admin/schedule/TimeSlotSelector";
import RepeatScheduleSelector from "@/components/admin/schedule/RepeatScheduleSelector";
import RemoveStudentConfirm from "@/components/admin/schedule/RemoveStudentConfirm";

const COUNT_LESSON_STATUSES = ["출석", "지각"];

function calcEndTime(startTime, durationType) {
  if (!startTime) return "";
  const [h, m] = startTime.split(":").map(Number);
  const hours = durationType === "2hour" ? 2 : 1;
  const end = new Date(2000, 0, 1, h + hours, m);
  return end.getHours().toString().padStart(2, "0") + ":" + end.getMinutes().toString().padStart(2, "0");
}

export default function ScheduleModal({ schedule, defaultDate, onSave, onClose }) {
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [form, setForm] = useState({
    class_date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
    start_time: "",
    subject_id: "",
    subject_name: "",
    teacher_id: "",
    teacher_name: "",
    schedule_type: "single",
    duration_type: "1hour",
    repeat_end_date: "",
    lesson_number: "",
    notes: "",
    student_ids: [],
    student_names: [],
  });
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      base44.entities.Subject.list(),
      base44.entities.Student.filter({ is_active: true }, "name"),
      base44.entities.AppUser.filter({ role: "admin" }),
      base44.entities.TimeSlot.list("order", 100),
    ]).then(([subjs, studs, admins, slots]) => {
      setSubjects(subjs.filter(s => s.is_active !== false));
      setStudents(studs);
      setTeachers(admins);
      setTimeSlots(slots.filter(s => s.is_active !== false));
    });

    if (schedule) {
      setForm({
        class_date: schedule.class_date || "",
        start_time: schedule.start_time || "",
        subject_id: schedule.subject_id || "",
        subject_name: schedule.subject_name || "",
        teacher_id: schedule.teacher_id || "",
        teacher_name: schedule.teacher_name || "",
        schedule_type: schedule.schedule_type || "single",
        duration_type: schedule.duration_type || "1hour",
        repeat_end_date: schedule.repeat_end_date || "",
        lesson_number: schedule.lesson_number || "",
        notes: schedule.notes || "",
        student_ids: schedule.student_ids || [],
        student_names: schedule.student_names || [],
      });
    }
  }, []);

  const toggleStudent = (student) => {
    const ids = form.student_ids;
    const names = form.student_names;
    if (ids.includes(student.id)) {
      setForm({ ...form, student_ids: ids.filter(id => id !== student.id), student_names: names.filter(n => n !== student.name) });
    } else {
      setForm({ ...form, student_ids: [...ids, student.id], student_names: [...names, student.name] });
    }
  };

  const handleRemoveClick = async (studentId, studentName) => {
    if (!schedule?.id) {
      setForm(f => ({
        ...f,
        student_ids: f.student_ids.filter(id => id !== studentId),
        student_names: f.student_names.filter(n => n !== studentName),
      }));
      return;
    }
    const existingFbs = await base44.entities.LessonFeedback.filter({ schedule_id: schedule.id, student_id: studentId });
    const activeFb = existingFbs.find(f => !f.is_deleted);
    setRemoveConfirm({ studentId, studentName, hasFeedback: !!activeFb, fb: activeFb });
  };

  const removeStudentWithCleanup = async (studentId, studentName) => {
    setForm(f => ({
      ...f,
      student_ids: f.student_ids.filter(id => id !== studentId),
      student_names: f.student_names.filter(n => n !== studentName),
    }));

    if (schedule?.id) {
      const [existingFbs, cssRecords] = await Promise.all([
        base44.entities.LessonFeedback.filter({ schedule_id: schedule.id, student_id: studentId }),
        base44.entities.ClassScheduleStudent.filter({ schedule_id: schedule.id, student_id: studentId }),
      ]);

      for (const css of cssRecords) {
        if (css.is_deleted) continue;
        if (css.lesson_count_applied) {
          const enrollments = await base44.entities.Enrollment.filter({ student_id: studentId });
          const enr = enrollments.find(e =>
            schedule.subject_id ? e.subject_id === schedule.subject_id : e.subject_name === schedule.subject_name
          );
          if (enr && (enr.completed_lessons || 0) > 0) {
            const newCompleted = (enr.completed_lessons || 0) - 1;
            const remaining = (enr.paid_lessons || 0) - newCompleted;
            await base44.entities.Enrollment.update(enr.id, {
              completed_lessons: newCompleted,
              remaining_lessons: remaining,
              repayment_needed: remaining <= 0 && (enr.paid_lessons || 0) > 0,
            });
          }
        }
        await base44.entities.ClassScheduleStudent.update(css.id, {
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          attendance_status: null,
          feedback_completed: false,
          lesson_count_applied: false,
        });
      }

      for (const fb of existingFbs) {
        if (fb.is_deleted) continue;
        await base44.entities.LessonFeedback.update(fb.id, { is_deleted: true, deleted_at: new Date().toISOString() });
      }
    }
    setRemoveConfirm(null);
  };

  const handleSubjectChange = (subjectId) => {
    const subject = subjects.find(s => s.id === subjectId);
    setForm({ ...form, subject_id: subjectId, subject_name: subject?.name || "" });
  };

  const handleTeacherChange = (teacherId) => {
    const teacher = teachers.find(t => t.id === teacherId);
    setForm({ ...form, teacher_id: teacherId, teacher_name: teacher?.name || "" });
  };

  const createCssForSchedule = async (scheduleId, studentIds, studentNames) => {
    await Promise.all(studentIds.map((sid, idx) =>
      base44.entities.ClassScheduleStudent.create({
        schedule_id: scheduleId,
        student_id: sid,
        student_name: studentNames[idx] || sid,
        attendance_status: "미정",
        feedback_completed: false,
        lesson_count_applied: false,
        is_deleted: false,
      })
    ));
  };

  const createSingleSchedule = async (data) => {
    const created = await base44.entities.ClassSchedule.create(data);
    if (!created?.id) throw new Error("수업 일정 생성 실패");
    try {
      await createCssForSchedule(created.id, data.student_ids || [], data.student_names || []);
    } catch {
      await base44.entities.ClassSchedule.delete(created.id).catch(() => {});
      throw new Error("학생 데이터 생성 실패로 일정이 취소되었습니다.");
    }
  };

  const createWeeklySchedules = async (data) => {
    const startDate = new Date(data.class_date);
    const endDate = data.repeat_end_date
      ? new Date(data.repeat_end_date)
      : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    // 반복 그룹 ID 생성 (같은 반복 수업끼리 동일한 값)
    const recurrenceGroupId = `weekly_${data.subject_id || data.subject_name}_${(data.student_ids || []).join("_")}_${data.class_date}`;
    let current = startDate;
    while (current <= endDate) {
      const created = await base44.entities.ClassSchedule.create({
        ...data,
        class_date: format(current, "yyyy-MM-dd"),
        recurrence_group_id: recurrenceGroupId,
      });
      if (created?.id) {
        await createCssForSchedule(created.id, data.student_ids || [], data.student_names || []);
      }
      current = addWeeks(current, 1);
    }
  };

  const handleSave = async () => {
    if (!form.class_date) { toast({ title: "오류", description: "날짜를 선택해주세요.", variant: "destructive" }); return; }
    if (!form.subject_name) { toast({ title: "오류", description: "과목을 선택해주세요.", variant: "destructive" }); return; }
    if (form.student_ids.length === 0) { toast({ title: "오류", description: "학생을 한 명 이상 선택해주세요.", variant: "destructive" }); return; }

    const saveData = {
      ...form,
      end_time: calcEndTime(form.start_time, form.duration_type),
      lesson_number: form.lesson_number ? Number(form.lesson_number) : undefined,
    };

    if (schedule) {
      await base44.entities.ClassSchedule.update(schedule.id, saveData);
      const existingCss = await base44.entities.ClassScheduleStudent.filter({ schedule_id: schedule.id });
      const existingStudentIds = new Set(existingCss.map(c => c.student_id));
      const newStudents = (saveData.student_ids || []).filter(sid => !existingStudentIds.has(sid));
      if (newStudents.length > 0) {
        await Promise.all(newStudents.map(sid => {
          const idx = (saveData.student_ids || []).indexOf(sid);
          return base44.entities.ClassScheduleStudent.create({
            schedule_id: schedule.id,
            student_id: sid,
            student_name: (saveData.student_names || [])[idx] || sid,
            attendance_status: "미정",
            feedback_completed: false,
            lesson_count_applied: false,
            is_deleted: false,
          });
        }));
      }
      toast({ title: "수정 완료" });
    } else {
      if (form.schedule_type === "weekly") {
        await createWeeklySchedules(saveData);
        toast({ title: "반복 일정 추가 완료", description: "매주 반복 일정이 생성되었습니다." });
      } else {
        await createSingleSchedule(saveData);
        toast({ title: "일정 추가 완료" });
      }
    }
    onSave();
  };

  const selectedStudentsData = students.filter(s => form.student_ids.includes(s.id));
  const enrolledSubjectNames = [...new Set(selectedStudentsData.flatMap(s => s.subjects || []))];
  const sortedSubjects = [
    ...subjects.filter(s => enrolledSubjectNames.includes(s.name)),
    ...subjects.filter(s => !enrolledSubjectNames.includes(s.name)),
  ];

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{schedule ? "수업 일정 수정" : "수업 일정 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-4">

            {/* 1. 학생 선택 */}
            <StudentSelector
              students={students}
              selectedIds={form.student_ids}
              selectedNames={form.student_names}
              onToggle={toggleStudent}
              onRemove={handleRemoveClick}
            />

            {/* 2. 과목 */}
            <div>
              <Label className="font-semibold text-gray-800">② 수업 과목 *</Label>
              <Select value={form.subject_id} onValueChange={handleSubjectChange}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="과목 선택" /></SelectTrigger>
                <SelectContent>
                  {enrolledSubjectNames.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-gray-400 font-semibold">수강 중인 과목</div>
                      {sortedSubjects.filter(s => enrolledSubjectNames.includes(s.name)).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ★</SelectItem>
                      ))}
                      <div className="px-2 py-1 text-xs text-gray-400 font-semibold border-t mt-1 pt-1">기타 과목</div>
                    </>
                  )}
                  {sortedSubjects.filter(s => !enrolledSubjectNames.includes(s.name)).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. 선생님 */}
            <TeacherSelector teachers={teachers} value={form.teacher_id} onChange={handleTeacherChange} />

            {/* 4. 일정 유형 */}
            <RepeatScheduleSelector
              scheduleType={form.schedule_type}
              repeatEndDate={form.repeat_end_date}
              onScheduleTypeChange={v => setForm({ ...form, schedule_type: v })}
              onRepeatEndDateChange={v => setForm({ ...form, repeat_end_date: v })}
            />

            {/* 5. 날짜 */}
            <div>
              <Label className="font-semibold text-gray-800">⑤ 날짜 *</Label>
              <Input type="date" value={form.class_date} onChange={e => setForm({ ...form, class_date: e.target.value })} className="mt-1.5" />
            </div>

            {/* 6. 시간대 */}
            <TimeSlotSelector
              timeSlots={timeSlots}
              startTime={form.start_time}
              durationType={form.duration_type}
              onStartTimeChange={v => setForm({ ...form, start_time: v })}
              onDurationChange={v => setForm({ ...form, duration_type: v })}
              onSelectSlot={(st, dt) => setForm({ ...form, start_time: st, duration_type: dt })}
            />

            {/* 7. 메모 */}
            <div>
              <Label className="font-semibold text-gray-800">⑦ 메모</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="수업 메모" className="mt-1.5" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
              <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700">저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RemoveStudentConfirm
        confirm={removeConfirm}
        onCancel={() => setRemoveConfirm(null)}
        onConfirm={removeStudentWithCleanup}
      />
    </>
  );
}