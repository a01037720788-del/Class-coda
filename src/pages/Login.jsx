import React, { useState, useEffect } from "react";
import { Lock, User, Loader2, Code2, Moon, Sun, Eye, EyeOff } from "lucide-react";
import {
  setSessionToken, setSessionUser, getSessionToken, clearSession, toSessionUser,
} from "@/lib/auth";
import { login as loginWithSheets, getToken, validateSession } from "@/lib/sheetsApi";
import { appPath } from "@/lib/basePath";

const STUDENT_HOME = "/student/home";

// 서버(Apps Script) 응답 코드 → 학생 안내 문구
function loginErrorMessage(err) {
  if (!err) return "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  if (err.message === "STUDENT_ID_NOT_LINKED") {
    return "학생 정보가 연결되지 않았습니다. 선생님께 문의해 주세요.";
  }
  if (err.code === "auth_failed") return "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (err.code === "invalid_input") return "아이디와 비밀번호를 모두 입력해 주세요.";
  // 잠금 · 비활성 · 서버 설정 안내는 서버가 만든 문구를 그대로 보여줍니다.
  if (err.code) return err.message;
  // 서버에 닿지 못한 경우(네트워크 · 주소 미설정)
  return /[가-힣]/.test(String(err.message || ""))
    ? err.message
    : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("coda_theme") === "dark");

  useEffect(() => {
    let cancelled = false;

    // 아이디 저장 복원
    const savedId = localStorage.getItem("coda_remember_id");
    if (savedId) {
      setLoginId(savedId);
      setRememberMe(true);
    }

    // 저장된 세션은 반드시 서버(Apps Script)에서 유효성을 확인한 뒤 사용합니다.
    if (!getSessionToken()) return;

    (async () => {
      try {
        const student = await validateSession();
        if (cancelled) return;
        if (student) {
          setSessionUser(toSessionUser(student));
          window.location.href = appPath(STUDENT_HOME);
        } else {
          clearSession();            // 만료 · 로그아웃 · 비활성 계정
        }
      } catch {
        // 서버에 연결할 수 없으면 로그인 화면을 그대로 보여줍니다.
      }
    })();

    return () => { cancelled = true; };
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 서버(Google Apps Script)가 Students 시트의 해시로 비밀번호를 검증하고,
      // 검증에 성공했을 때만 검증 가능한 세션 토큰을 발급합니다.
      const student = await loginWithSheets(loginId, password);
      const sessionUser = toSessionUser(student);
      if (!sessionUser?.student_id) throw new Error("STUDENT_ID_NOT_LINKED");

      setSessionToken(getToken());     // 서버가 발급한 토큰 (클라이언트 생성 토큰 사용 안 함)
      setSessionUser(sessionUser);     // 해시 · 솔트는 내려오지 않습니다

      // 아이디 저장
      if (rememberMe) {
        localStorage.setItem("coda_remember_id", loginId);
      } else {
        localStorage.removeItem("coda_remember_id");
      }

      window.location.href = appPath(STUDENT_HOME);   // 로그인 성공 → 학생 홈
    } catch (err) {
      setError(loginErrorMessage(err));
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