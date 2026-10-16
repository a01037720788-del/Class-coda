import React, { useState, useEffect } from "react";
import { Lock, User, Loader2, Code2, Moon, Sun, Eye, EyeOff } from "lucide-react";
import { setSessionToken, setSessionUser, getSessionToken, clearSessionToken } from "@/lib/auth";
import { base44 } from "@/api/base44Client";
import { appPath } from "@/lib/basePath";

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("coda_theme") === "dark");

  useEffect(() => {
    // 자동 로그인: 저장된 세션 토큰이 있으면 localStorage 사용자로 복원
    const token = getSessionToken();
    if (token) {
      const storedUser = JSON.parse(localStorage.getItem("coda_session_user") || "null");
      if (storedUser) {
        setSessionUser(storedUser);
        redirectByRole(storedUser.role, storedUser.must_change_password);
      } else {
        clearSessionToken();
      }
      return;
    }
    // 자동로그인 저장된 ID 불러오기
    const savedId = localStorage.getItem("coda_remember_id");
    if (savedId) {
      setLoginId(savedId);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("coda_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("coda_theme", "light");
    }
  }, [dark]);

  const redirectByRole = (role, mustChangePassword = false) => {
    if (mustChangePassword) {
      window.location.href = appPath("/change-password");
      return;
    }
    if (role === "super_admin" || role === "admin" || role === "teacher") {
      window.location.href = appPath("/admin/students");
    } else if (role === "student") {
      window.location.href = appPath("/student/home");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("appLogin", { login_id: loginId, password });
      const data = res?.data || res;
      if (!data?.user) {
        const code = data?.error || "";
        if (code.includes('USER_NOT_FOUND')) throw new Error('USER_NOT_FOUND');
        if (code.includes('WRONG_PASSWORD')) throw new Error('WRONG_PASSWORD');
        if (code.includes('ACCOUNT_DEACTIVATED')) throw new Error('ACCOUNT_DEACTIVATED');
        throw new Error('LOGIN_ERROR');
      }

      // 학생 role인데 student_id가 없으면 로그인 거부
      if (data.user.role === "student" && !data.user.student_id) {
        throw new Error("STUDENT_ID_NOT_LINKED");
      }

      const tempToken = "b44_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      setSessionToken(tempToken);
      setSessionUser(data.user);
      // 자동로그인 ID 저장
      if (rememberMe) {
        localStorage.setItem("coda_remember_id", loginId);
      } else {
        localStorage.removeItem("coda_remember_id");
      }
      redirectByRole(data.user.role, data.user.must_change_password);
    } catch (err) {
      const code = err.message;
      if (code === 'USER_NOT_FOUND') { setError("존재하지 않는 아이디입니다."); }
      else if (code === 'WRONG_PASSWORD') { setError("비밀번호가 올바르지 않습니다."); }
      else if (code === 'ACCOUNT_DEACTIVATED') { setError("사용이 중지된 계정입니다. 관리자에게 문의해 주세요."); }
      else if (code === 'STUDENT_ID_NOT_LINKED') { setError("학생 계정과 학생 정보가 연결되지 않았습니다. 관리자에게 문의해 주세요."); }
      else { setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."); }
    } finally {
      setLoading(false);
    }
  };

  const bg = dark ? "bg-gray-950" : "bg-gradient-to-br from-violet-50 via-white to-indigo-50";
  const card = dark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100";
  const text = dark ? "text-gray-100" : "text-gray-900";
  const subtext = dark ? "text-gray-400" : "text-gray-500";
  const inputClass = dark
    ? "bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 focus:border-violet-500"
    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-violet-400";

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center px-4 py-10 transition-colors duration-300`}>
      {/* 다크모드 토글 */}
      <button
        onClick={() => setDark(d => !d)}
        className={`fixed top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${dark ? "bg-gray-800 text-yellow-400 hover:bg-gray-700" : "bg-white text-gray-500 hover:bg-gray-100 shadow-sm border border-gray-200"}`}
        aria-label="다크모드 토글"
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-200">
            <Code2 className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${text}`}>CODA Practice</h1>
          <p className={`text-sm mt-1 ${subtext}`}>코딩 학습 플랫폼</p>
        </div>

        {/* 로그인 카드 */}
        <div className={`rounded-2xl border shadow-xl shadow-gray-100/50 p-8 ${card}`}>
          <h2 className={`text-base font-bold mb-5 ${text}`}>로그인</h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 아이디 */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${subtext}`}>아이디</label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? "text-gray-500" : "text-gray-400"}`} />
                <input
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="id를 입력해주세요"
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  required
                  className={`w-full h-11 pl-10 pr-4 rounded-xl border text-sm outline-none transition-colors ${inputClass}`}
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${subtext}`}>비밀번호</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? "text-gray-500" : "text-gray-400"}`} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className={`w-full h-11 pl-10 pr-11 rounded-xl border text-sm outline-none transition-colors ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${dark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 자동 로그인 */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-violet-600 cursor-pointer"
              />
              <label htmlFor="rememberMe" className={`text-xs cursor-pointer select-none ${subtext}`}>
                아이디 저장
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-violet-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />로그인 중...</>
              ) : "로그인"}
            </button>
          </form>
        </div>

        {/* 안내: 학생 계정은 관리자 발급 */}
        <p className={`text-center text-xs mt-4 ${subtext}`}>
          계정은 관리자에게 발급받아 주세요.
        </p>

        <p className={`text-center text-xs mt-6 ${subtext}`}>
          © 2025 CODA 학원
        </p>
      </div>
    </div>
  );
}