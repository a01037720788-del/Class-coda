import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { getSessionToken } from "@/lib/auth";

export default function PasswordChangeModal({ student, open, onClose }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setError("");
    if (!newPassword) { setError("새 비밀번호를 입력해주세요."); return; }
    if (newPassword !== confirmPassword) { setError("비밀번호가 일치하지 않습니다."); return; }

    setLoading(true);
    try {
      // Base44 경로 — AppUser 비밀번호 초기화
      const appUsers = await base44.entities.AppUser.filter({ student_id: student.id });
      let appUserId = null;
      if (appUsers.length > 0) {
        appUserId = appUsers[0].id;
      } else if (student.login_id) {
        const byLogin = await base44.entities.AppUser.filter({ login_id: student.login_id, role: "student" });
        if (byLogin.length > 0) appUserId = byLogin[0].id;
      }
      if (appUserId) {
        await base44.functions.invoke("manageAppUser", {
          action: "resetPassword",
          id: appUserId,
          newPassword,
        });
      }
      await base44.entities.Student.update(student.id, { password: "" });

      toast({ title: "비밀번호 변경 완료", description: `${student.name} 학생의 비밀번호가 변경되었습니다.` });
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || "비밀번호 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>비밀번호 변경 — {student?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>}
          <div>
            <Label>새 비밀번호</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="새 비밀번호"
              className="mt-1"
            />
          </div>
          <div>
            <Label>새 비밀번호 확인</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 확인"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}