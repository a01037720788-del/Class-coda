import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { format } from "date-fns";

const HOLIDAY_TYPES = ["정기 휴무", "임시 휴무", "학원 행사", "방학", "공휴일"];
const COLOR_OPTIONS = [
  { value: "red", label: "빨강", class: "bg-red-500" },
  { value: "orange", label: "주황", class: "bg-orange-500" },
  { value: "yellow", label: "노랑", class: "bg-yellow-500" },
  { value: "gray", label: "회색", class: "bg-gray-400" },
  { value: "purple", label: "보라", class: "bg-purple-500" },
];

export default function HolidayModal({ defaultDate, user, onSave, onClose }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    holiday_date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
    holiday_type: "임시 휴무",
    color: "red",
    is_closed: true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title || !form.holiday_date) return;
    setSaving(true);
    await base44.entities.AcademyHoliday.create({
      ...form,
      created_by: user?.id,
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">휴무일 추가</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <Label className="text-xs font-semibold text-gray-700">날짜</Label>
          <Input type="date" value={form.holiday_date}
            onChange={e => setForm({ ...form, holiday_date: e.target.value })}
            className="mt-1" />
        </div>

        <div>
          <Label className="text-xs font-semibold text-gray-700">제목 *</Label>
          <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="예: 추석 연휴, 임시 휴원..." className="mt-1" />
        </div>

        <div>
          <Label className="text-xs font-semibold text-gray-700">설명</Label>
          <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="추가 설명 입력..." className="mt-1 h-16 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-gray-700">휴무 유형</Label>
            <Select value={form.holiday_type} onValueChange={v => setForm({ ...form, holiday_type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOLIDAY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-700">색상</Label>
            <div className="flex gap-2 mt-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c.value} onClick={() => setForm({ ...form, color: c.value })}
                  className={`w-7 h-7 rounded-full ${c.class} border-2 transition-all ${
                    form.color === c.value ? "border-gray-800 scale-110" : "border-transparent"
                  }`} title={c.label} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_closed" checked={form.is_closed}
            onChange={e => setForm({ ...form, is_closed: e.target.checked })}
            className="w-4 h-4 rounded" />
          <label htmlFor="is_closed" className="text-sm text-gray-700">휴원 처리 (수업 없음)</label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
          <Button onClick={handleSave} disabled={saving || !form.title || !form.holiday_date}
            className="flex-1 bg-red-500 hover:bg-red-600">
            {saving ? "저장 중..." : "휴무일 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}