import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

/**
 * 삭제 대상 수업들을 soft delete 처리하고 차시 복구까지 수행하는 헬퍼
 */
async function softDeleteSchedules(scheduleIds) {
  const now = new Date().toISOString();

  await Promise.all(
    scheduleIds.map(async (sid) => {
      // 1. ClassScheduleStudent 조회 → soft delete + 차시 복구
      const students = await base44.entities.ClassScheduleStudent.filter({ schedule_id: sid });
      await Promise.all(
        students.map(async (cs) => {
          if (cs.is_deleted) return;
          // 차시 복구
          if (cs.lesson_count_applied) {
            // Enrollment 찾기 (student_id + subject_id 또는 student_name)
            const enrollments = await base44.entities.Enrollment.filter({ student_id: cs.student_id });
            // 가능하면 subject_id 일치, 없으면 첫 번째
            const enrollment = enrollments[0];
            if (enrollment) {
              await base44.entities.Enrollment.update(enrollment.id, {
                completed_lessons: Math.max(0, (enrollment.completed_lessons || 0) - 1),
                remaining_lessons: (enrollment.remaining_lessons || 0) + 1,
              });
            }
          }
          await base44.entities.ClassScheduleStudent.update(cs.id, {
            is_deleted: true,
            deleted_at: now,
          });
        })
      );

      // 2. LessonFeedback soft delete
      const feedbacks = await base44.entities.LessonFeedback.filter({ schedule_id: sid });
      await Promise.all(
        feedbacks.map((fb) =>
          fb.is_deleted
            ? Promise.resolve()
            : base44.entities.LessonFeedback.update(fb.id, { is_deleted: true, deleted_at: now })
        )
      );

      // 3. ClassSchedule soft delete
      await base44.entities.ClassSchedule.update(sid, { is_deleted: true, deleted_at: now });
    })
  );
}

/**
 * 삭제 범위 계산 함수들
 */
function getTargetSchedules(mode, schedule, allSchedules) {
  const notDeleted = allSchedules.filter((s) => !s.is_deleted);

  if (mode === "single") {
    return notDeleted.filter((s) => s.id === schedule.id);
  }

  if (mode === "next") {
    // 같은 학생/과목/선생님 기준으로 현재 이후 가장 가까운 수업 날짜 찾기
    const related = notDeleted.filter(
      (s) =>
        s.id !== schedule.id &&
        s.subject_id === schedule.subject_id &&
        s.teacher_id === schedule.teacher_id &&
        s.student_ids?.some((id) => schedule.student_ids?.includes(id)) &&
        s.class_date > schedule.class_date
    );
    related.sort((a, b) => a.class_date.localeCompare(b.class_date));
    const nextDate = related[0]?.class_date;

    // 현재 날짜 이상 ~ 다음 날짜 미만
    return notDeleted.filter(
      (s) =>
        s.subject_id === schedule.subject_id &&
        s.teacher_id === schedule.teacher_id &&
        s.student_ids?.some((id) => schedule.student_ids?.includes(id)) &&
        s.class_date >= schedule.class_date &&
        (nextDate ? s.class_date < nextDate : s.class_date === schedule.class_date)
    );
  }

  if (mode === "recurring") {
    // 반복 그룹 ID가 있으면 그걸 기준으로, 없으면 같은 학생/과목/선생님 + 날짜 이후
    if (schedule.recurrence_group_id) {
      return notDeleted.filter(
        (s) =>
          s.recurrence_group_id === schedule.recurrence_group_id &&
          s.class_date >= schedule.class_date
      );
    }
    return notDeleted.filter(
      (s) =>
        s.subject_id === schedule.subject_id &&
        s.teacher_id === schedule.teacher_id &&
        s.student_ids?.some((id) => schedule.student_ids?.includes(id)) &&
        s.class_date >= schedule.class_date
    );
  }

  if (mode === "all") {
    // 반복 그룹 전체 또는 같은 학생/과목/선생님 전체
    if (schedule.recurrence_group_id) {
      return notDeleted.filter(
        (s) => s.recurrence_group_id === schedule.recurrence_group_id
      );
    }
    return notDeleted.filter(
      (s) =>
        s.subject_id === schedule.subject_id &&
        s.teacher_id === schedule.teacher_id &&
        s.student_ids?.some((id) => schedule.student_ids?.includes(id))
    );
  }

  // 특정 학생의 모든 수업 삭제
  if (mode === "by_student") {
    const targetStudentIds = schedule.student_ids || [];
    return notDeleted.filter(
      (s) => s.student_ids?.some((id) => targetStudentIds.includes(id))
    );
  }

  // 특정 과목의 모든 수업 삭제
  if (mode === "by_subject") {
    return notDeleted.filter((s) => s.subject_id === schedule.subject_id);
  }

  // 특정 기간 수업 삭제 (fromDate ~ toDate는 schedule에 주입)
  if (mode === "by_period") {
    const { periodFrom, periodTo } = schedule._periodFilter || {};
    if (!periodFrom || !periodTo) return [];
    return notDeleted.filter(
      (s) =>
        s.subject_id === schedule.subject_id &&
        s.teacher_id === schedule.teacher_id &&
        s.class_date >= periodFrom &&
        s.class_date <= periodTo
    );
  }

  return [];
}

