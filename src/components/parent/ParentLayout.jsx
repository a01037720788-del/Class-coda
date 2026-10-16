import React, { useEffect, useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { getParentSession, clearParentSession } from "@/lib/parentAuth";
import { Home, BookOpen, MessageSquare, Calendar, LogOut, Heart, Menu, X } from "lucide-react";
import PWAInstallBanner from "@/components/common/PWAInstallBanner";

const menuItems = [
  { path: "/parent/home", label: "홈", icon: Home },
  { path: "/parent/feedback", label: "자녀 피드백", icon: MessageSquare },
  { path: "/parent/classes", label: "수업 일정", icon: Calendar },
];

function SidebarContent({ session, onLogout, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">CODA Judge</p>
            <p className="text-[11px] text-gray-400">학부모 포털</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg md:hidden">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {session && (
        <div className="px-4 py-3 border-b border-gray-100 bg-pink-50">
          <p className="text-sm font-semibold text-pink-600">{session.name}</p>
          <p className="text-[11px] text-gray-400">학부모</p>
        </div>
      )}

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
                    ? "bg-pink-50 text-pink-600 font-medium"
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

export default function ParentLayout() {
  const [session, setSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const s = getParentSession();
    if (!s || s.role !== "parent") {
      window.location.href = "/parent-login";
      return;
    }
    setSession(s);
  }, []);

  const handleLogout = () => {
    clearParentSession();
    window.location.href = "/parent-login";
  };

  if (!session) return null;

  return (
    <div className="flex h-screen bg-[#f0f0f5]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col shadow-sm flex-shrink-0">
        <SidebarContent session={session} onLogout={handleLogout} onClose={null} />
      </div>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-white h-full shadow-2xl flex flex-col">
            <SidebarContent session={session} onLogout={handleLogout} onClose={() => setSidebarOpen(false)} />
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
            <div className="w-6 h-6 bg-pink-500 rounded-md flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">CODA Judge</span>
          </div>
          {session && (
            <div className="ml-auto">
              <span className="text-xs text-gray-500">{session.name}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet context={{ session }} />
        </div>
      </div>

      {/* 모바일 하단 네비게이션 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {menuItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] ${
                  isActive ? "text-pink-500" : "text-gray-400"
                }`
              }>
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-colors ${isActive ? "bg-pink-50" : ""}`}>
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