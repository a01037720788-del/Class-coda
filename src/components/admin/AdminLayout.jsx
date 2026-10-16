import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useSessionAuth } from "@/hooks/useSessionAuth";
import { isAdmin, isSuperAdmin, clearSession, getSessionToken } from "@/lib/auth";
import {
  LayoutDashboard, Users, BookOpen, Calendar, Code2,
  MessageSquare, Settings, LogOut, Crown, Shield, BarChart2, Menu, X, ClipboardList, TableProperties, FileCheck
} from "lucide-react";
import NotificationBell from "@/components/common/NotificationBell";
import PWAInstallBanner from "@/components/common/PWAInstallBanner";

const baseMenuItems = [
  { path: "/admin/dashboard", label: "대시보드", icon: LayoutDashboard },
  { path: "/admin/students", label: "학생 관리", icon: Users },
  { path: "/admin/subjects", label: "과목 관리", icon: BookOpen },
  { path: "/admin/calendar", label: "수업 캘린더", icon: Calendar },
  { path: "/admin/attendance", label: "출석부", icon: ClipboardList },
  { path: "/admin/lesson-record", label: "수업 기록표", icon: TableProperties },
  { path: "/admin/feedback", label: "피드백 관리", icon: MessageSquare },
  { path: "/admin/problems", label: "문제 관리", icon: Code2 },
  { path: "/admin/student-submissions", label: "제출 현황", icon: FileCheck },
];

const superAdminMenuItems = [
  { path: "/admin/teacher-stats", label: "선생님 통계", icon: BarChart2 },
  { path: "/admin/settings", label: "관리자 계정 관리", icon: Shield },
];

function SidebarContent({ user, menuItems, roleBadge, onLogout, onClose, showBell }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo + Close button (모바일에서만 X 표시) */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#7c3aed] rounded-lg flex items-center justify-center">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">CODA Judge</p>
            <p className="text-[11px] text-gray-400">관리자 패널</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg md:hidden">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* User Info */}
      {user && (
        <div className="px-4 py-3 border-b border-gray-100 bg-[#7c3aed]/5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#7c3aed]">{user.name}님</p>
            <p className="text-[11px] text-gray-400">{roleBadge}</p>
          </div>
          {showBell && <NotificationBell userId={user.id} userRole={user.role} />}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {menuItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-[#7c3aed]/10 text-[#7c3aed] font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>로그아웃</span>
        </button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#f0f0f5]">
      <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, loading } = useSessionAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    const token = getSessionToken();
    if (token) {
      // 세션 정리 (Base44 전용 — 서버 세션 없음)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    clearSession();
    window.location.href = "/login";
  };

  // 로딩 중
  if (loading) return <LoadingScreen />;

  // 인증되지 않음 → 로그인으로
  if (!user) {
    window.location.href = "/login";
    return <LoadingScreen />;
  }

  // 관리자 권한 없음 → 학생 페이지로
  if (!isAdmin(user)) {
    window.location.href = "/student/home";
    return <LoadingScreen />;
  }

  // 비밀번호 변경 필요 → 비밀번호 변경 페이지로
  if (user.must_change_password) {
    window.location.href = "/change-password";
    return <LoadingScreen />;
  }

  const menuItems = isSuperAdmin(user)
    ? [...baseMenuItems, ...superAdminMenuItems]
    : baseMenuItems;

  const roleBadge = user?.role === "super_admin" ? "총 관리자" : user?.role === "teacher" ? "선생님" : "관리자";

  // 모바일 하단 네비 — 학생/과목/문제/계정 관리 제외
  const mobileNavItems = menuItems.filter(item =>
    !item.path.includes("/students") &&
    !item.path.includes("/subjects") &&
    !item.path.includes("/problems") &&
    !item.path.includes("/settings")
  );

  return (
    <div className="flex h-screen bg-[#f0f0f5]">
      {/* Desktop Sidebar — 항상 표시 */}
      <div className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col shadow-sm flex-shrink-0">
        <SidebarContent user={user} menuItems={menuItems} roleBadge={roleBadge} onLogout={handleLogout} onClose={null} showBell={true} />
      </div>

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-white h-full shadow-2xl flex flex-col">
            <SidebarContent
              user={user}
              menuItems={menuItems}
              roleBadge={roleBadge}
              onLogout={handleLogout}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#7c3aed] rounded-md flex items-center justify-center">
              <Crown className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">CODA Judge</span>
          </div>
          {user && (
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell userId={user.id} userRole={user.role} />
              <span className="text-xs text-gray-500">{user.name}님</span>
            </div>
          )}
        </div>

        {/* Content — 모바일에서 하단 네비 높이만큼 여백 */}
        <div className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </div>
      </div>

      {/* 모바일 하단 네비게이션 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {mobileNavItems.map(item => {
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

      <PWAInstallBanner />
    </div>
  );
}