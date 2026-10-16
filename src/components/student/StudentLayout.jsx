import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useSessionAuth } from "@/hooks/useSessionAuth";
import { isStudent, clearSession } from "@/lib/auth";
import { logout as logoutFromSheets } from "@/lib/sheetsApi";
import { Home, Code2, Settings, LogOut, GraduationCap, Menu, X } from "lucide-react";
import { usePageTracker } from "@/hooks/usePageTracker";
import NotificationBell from "@/components/common/NotificationBell";
import PWAInstallBanner from "@/components/common/PWAInstallBanner";
import { SUBJECT_CONFIGS, resolveActiveSubjects } from "@/utils/subjectAccess";
import { appPath } from "@/lib/basePath";

// 모바일 하단 고정 표시 과목 우선순위 (최대 4개 + 홈)
const MOBILE_PRIORITY = ["python", "junior_python", "cpp"];

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#f0f0f5]">
      <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
    </div>
  );
}

export default function StudentLayout() {
  const { user, loading } = useSessionAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  usePageTracker();

  const handleLogout = async () => {
    await logoutFromSheets();        // 서버 세션도 함께 폐기합니다
    clearSession();
    window.location.href = appPath("/login");
  };

  // 수강 과목은 Students 시트의 subjects 열(서버가 검증해 내려준 값)만 사용합니다.
  const buildMenu = (student) => {
    const active = resolveActiveSubjects(student);
    const items = [{ path: "/student/home", label: "홈", icon: Home, key: "home" }];
    SUBJECT_CONFIGS.forEach(cfg => {
      if (active.has(cfg.key)) {
        items.push({ path: cfg.path, label: cfg.label.replace(" 학습", ""), icon: Code2, key: cfg.key });
      }
    });
    items.push({ path: "/student/settings", label: "설정", icon: Settings, key: "settings" });
    setMenuItems(items);
  };

  // 메뉴 구성 — 서버가 검증해 내려준 세션 사용자(시트의 subjects 포함)만 사용합니다.
  useEffect(() => {
    if (!user) return;
    buildMenu(user);
  }, [user]);

  // 로딩 중
  if (loading) return <LoadingScreen />;

  // 학생 role인데 student_id가 없으면 연결 오류 화면 표시
  if (isStudent(user) && !user?.student_id) {
    return (
      <div className="min-h-screen bg-[#f0f0f5] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-red-500 text-xl">⚠</span>
          </div>
          <p className="text-red-600 font-semibold mb-2">학생 계정 연결 오류</p>
          <p className="text-sm text-gray-600 mb-3">
            학생 계정과 학생 정보가 연결되지 않았습니다.<br />관리자에게 문의해 주세요.
          </p>
          <div className="text-xs text-gray-400 mt-3 space-y-1 bg-gray-50 rounded-lg p-3 text-left">
            <p>login_id: <span className="font-mono">{user?.login_id || "(알 수 없음)"}</span></p>
            <p>app_users.id: <span className="font-mono">{user?.id || "(알 수 없음)"}</span></p>
            <p>student_id: <span className="font-mono text-red-500">(연결 없음)</span></p>
          </div>
          <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  // 인증되지 않음 → 로그인으로
  if (!user) {
    window.location.href = appPath("/login");
    return <LoadingScreen />;
  }

  // 학생 권한 없음 → 관리자 페이지로
  if (!isStudent(user)) {
    window.location.href = appPath("/admin/students");
    return <LoadingScreen />;
  }

  // 비밀번호 변경 필요 → 비밀번호 변경 페이지로
  if (user.must_change_password) {
    window.location.href = appPath("/change-password");
    return <LoadingScreen />;
  }

  // 모바일 하단 메뉴: 홈 + 우선순위 상위 3개 과목 + 설정 (최대 5개)
  const mobileBottomItems = (() => {
    const subjectItems = menuItems.filter(i => MOBILE_PRIORITY.includes(i.key));
    const prioritized = [...subjectItems].sort((a, b) => MOBILE_PRIORITY.indexOf(a.key) - MOBILE_PRIORITY.indexOf(b.key)).slice(0, 3);
    const home = menuItems.find(i => i.key === "home");
    const settings = menuItems.find(i => i.key === "settings");
    return [home, ...prioritized, settings].filter(Boolean);
  })();

  return (
    <div className="min-h-screen bg-[#f0f0f5]">
      <PWAInstallBanner />

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#7c3aed] rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-gray-900 text-sm">CODA Judge</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {user && (
              <div className="px-4 py-3 border-b border-gray-100 bg-[#7c3aed]/5">
                <p className="text-sm font-semibold text-[#7c3aed]">{user.name} 학생님</p>
                <p className="text-[11px] text-gray-400">학생</p>
              </div>
            )}
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {menuItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive ? "bg-[#7c3aed]/10 text-[#7c3aed] font-medium" : "text-gray-600 hover:bg-gray-50"
                      }`
                    }>
                    <Icon className="w-4 h-4 flex-shrink-0" /><span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-3 border-t border-gray-100">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                <LogOut className="w-4 h-4" /><span>로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Nav */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg mr-1">
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <div className="w-8 h-8 bg-[#7c3aed] rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">CODA Practice Judge</p>
              <p className="text-[11px] text-gray-400 hidden sm:block">학습 플랫폼</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <NotificationBell userId={user.student_id} userRole="student" />
              <span className="text-xs text-gray-600 hidden sm:inline">{user.name}님</span>
              <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1 ml-1">
                <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          )}
        </div>
        {/* Desktop tab menu - 가로 스크롤 지원 */}
        <div className="max-w-6xl mx-auto px-4 hidden md:flex overflow-x-auto border-t border-gray-100 scrollbar-hide">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                    isActive ? "border-[#7c3aed] text-[#7c3aed]" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`
                }>
                <Icon className="w-3.5 h-3.5" /><span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>


      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <Outlet context={{ studentData: user, user }} />
      </div>

      {/* 모바일 하단 네비게이션 (최대 5개 고정) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {mobileBottomItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] ${
                  isActive ? "text-[#7c3aed]" : "text-gray-400"
                }`
              }>
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-colors ${isActive ? "bg-[#7c3aed]/10" : ""}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}