import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, PenLine } from "lucide-react";

const DURATION_LABELS = { "1hour": "1시간", "2hour": "2시간" };

function calcEndTime(startTime, durationType) {
  if (!startTime) return "";
  const [h, m] = startTime.split(":").map(Number);
  const hours = durationType === "2hour" ? 2 : 1;
  const end = new Date(2000, 0, 1, h + hours, m);
  return end.getHours().toString().padStart(2, "0") + ":" + end.getMinutes().toString().padStart(2, "0");
}

export default function TimeSlotSelector({ timeSlots, startTime, durationType, onStartTimeChange, onDurationChange, onSelectSlot }) {
  const [manual, setManual] = useState(!!startTime);

  const handleSlotClick = (slot) => {
    onSelectSlot(slot.start_time, slot.duration_type);
    setManual(false);
  };

  return (
    <div>
      <Label className="font-semibold text-gray-800">⑥ 시간대 선택</Label>

      {timeSlots.length > 0 && (
        <div className="mt-2 mb-3">
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />빠른 선택
          </p>
          <div className="flex flex-wrap gap-2">
            {timeSlots.map(slot => {
              const isSelected = startTime === slot.start_time && durationType === slot.duration_type && !manual;
              return (
                <button key={slot.id} onClick={() => handleSlotClick(slot)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    isSelected ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <span className="font-mono">{slot.start_time}</span>
                  <span className="ml-1 text-[10px] opacity-75">/ {DURATION_LABELS[slot.duration_type]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={() => setManual(v => !v)}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
          manual ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"
        }`}
      >
        <PenLine className="w-3 h-3" />직접 입력
      </button>

      {manual && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs text-gray-600">시작 시간</Label>
              <Input type="time" value={startTime} onChange={e => onStartTimeChange(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-gray-600">수업 시간</Label>
              <div className="flex gap-2 mt-1">
                {["1hour", "2hour"].map(d => (
                  <button key={d} onClick={() => onDurationChange(d)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${durationType === d ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600"}`}
                  >
                    {DURATION_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {startTime && (
            <p className="text-xs text-gray-500">{startTime} ~ {calcEndTime(startTime, durationType)} (자동 계산)</p>
          )}
        </div>
      )}

      {startTime && !manual && (
        <p className="text-xs text-blue-700 mt-2 font-medium">
          선택됨: {startTime} ~ {calcEndTime(startTime, durationType)} ({DURATION_LABELS[durationType]})
        </p>
      )}
    </div>
  );
}