import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Save, Eye, EyeOff } from "lucide-react";

// 관리자 수업 설명 메모 패널 — Unit별 저장, 학생에게 노출 안 됨
export default function TeacherNotePanel({ unitId, unitType, subjectName, onClose }) {
  const [notes, setNotes] = useState("");
  const [noteId, setNoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(true);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  const loadNote = async () => {
    setLoading(true);
    try {
      const existing = await base44.entities.UnitTeacherNote.filter({ unit_id: unitId });
      if (existing && existing.length > 0) {
        setNotes(existing[0].notes || "");
        setNoteId(existing[0].id);
      } else {
        setNotes("");
        setNoteId(null);
      }
    } catch (err) {
      console.error("[TeacherNotePanel] 메모 로드 실패:", err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = getSessionUser();
      if (noteId) {
        await base44.entities.UnitTeacherNote.update(noteId, {
          notes,
          updated_by: user?.name || "",
        });
      } else {
        const created = await base44.entities.UnitTeacherNote.create({
          unit_id: unitId,
          unit_type: unitType,
          subject_name: subjectName || "",
          notes,
          updated_by: user?.name || "",
        });
        if (created) setNoteId(created.id);
      }
    } catch (err) {
      console.error("[TeacherNotePanel] 메모 저장 실패:", err);
    }
    setSaving(false);
  };

  // 자동 저장 (2초 후)
  const scheduleSave = (val) => {
    setNotes(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => handleSave(), 2000);
  };

  if (!visible) {
    return (
      <div className="w-10 flex flex-col items-center py-3 bg-amber-50 border-l border-amber-200">
        <button onClick={() => setVisible(true)} className="p-2 hover:bg-amber-100 rounded-lg" title="메모 보기">
          <Eye className="w-4 h-4 text-amber-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 flex flex-col bg-amber-50 border-l border-amber-200 flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200 bg-amber-100/50">
        <span className="text-xs font-bold text-amber-800">📝 관리자 메모</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving} className="h-6 px-2 text-xs">
            <Save className="w-3 h-3 mr-1" />
            {saving ? "저장중" : "저장"}
          </Button>
          <button onClick={() => setVisible(false)} className="p-1 hover:bg-amber-200 rounded" title="메모 숨기기">
            <EyeOff className="w-3.5 h-3.5 text-amber-600" />
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => scheduleSave(e.target.value)}
        onBlur={handleSave}
        placeholder="수업 설명 메모를 입력하세요...&#10;&#10;예:&#10;- input은 항상 문자열&#10;- int 변환 설명&#10;- 나이 입력 예제 먼저"
        className="flex-1 w-full p-3 text-sm text-amber-900 bg-transparent resize-none border-0 outline-none placeholder:text-amber-300"
        style={{ fontFamily: "inherit" }}
      />
      {onClose && (
        <button onClick={onClose} className="text-xs text-amber-500 hover:text-amber-700 py-1.5 border-t border-amber-200">
          패널 닫기
        </button>
      )}
    </div>
  );
}