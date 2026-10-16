import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Users } from "lucide-react";

export default function DayStatsPanel({ selectedDate, schedules }) {
  const [cssRecords, setCssRecords] = useState([]);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const scheduleIds = schedules.map(s => s.id).filter(Boolean);

  useEffect(() => {
    if (!dateStr || scheduleIds.length === 0) { setCssRecords([]); return; }
    // 해당 날짜 모든 수업의 ClassScheduleStudent 조회
    Promise.all(scheduleIds.map(id =>
      base44.entities.ClassScheduleStudent.filter({ schedule_id: id })
    )).then(results => {
      const all = results.flat().filter(c => !c.is_deleted);
      setCssRecords(all);
    });
  }, [dateStr, scheduleIds.join(",")]);

  // 총 학생 수 (is_deleted 아닌 것만)
  const totalStudents = new Set(cssRecords.map(c => c.student_id)).size;

  // 선생님별 학생 수
  const teacherMap = {};
  schedules.forEach(s => {
    if (!s.teacher_name) return;
    const activeIds = cssRecords
      .filter(c => c.schedule_id === s.id)
      .map(c => c.student_id);
    if (!teacherMap[s.teacher_name]) teacherMap[s.teacher_name] = new Set();
    activeIds.forEach(id => teacherMap[s.teacher_name].add(id));
  });

  // 출석 현황 — ClassScheduleStudent.attendance_status 기준
  const attendanceCounts = cssRecords.reduce((acc, c) => {
    const s = c.attendance_status;
    if (s && s !== "미정") acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const hasAttendance = cssRecords.some(c => c.attendance_status && c.attendance_status !== "미정");

  return (
    <div className="p-4 border-b border-gray-200 bg-white">
      <p className="text-xs font-bold text-gray-500 mb-3">
        {format(selectedDate, "M월 d일 (eee)", { locale: ko })} 수업 통계
      </p>

      {schedules.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">수업 없음</p>
      ) : (
        <>
          {/* 총 인원 */}
          <div className="flex items-center gap-2 mb-3 p-2.5 bg-blue-50 rounded-lg">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-blue-700">총 {totalStudents}명</span>
          </div>

          {/* 선생님별 인원 */}
          {Object.keys(teacherMap).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(teacherMap)
                .sort((a, b) => b[1].size - a[1].size)
                .map(([teacher, ids]) => (
                  <div key={teacher} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{teacher}</span>
                    <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-full">{ids.size}명</span>
                  </div>
                ))}
            </div>
          )}

          {/* 출석 현황 (출석 정보 있을 때만) */}
          {hasAttendance && (
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-1 text-center">
              {[
                { label: "출석", color: "text-green-600 bg-green-50" },
                { label: "결석", color: "text-red-500 bg-red-50" },
                { label: "지각", color: "text-yellow-600 bg-yellow-50" },
                { label: "취소", color: "text-gray-500 bg-gray-100" },
              ].map(({ label, color }) => (
                <div key={label} className={`rounded-lg p-1.5 ${color}`}>
                  <p className="text-base font-bold">{attendanceCounts[label] || 0}</p>
                  <p className="text-[10px]">{label}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}