const DELETE_OPTIONS = [
  {
    value: "single",
    label: "이 수업만 삭제",
    desc: "선택한 날짜의 수업만 삭제합니다.",
  },
  {
    value: "next",
    label: "이 수업부터 다음 수업까지 삭제",
    desc: "선택한 수업부터 다음 수업 전까지의 관련 수업을 삭제합니다.",
  },
  {
    value: "recurring",
    label: "이 수업 이후 반복 수업 전체 삭제",
    desc: "선택한 수업과 이후 반복 일정을 모두 삭제합니다.",
  },
  {
    value: "all",
    label: "전체 삭제 (반복 그룹)",
    desc: "해당 반복 그룹 또는 관련 수업 전체를 삭제합니다.",
  },
  {
    value: "by_student",
    label: "이 학생의 모든 수업 삭제",
    desc: "선택한 수업의 학생(들)이 포함된 모든 수업을 삭제합니다.",
  },
  {
    value: "by_subject",
    label: "이 과목의 모든 수업 삭제",
    desc: "같은 과목의 모든 수업(모든 날짜, 모든 선생님)을 삭제합니다.",
  },
  {
    value: "by_period",
    label: "특정 기간 수업 삭제",
    desc: "같은 과목/선생님에서 지정한 날짜 범위 내의 수업을 삭제합니다.",
  },
];

const WIDE_MODES = ["recurring", "all", "by_student", "by_subject", "by_period"];

export default function ScheduleDeleteModal({ schedule, allSchedules: initialSchedules, onDeleted, onClose }) {
  const [mode, setMode] = useState("single");
  const [preview, setPreview] = useState([]);
  const [step, setStep] = useState("options"); // "options" | "confirm"
  const [deleting, setDeleting] = useState(false);
  const [allSchedules, setAllSchedules] = useState(initialSchedules || []);
  const [periodFrom, setPeriodFrom] = useState(schedule.class_date || "");
  const [periodTo, setPeriodTo] = useState("");

  // 넓은 범위 삭제 선택 시 전체 일정 로드
  useEffect(() => {
    if (WIDE_MODES.includes(mode) && initialSchedules) {
      base44.entities.ClassSchedule.list("class_date", 2000).then(all => {
        setAllSchedules(all.filter(s => s.is_deleted !== true));
      });
    } else {
      setAllSchedules(initialSchedules || []);
    }
  }, [mode]);

  useEffect(() => {
    // by_period 모드일 때 기간 필터를 schedule에 주입
    const enrichedSchedule = mode === "by_period"
      ? { ...schedule, _periodFilter: { periodFrom, periodTo } }
      : schedule;
    const targets = getTargetSchedules(mode, enrichedSchedule, allSchedules);
    targets.sort((a, b) => a.class_date.localeCompare(b.class_date));
    setPreview(targets);
  }, [mode, schedule, allSchedules, periodFrom, periodTo]);

  const handleNext = () => setStep("confirm");

  const handleDelete = async () => {
    setDeleting(true);
    const ids = preview.map((s) => s.id);
    await softDeleteSchedules(ids);
    setDeleting(false);
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-red-50">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-base">수업 삭제 범위 선택</h2>
            <p className="text-xs text-gray-500">
              {schedule.subject_name} · {schedule.teacher_name} · {schedule.class_date}
            </p>
          </div>
        </div>

        <div className="p-5">
          {step === "options" ? (
            <>
              {/* 삭제 옵션 */}
              <div className="space-y-2 mb-5">
                {DELETE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      mode === opt.value
                        ? "border-red-400 bg-red-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delete-mode"
                      value={opt.value}
                      checked={mode === opt.value}
                      onChange={() => setMode(opt.value)}
                      className="mt-0.5 accent-red-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* 기간 선택 (by_period 모드) */}
              {mode === "by_period" && (
                <div className="flex gap-2 mb-3 items-center">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">시작일</p>
                    <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
                  </div>
                  <span className="text-gray-400 mt-5">~</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">종료일</p>
                    <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
                  </div>
                </div>
              )}

              {/* 미리보기 */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  삭제 예정 수업 ({preview.length}건)
                </p>
                {preview.length === 0 ? (
                  <p className="text-xs text-gray-400">해당하는 수업이 없습니다.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {preview.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs text-gray-700 bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                        <span className="font-medium text-red-600">{s.class_date}</span>
                        <span className="text-gray-400">·</span>
                        <span>{s.student_names?.join(", ") || "-"}</span>
                        <span className="text-gray-400">·</span>
                        <span>{s.subject_name}</span>
                        <span className="text-gray-400">·</span>
                        <span>{s.teacher_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleNext}
                  disabled={preview.length === 0}
                >
                  다음
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* 최종 확인 */}
              <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">삭제를 실행하시겠습니까?</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    총 <strong>{preview.length}개</strong> 수업이 삭제됩니다.
                    연결된 학생들의 출석, 피드백, 차시 반영도 함께 정리됩니다.
                  </p>
                </div>
              </div>

              {/* 미리보기 재확인 */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-600 mb-2">삭제 예정 수업</p>
                <div className="space-y-1">
                  {preview.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs text-gray-700 bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                      <span className="font-medium text-red-600">{s.class_date}</span>
                      <span className="text-gray-400">·</span>
                      <span>{s.student_names?.join(", ") || "-"}</span>
                      <span className="text-gray-400">·</span>
                      <span>{s.subject_name}</span>
                      <span className="text-gray-400">·</span>
                      <span>{s.teacher_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("options")} disabled={deleting}>
                  이전
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-1.5"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />삭제 중...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" />삭제 실행</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}