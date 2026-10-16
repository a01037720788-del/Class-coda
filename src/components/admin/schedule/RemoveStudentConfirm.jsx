import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const COUNT_LESSON_STATUSES = ["출석", "지각"];

export default function RemoveStudentConfirm({ confirm, onCancel, onConfirm }) {
  if (!confirm) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900">학생 수업 제거</p>
            <p className="text-xs text-gray-500">{confirm.studentName}</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 mb-2">
          이 학생을 해당 날짜의 수업에서 삭제하시겠습니까?
        </p>
        {confirm.hasFeedback && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-xs text-amber-800">
            ⚠️ 이 학생은 이미{confirm.fb?.attendance_status ? ` ${confirm.fb.attendance_status} /` : ""} 피드백
            {COUNT_LESSON_STATUSES.includes(confirm.fb?.attendance_status) ? " / 완료 차시" : ""}가 반영된 상태입니다.<br />
            삭제하면 출석 기록, 피드백 표시{COUNT_LESSON_STATUSES.includes(confirm.fb?.attendance_status) ? ", 완료 차시" : ""}가 함께 정리됩니다.
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">취소</Button>
          <Button onClick={() => onConfirm(confirm.studentId, confirm.studentName)} className="flex-1 bg-red-600 hover:bg-red-700">삭제</Button>
        </div>
      </div>
    </div>
  );
}