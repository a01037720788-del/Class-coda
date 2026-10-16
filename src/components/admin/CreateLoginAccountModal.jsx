import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getSessionToken, getSessionUser } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";

// 기존 students row에 로그인 계정(app_users)을 생성/연결하는 모달.
// 새 Student를 만들지 않고 기존 students.id를 app_users.student_id에 연결한다.
// 서버 RPC admin_create_student_login_account가 Case A/B/C를 처리한다.
export default function CreateLoginAccountModal({ student, open, onClose, onCreated }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      // students.login_id가 있으면 기본값으로 제안
      setLoginId(student?.login_id || "");
      setPassword("");
      setError("");
    }
  }, [open, student]);

  const handleCreate = async () => {
    setError("");
    if (!loginId.trim()) { setError("로그인 아이디를 입력해주세요."); return; }
    if (!password.trim()) { setError("비밀번호를 입력해주세요."); return; }
    if (!student?.id) { setError("학생 ID가 없습니다."); return; }

    const token = getSessionToken();
    const user = getSessionUser();
    if (!token) { setError("로그인 세션이 만료되었습니다."); return; }

    setSaving(true);
    try {
      // 서버 RPC 호출 — Case A/B/C 중복 처리를 서버에서 수행
      // caller_login_id를 함께 전달하여 verify_session 실패 시에도 관리자 폴백 검증 (adminCreateStudent와 동일 패턴)
      const res = await base44.functions.invoke("createStudentLoginAccount", {
        session_token: token,
        caller_login_id: user?.login_id || null,
        student_id: student.id,
        login_id: loginId.trim(),
        password: password.trim(),
      });
      const data = res?.data || res;

      if (!data?.success) {
        const msg = data?.error || "계정 생성 중 오류가 발생했습니다.";
        setError(msg);
        toast({ title: "계정 생성 실패", description: msg, variant: "destructive" });
        return;
      }

      toast({
        title: "계정 생성 완료",
        description: `${data.student_name || student.name} 학생의 로그인 계정이 생성/연결되었습니다. (ID: ${data.login_id})`,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      const msg = err?.message || "계정 생성 중 오류가 발생했습니다.";
      setError(msg);
      toast({ title: "계정 생성 실패", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            로그인 계정 생성
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>
          )}

          {/* 학생 정보 표시 */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <p className="text-gray-700"><span className="text-gray-500">학생 이름:</span> <span className="font-semibold">{student?.name}</span></p>
            <p className="text-gray-500 text-xs font-mono break-all">Student ID: {student?.id}</p>
          </div>

          <div>
            <Label>로그인 ID *</Label>
            <Input
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              placeholder="student01"
              className="mt-1"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              {student?.login_id
                ? "students에 저장된 아이디를 기본값으로 불러왔습니다."
                : "새 로그인 아이디를 입력하세요."}
            </p>
          </div>
          <div>
            <Label>초기 비밀번호 *</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="초기 비밀번호"
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">학생은 첫 로그인 후 비밀번호를 변경할 수 있습니다.</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-700">
            기존 학생 정보는 그대로 유지되며, 로그인 계정만 생성되어 연결됩니다.
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>취소</Button>
            <Button onClick={handleCreate} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={saving}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />생성 중...</>
              ) : (
                "계정 생성"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}