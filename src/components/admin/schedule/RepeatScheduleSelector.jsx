import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const OPTIONS = [
  { value: "single", label: "단일 일정" },
  { value: "weekly", label: "매주 반복" },
];

export default function RepeatScheduleSelector({ scheduleType, repeatEndDate, onScheduleTypeChange, onRepeatEndDateChange }) {
  return (
    <div>
      <Label className="font-semibold text-gray-800">④ 일정 유형</Label>
      <div className="flex gap-3 mt-1.5">
        {OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => onScheduleTypeChange(opt.value)}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${scheduleType === opt.value ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {scheduleType === "weekly" && (
        <div className="mt-2">
          <Label className="text-xs text-gray-500">반복 종료일 (미입력 시 3개월)</Label>
          <Input type="date" value={repeatEndDate} onChange={e => onRepeatEndDateChange(e.target.value)} className="mt-1 h-9" />
        </div>
      )}
    </div>
  );
}