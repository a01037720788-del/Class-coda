import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { format } from "date-fns";

const TARGET_OPTIONS = ["전체", "관리자", "학생", "부모님"];
const COLOR_OPTIONS = [
  { value: "blue", label: "파랑", class: "bg-blue-500" },
  { value: "red", label: "빨강", class: "bg-red-500" },
  { value: "green", label: "초록", class: "bg-green-500" },
  { value: "yellow", label: "노랑", class: "bg-yellow-500" },
  { value: "purple", label: "보라", class: "bg-purple-500" },
];

export default function NoticeModal({ defaultDate, user, onSave, onClose }) {
  const [form, setForm] = useState({
    title: "",
    content: "",
    notice_date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
    target_type: "전체",
    color: "blue",
    is_public: true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title || !form.notice_date) return;
    setSaving(true);
    await base44.entities.CalendarNotice.create({
      ...form,
      created_by: user?.id,
      created_by_name: user?.name,
    });
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">공지사항 추가</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <Label className="text-xs font-semibold text-gray-700">날짜</Label>
          <Input type="date" value={form.notice_date}
            onChange={e => setForm({ ...form, notice_date: e.target.value })}
            className="mt-1" />
        </div>

        <div>
          <Label className="text-xs font-semibold text-gray-700">제목 *</Label>
          <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="공지 제목 입력..." className="mt-1" />
        </div>

        <div>
          <Label className="text-xs font-semibold text-gray-700">내용</Label>
          <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="공지 내용 입력..." className="mt-1 h-20 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-gray-700">표시 대상</Label>
            <Select value={form.target_type} onValueChange={v => setForm({ ...form, target_type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
          <Button onClick={handleSave} disabled={saving || !form.title || !form.notice_date}
            className="flex-1 bg-amber-500 hover:bg-amber-600">
            {saving ? "저장 중..." : "공지 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}