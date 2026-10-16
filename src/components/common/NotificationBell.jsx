import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, X, Megaphone, BookOpen, Code2, HelpCircle, Target, MessageSquare, Calendar, Unlock, Info, CheckCheck, Trash2 } from "lucide-react";

const TYPE_CONFIG = {
  notice:             { icon: Megaphone,     color: "bg-amber-100 text-amber-600",   label: "공지" },
  unit_opened:        { icon: BookOpen,      color: "bg-green-100 text-green-600",   label: "Unit" },
  example_completed:  { icon: Code2,         color: "bg-blue-100 text-blue-600",     label: "예제" },
  question_opened:    { icon: HelpCircle,    color: "bg-purple-100 text-purple-600", label: "Question" },
  mission_opened:     { icon: Target,        color: "bg-orange-100 text-orange-600", label: "Mission" },
  feedback_added:     { icon: MessageSquare, color: "bg-pink-100 text-pink-600",     label: "피드백" },
  class_schedule:     { icon: Calendar,      color: "bg-sky-100 text-sky-600",       label: "수업" },
  algorithm_opened:   { icon: Unlock,        color: "bg-indigo-100 text-indigo-600", label: "권한" },
  system:             { icon: Info,          color: "bg-gray-100 text-gray-600",     label: "시스템" },
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!userId) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const loadNotifications = async () => {
    if (!userId) return;
    try {
      const all = await base44.entities.Notification.filter({ user_id: userId });
      const active = all.filter(n => n.is_deleted !== true);
      // 최근순 정렬
      setNotifications(active.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (err) {
      // 네트워크 오류 시 조용히 무시 (다음 폴링에서 재시도)
      console.warn("[NotificationBell] 알림 로드 실패:", err?.message || err);
    }
  };

  const handleDismiss = async (id, e) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    await base44.entities.Notification.update(id, { is_deleted: true });
  };

  const handleRead = async (n) => {
    if (!n.is_read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      await base44.entities.Notification.update(n.id, { is_read: true });
    }
    if (n.link_path) window.location.href = n.link_path;
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (!unreadIds.length) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await Promise.all(unreadIds.map(id => base44.entities.Notification.update(id, { is_read: true })));
  };

  const handleDeleteAll = async () => {
    const ids = notifications.map(n => n.id);
    setNotifications([]);
    setOpen(false);
    await Promise.all(ids.map(id => base44.entities.Notification.update(id, { is_deleted: true })));
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">알림</span>
              {unread > 0 && (
                <span className="text-[11px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="모두 읽음"
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  title="전체 삭제"
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                알림이 없습니다.
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.notification_type] || TYPE_CONFIG.system;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleRead(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? "bg-blue-50/40" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase">{cfg.label}</span>
                        {!n.is_read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-sm font-medium text-gray-900 leading-tight">{n.title}</p>
                      {n.content && <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.content}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_date)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDismiss(n.id, e)}
                      className="p-1 hover:bg-gray-200 rounded flex-shrink-0 ml-1"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* 하단 요약 */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <span className="text-xs text-gray-400">총 {notifications.length}개 알림</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}