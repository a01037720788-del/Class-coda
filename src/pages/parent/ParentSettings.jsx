import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser, setSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function ParentSettings() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwError, setPwError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    setForm({ name: u?.name || "", phone: u?.phone || "" });
  }, []);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await base44.entities.AppUser.update(user.id, { name: form.name, phone: form.phone });
      const updated = { ...user, name: form.name, phone: form.phone };
      setSessionUser(updated);
      setUser(updated);
      toast({ title: "프로필 저장 완료" });
    } catch (err) {
      toast({ title: "저장 실패", description: err?.message, variant: "destructive" });
    }
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (!pwForm.current_password || !pwForm.new_password) {
      setPwError("현재 비밀번호와 새 비밀번호를 모두 입력해주세요.");
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      const res = await base44.functions.invoke("changeMyPassword", {
        login_id: user.login_id,
        old_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      toast({ title: "비밀번호 변경 완료" });
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setPwError(err?.message || "비밀번호 변경 중 오류가 발생했습니다.");
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">설정</h2>

      {/* 프로필 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">프로필 정보</h3>
        <div className="space-y-4">
          <div>
            <Label>이름</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>전화번호</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1" />
          </div>
          <Button onClick={handleSaveProfile} className="bg-[#7c3aed] hover:bg-[#6d28d9]">저장</Button>
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">비밀번호 변경</h3>
        {pwError && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 mb-4">{pwError}</div>}
        <div className="space-y-4">
          <div>
            <Label>현재 비밀번호</Label>
            <Input type="password" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>새 비밀번호</Label>
            <Input type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>새 비밀번호 확인</Label>
            <Input type="password" value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} className="mt-1" />
          </div>
          <Button onClick={handleChangePassword} className="bg-[#7c3aed] hover:bg-[#6d28d9]">비밀번호 변경</Button>
        </div>
      </div>
    </div>
  );
}