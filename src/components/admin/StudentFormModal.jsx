import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { SIMPLE_SUBJECTS } from "@/lib/subjects";

const EMPTY = {
  name: "", login_id: "", password: "", grade: "", school_name: "",
  is_active: true, subjects: [],
};

export default function StudentFormModal({ open, onClose, student, onSubmit, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const isEdit = !!student;

  useEffect(() => {
    if (!open) return;
    setError("");
    setNewPassword("");
    setForm(student ? {
      name: student.name || "",
      login_id: student.login_id || "",
      password: "",
      grade: student.grade || "",
      school_name: student.school_name || "",
      is_active: student.is_active !== false,
      subjects: student.subjects || [],
    } : EMPTY);
  }, [open, student]);

  const toggleSubject = (name) => {
    setForm(f => f.subjects.includes(name)
      ? { ...f, subjects: f.subjects.filter(s => s !== name) }
      : { ...f, subjects: [...f.subjects, name] });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("학생 이름을 입력해주세요."); return; }
    if (!form.login_id.trim()) { setError("로그인 아이디를 입력해주세요."); return; }
    if (!isEdit && !form.password) { setError("초기 비밀번호를 입력해주세요."); return; }
    if (form.subjects.length === 0) { setError("수강 과목을 하나 이상 선택해주세요."); return; }
    onSubmit({ ...form, newPassword: isEdit ? newPassword : undefined });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "학생 정보 수정" : "학생 추가"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "학생 정보와 수강 과목을 수정합니다." : "로그인 계정과 함께 학생을 등록합니다."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

          <div>
            <Label>학생 이름 <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동" className="mt-1" autoFocus />
          </div>

          <div>
            <Label>로그인 아이디 <span className="text-red-500">*</span></Label>
            <Input value={form.login_id} onChange={e => setForm({ ...form, login_id: e.target.value })}
              placeholder="student01" className="mt-1" />
          </div>

          {isEdit ? (
            <div>
              <Label>비밀번호 초기화 <span className="text-gray-400 font-normal">(변경 시에만 입력)</span></Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="새 비밀번호" className="mt-1" />
            </div>
          ) : (
            <div>
              <Label>초기 비밀번호 <span className="text-red-500">*</span></Label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="초기 비밀번호" className="mt-1" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>학교명 <span className="text-gray-400 font-normal">(선택)</span></Label>
              <Input value={form.school_name} onChange={e => setForm({ ...form, school_name: e.target.value })}
                placeholder="○○초등학교" className="mt-1" />
            </div>
            <div>
              <Label>학년 <span className="text-gray-400 font-normal">(선택)</span></Label>
              <Input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}
                placeholder="중2" className="mt-1" />
            </div>
          </div>

          <div>
            <Label>수강 과목 <span className="text-red-500">*</span></Label>
            <div className="mt-2 space-y-2">
              {SIMPLE_SUBJECTS.map(sub => {
                const checked = form.subjects.includes(sub.name);
                return (
                  <label key={sub.key}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      checked ? "border-violet-300 bg-violet-50" : "border-gray-200 hover:bg-gray-50"
                    }`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleSubject(sub.name)}
                      className="w-4 h-4 rounded border-gray-300 accent-violet-600" />
                    <span className="text-sm text-gray-800">{sub.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 accent-violet-600" />
              <span className="text-sm text-gray-800">계정 활성화 <span className="text-gray-400">(해제 시 로그인 불가)</span></span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>취소</Button>
            <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {isEdit ? "저장" : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}