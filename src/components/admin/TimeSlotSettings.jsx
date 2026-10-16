import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit, Clock, GripVertical } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const DURATION_LABELS = { "1hour": "1시간", "2hour": "2시간" };

const emptyForm = { name: "", start_time: "17:00", duration_type: "1hour", is_active: true, order: 0 };

function calcEndTime(startTime, durationType) {
  if (!startTime) return "";
  const [h, m] = startTime.split(":").map(Number);
  const hours = durationType === "2hour" ? 2 : 1;
  const end = new Date(2000, 0, 1, h + hours, m);
  return end.getHours().toString().padStart(2, "0") + ":" + end.getMinutes().toString().padStart(2, "0");
}

export default function TimeSlotSettings() {
  const [slots, setSlots] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  useEffect(() => { loadSlots(); }, []);

  const loadSlots = async () => {
    const data = await base44.entities.TimeSlot.list("order", 100);
    setSlots(data);
  };

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, order: slots.length }); setShowForm(true); };
  const openEdit = (slot) => { setEditing(slot); setForm({ name: slot.name || "", start_time: slot.start_time, duration_type: slot.duration_type, is_active: slot.is_active !== false, order: slot.order || 0 }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.start_time) { toast({ title: "오류", description: "시작 시간을 입력해주세요.", variant: "destructive" }); return; }
    const autoName = form.name || `${form.start_time} ${DURATION_LABELS[form.duration_type]}`;
    const data = { ...form, name: autoName };
    if (editing) {
      await base44.entities.TimeSlot.update(editing.id, data);
      toast({ title: "수정 완료" });
    } else {
      await base44.entities.TimeSlot.create(data);
      toast({ title: "추가 완료" });
    }
    setShowForm(false);
    loadSlots();
  };

  const handleDelete = async (slot) => {
    if (!confirm(`"${slot.name || slot.start_time}" 시간대를 삭제하시겠습니까?`)) return;
    await base44.entities.TimeSlot.delete(slot.id);
    toast({ title: "삭제 완료" });
    loadSlots();
  };

  const toggleActive = async (slot) => {
    await base44.entities.TimeSlot.update(slot.id, { is_active: !slot.is_active });
    loadSlots();
  };

  const endTime = calcEndTime(form.start_time, form.duration_type);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" />시간대 빠른 선택 관리</h3>
          <p className="text-xs text-gray-400 mt-0.5">수업 일정 추가 시 빠르게 선택할 시간대를 관리합니다.</p>
        </div>
        <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5 mr-1" />추가
        </Button>
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>등록된 시간대가 없습니다.</p>
          <p className="text-xs mt-1">추가 버튼을 눌러 시간대를 등록하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map(slot => (
            <div key={slot.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${slot.is_active !== false ? "border-gray-200 bg-gray-50" : "border-gray-100 bg-gray-50/50 opacity-50"}`}>
              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{slot.name || `${slot.start_time} ${DURATION_LABELS[slot.duration_type]}`}</p>
                <p className="text-xs text-gray-500">
                  {slot.start_time} ~ {calcEndTime(slot.start_time, slot.duration_type)} · {DURATION_LABELS[slot.duration_type]}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleActive(slot)}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${slot.is_active !== false ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                >
                  {slot.is_active !== false ? "사용중" : "미사용"}
                </button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(slot)} className="h-7 w-7 p-0">
                  <Edit className="w-3.5 h-3.5 text-gray-400" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(slot)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 폼 */}
      {showForm && (
        <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-3">{editing ? "시간대 수정" : "시간대 추가"}</h4>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">시간대 이름 (선택)</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 오후 5시 1시간 (미입력 시 자동 생성)" className="mt-1 h-8 text-sm bg-white" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs">시작 시간 *</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="mt-1 h-8 text-sm bg-white" />
              </div>
              <div className="flex-1">
                <Label className="text-xs">수업 시간 *</Label>
                <div className="flex gap-2 mt-1">
                  {["1hour", "2hour"].map(d => (
                    <button key={d} onClick={() => setForm({ ...form, duration_type: d })}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${form.duration_type === d ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600"}`}
                    >
                      {DURATION_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {form.start_time && (
              <p className="text-xs text-blue-700">→ {form.start_time} ~ {endTime}</p>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="slot_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="slot_active" className="text-xs">사용 여부</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1 bg-white">취소</Button>
              <Button size="sm" onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700">저장</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}