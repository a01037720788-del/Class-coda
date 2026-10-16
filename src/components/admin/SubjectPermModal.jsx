import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { updateStudent } from "@/lib/dataAccess";

/**
 * 과목 권한 설정 모달
 * subject_permissions 구조: { [subjectId]: true/false, ... }
 * 하위 호환: 기존 subject_name 키도 유지
 */
export default function SubjectPermModal({ student, subjects, open, onClose, onSaved }) {
  const [perms, setPerms] = useState(() => ({ ...(student?.subject_permissions || {}) }));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // subject_id 또는 subject_name 기준으로 현재 ON/OFF 판단
  const isOn = (subject) => {
    // subject_id 우선
    if (perms[subject.id] !== undefined) return perms[subject.id] === true;
    // fallback: subject_name (기존 데이터 호환)
    if (perms[subject.name] !== undefined) return perms[subject.name] === true;
    return false;
  };

  const toggle = (subject) => {
    const current = isOn(subject);
    setPerms(prev => ({
      ...prev,
      [subject.id]: !current,
      // 기존 name 키도 동기화 (하위 호환)
      [subject.name]: !current,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateStudent(student.id, { subject_permissions: perms });
      toast({ title: "저장 완료", description: `${student.name} 학생의 과목 권한이 저장되었습니다.` });
      onSaved(perms);
      onClose();
    } catch (err) {
      toast({ title: "저장 실패", description: err?.message || "권한 저장 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // 활성 과목 수
  const onCount = subjects.filter(s => isOn(s)).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{student?.name} 학생 과목 권한 설정</DialogTitle>
        </DialogHeader>
        <div className="mt-3 space-y-2">
          {subjects.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">등록된 과목이 없습니다.</p>
          )}
          {subjects.map(subject => {
            const on = isOn(subject);
            return (
              <div key={subject.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-sm font-medium text-gray-800">{subject.name}</span>
                <button
                  onClick={() => toggle(subject)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    on
                      ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                      : "bg-gray-100 border-gray-300 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {on ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {on ? "ON" : "OFF"}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1">ON인 과목만 학생 메뉴에 표시됩니다. ({onCount}개 활성)</p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}