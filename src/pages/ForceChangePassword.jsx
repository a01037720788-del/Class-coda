import React, { useState, useEffect } from "react";
import { getSessionToken, getSessionUser, setSessionUser } from "@/lib/auth";
import { base44 } from "@/api/base44Client";
import { Lock, Loader2, Code2, Eye, EyeOff, ShieldAlert } from "lucide-react";

export default function ForceChangePassword() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = getSessionToken();
    const cachedUser = getSessionUser();
    if (cachedUser) {
      setUser(cachedUser);
    } else if (!token) {
      window.location.href = "/login";
    }
  }, []);

  const redirectByRole = (role) => {
    if (role === "super_admin" || role === "admin" || role === "teacher") {
      window.location.href = "/admin/dashboard";
    } else if (role === "student") {
      window.location.href = "/student/home";
    } else if (role === "parent") {
      window.location.href = "/parent/home";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 4) {
      setError("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword === oldPassword) {
      setError("기존 비밀번호와 다른 비밀번호를 설정해주세요.");
      return;
    }

    setLoading(true);
    try {
      const token = getSessionToken();
      const currentUser = user || getSessionUser();

      if (!token) {
        setError("인증 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
        return;
      }
      const res = await base44.functions.invoke("changeMyPassword", {
        session_token: token,
        login_id: currentUser?.login_id || null,
        old_password: oldPassword,
        new_password: newPassword,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);

      if (currentUser) {
        setSessionUser({ ...currentUser, must_change_password: false });
      }
      redirectByRole(currentUser?.role || "student");
    } catch (err) {
      const msg = err?.message || err?.response?.data?.error || "비밀번호 변경 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-200">
            <Code2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">CODA Practice</h1>
          <p className="text-sm mt-1 text-gray-500">비밀번호 변경</p>
        </div>

        {/* 알림 */}
        <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm border border-amber-100 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>보안을 위해 비밀번호를 변경해야 합니다. 비밀번호 변경 후 서비스를 이용할 수 있습니다.</span>
        </div>

        {/* 비밀번호 변경 카드 */}
        <div className="rounded-2xl border shadow-xl shadow-gray-100/50 p-8 bg-white border-gray-100">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 현재 비밀번호 */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-500">현재 비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showOld ? "text" : "password"}
                  placeholder="현재 비밀번호를 입력하세요"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full h-11 pl-10 pr-11 rounded-xl border bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-400 text-sm outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 새 비밀번호 */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-500">새 비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="새 비밀번호를 입력하세요"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-11 rounded-xl border bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-400 text-sm outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 새 비밀번호 확인 */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-500">새 비밀번호 확인</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="새 비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl border bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-400 text-sm outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-violet-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />변경 중...</>
              ) : "비밀번호 변경"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6 text-gray-500">
          © 2025 CODA 학원
        </p>
      </div>
    </div>
  );
}