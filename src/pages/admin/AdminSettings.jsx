import React, { useEffect, useState } from "react";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { listAppUsers, createAppUser, updateAppUser, resetAppUserPassword, deleteAppUser } from "@/lib/dataAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Shield, RefreshCw, User, Clock, Calendar, Code, Database } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TimeSlotSettings from "@/components/admin/TimeSlotSettings";
import GoogleCalendarSettings from "@/components/admin/GoogleCalendarSettings";
import { useEditorSettings } from "@/hooks/useEditorSettings";
import EditorSettingsPanel from "@/components/common/EditorSettingsPanel";
import UnitMigrationPanel from "@/components/admin/UnitMigrationPanel";

const emptyForm = { name: "", login_id: "", password: "", confirm_password: "", role: "admin", is_active: true, must_change_password: false };

export default function AdminSettings() {
  const [tab, setTab] = useState("admins");
  const [currentUser, setCurrentUser] = useState(null);
  const { settings: editorSettings, saveSettings: saveEditorSettings } = useEditorSettings(null);
  const [admins, setAdmins] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const u = getSessionUser();
    if (!isSuperAdmin(u)) { window.location.href = "/admin/dashboard"; return; }
    setCurrentUser(u);
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      const allUsers = await listAppUsers();
      setAdmins((allUsers || []).filter(u => u.role === "admin" || u.role === "teacher" || u.role === "super_admin"));
    } catch {
      setAdmins([]);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEdit = (admin) => {
    setEditing(admin);
    setForm({ name: admin.name, login_id: admin.login_id, password: "", confirm_password: "", role: admin.role || "admin", is_active: admin.is_active !== false, must_change_password: admin.must_change_password || false });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) { setError("이름을 입력해주세요."); return; }
    if (!form.login_id.trim()) { setError("아이디를 입력해주세요."); return; }
    if (!editing && !form.password) { setError("비밀번호를 입력해주세요."); return; }
    if (form.password && form.password !== form.confirm_password) {
      setError("비밀번호가 일치하지 않습니다."); return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updateData = {
          name: form.name,
          login_id: form.login_id,
          role: form.role,
          is_active: form.is_active,
          must_change_password: form.must_change_password,
        };
        await updateAppUser(editing.id, updateData);
        if (form.password) {
          await resetAppUserPassword(editing.id, form.password);
        }
        toast({ title: "수정 완료", description: "계정 정보가 수정되었습니다." });
      } else {
        await createAppUser({
          name: form.name,
          login_id: form.login_id,
          password: form.password,
          role: form.role,
          is_active: form.is_active,
          must_change_password: form.must_change_password,
        });
        toast({ title: "등록 완료", description: "계정이 추가되었습니다." });
      }
      setShowForm(false);
      loadAdmins();
    } catch (err) {
      const msg = err?.message || "저장 중 오류가 발생했습니다.";
      setError(msg);
      toast({ title: "저장 실패", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin) => {
    if (!confirm(`"${admin.name}" 관리자를 삭제하시겠습니까?`)) return;
    try {
      await deleteAppUser(admin.id);
      toast({ title: "삭제 완료" });
      loadAdmins();
    } catch (err) {
      toast({ title: "삭제 실패", description: err?.message, variant: "destructive" });
    }
  };

  const handleResetPassword = async (admin) => {
    const newPw = prompt(`"${admin.name}" 계정의 새 비밀번호를 입력하세요:`);
    if (!newPw) return;
    try {
      await resetAppUserPassword(admin.id, newPw);
      toast({ title: "비밀번호 초기화 완료" });
    } catch (err) {
      toast({ title: "초기화 실패", description: err?.message, variant: "destructive" });
    }
  };

  const toggleActive = async (admin) => {
    try {
      await updateAppUser(admin.id, { is_active: !admin.is_active });
      loadAdmins();
    } catch (err) {
      toast({ title: "상태 변경 실패", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">설정</h2>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("admins")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "admins" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Shield className="w-4 h-4" />관리자 계정
        </button>
        <button
          onClick={() => setTab("timeslots")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "timeslots" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Clock className="w-4 h-4" />시간대 관리
        </button>
        <button
          onClick={() => setTab("editor")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "editor" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Code className="w-4 h-4" />코드 에디터
        </button>
        <button
          onClick={() => setTab("google")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "google" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Calendar className="w-4 h-4" />Google Calendar
        </button>
        <button
          onClick={() => setTab("migration")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "migration" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Database className="w-4 h-4" />데이터 이전
        </button>
      </div>

      {tab === "editor" && (
        <div className="max-w-2xl">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900">코드 에디터 설정</h3>
            <p className="text-sm text-gray-500 mt-1">이 PC에서의 에디터 테마 및 설정을 변경합니다.</p>
          </div>
          <EditorSettingsPanel settings={editorSettings} onSave={saveEditorSettings} />
        </div>
      )}

      {tab === "timeslots" && (
        <div className="max-w-xl">
          <TimeSlotSettings />
        </div>
      )}

      {tab === "google" && (
        <div className="max-w-2xl">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900">Google Calendar 연동 설정</h3>
            <p className="text-sm text-gray-500 mt-1">수업 일정으로 사용할 Google 캘린더를 선택하고 동기화합니다.</p>
          </div>
          <GoogleCalendarSettings />
        </div>
      )}

      {tab === "migration" && (
        <div className="max-w-3xl">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900">Unit 데이터 이전</h3>
            <p className="text-sm text-gray-500 mt-1">
              다른 Base44 프로젝트로 Unit 데이터를 Export/Import 합니다. 모든 Unit 콘텐츠가 그대로 보존됩니다.
            </p>
          </div>
          <UnitMigrationPanel />
        </div>
      )}

      {tab === "admins" && (
      <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">관리자/선생님 계정 관리</h3>
          <p className="text-gray-500 text-sm mt-1">총 {admins.length}명</p>
        </div>
        <Button onClick={openAdd} className="bg-[#7c3aed] hover:bg-[#6d28d9]">
          <Plus className="w-4 h-4 mr-2" />관리자 추가
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">이름</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">아이디</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">역할</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {admins.map(a => (
              <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#7c3aed]/10 rounded-full flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-[#7c3aed]" />
                    </div>
                    <span className="font-medium text-gray-900 text-sm">{a.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-gray-600">{a.login_id}</td>
                <td className="px-4 py-3">
                  <Badge className={a.role === "super_admin" ? "bg-purple-100 text-purple-700 hover:bg-purple-100 border-0" : a.role === "teacher" ? "bg-green-100 text-green-700 hover:bg-green-100 border-0" : "bg-blue-100 text-blue-700 hover:bg-blue-100 border-0"}>
                    {a.role === "super_admin" ? "총 관리자" : a.role === "teacher" ? "선생님" : "관리자"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(a)}>
                    <Badge className={a.is_active !== false ? "bg-green-100 text-green-700 hover:bg-green-100 border-0" : "bg-gray-100 text-gray-500 hover:bg-gray-100 border-0"}>
                      {a.is_active !== false ? "활성" : "비활성"}
                    </Badge>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)} className="h-7 w-7 p-0" title="수정">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleResetPassword(a)} className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50" title="비밀번호 초기화">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(a)} className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" title="삭제">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">등록된 관리자가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "계정 수정" : "계정 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>}
            <div>
              <Label>관리자 이름 *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 송정훈" className="mt-1" />
            </div>
            <div>
              <Label>아이디 *</Label>
              <Input value={form.login_id} onChange={e => setForm({ ...form, login_id: e.target.value })} placeholder="예: teacher01" className="mt-1" />
            </div>
            <div>
              <Label>{editing ? "새 비밀번호 (변경 시에만 입력)" : "비밀번호 *"}</Label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="비밀번호" className="mt-1" />
            </div>
            <div>
              <Label>비밀번호 확인</Label>
              <Input type="password" value={form.confirm_password} onChange={e => setForm({ ...form, confirm_password: e.target.value })} placeholder="비밀번호 확인" className="mt-1" />
            </div>
            <div>
              <Label>역할</Label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="mt-1 w-full text-sm border border-input rounded-md px-3 py-2 bg-white"
              >
                <option value="admin">관리자 (admin)</option>
                <option value="teacher">선생님 (teacher)</option>
                {isSuperAdmin(currentUser) && <option value="super_admin">총 관리자 (super_admin)</option>}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active_admin" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="is_active_admin">활성화</Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="must_change_password" checked={form.must_change_password} onChange={e => setForm({ ...form, must_change_password: e.target.checked })} />
              <Label htmlFor="must_change_password">최초 로그인 시 비밀번호 변경 강제</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1" disabled={saving}>취소</Button>
              <Button onClick={handleSave} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9]" disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}