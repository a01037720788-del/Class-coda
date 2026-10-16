import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Circle } from "lucide-react";

// 5분 이내 last_seen_at → 접속 중으로 판단
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

const PAGE_COLOR = {
  "/student/home": "bg-blue-100 text-blue-700",
  "/student/python": "bg-purple-100 text-purple-700",
  "/student/problems": "bg-orange-100 text-orange-700",
  "/student/live": "bg-green-100 text-green-700",
  "/student/settings": "bg-gray-100 text-gray-600",
};

export default function OnlineStudentsPanel() {
  const [presences, setPresences] = useState([]);

  const load = async () => {
    const all = await base44.entities.StudentPresence.list("-last_seen_at", 100);
    const now = Date.now();
    const online = all.filter(p => {
      if (!p.last_seen_at) return false;
      return now - new Date(p.last_seen_at).getTime() < ONLINE_THRESHOLD_MS;
    });
    setPresences(online);
  };

  useEffect(() => {
    load();
    // 실시간 구독
    const unsub = base44.entities.StudentPresence.subscribe(() => load());
    // 30초마다 갱신 (오프라인 감지)
    const interval = setInterval(load, 30000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  if (presences.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Circle className="w-3 h-3 fill-gray-300 text-gray-300" />
        현재 접속 중인 학생
      </h3>
      <p className="text-sm text-gray-400">현재 접속 중인 학생이 없습니다.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Circle className="w-3 h-3 fill-green-400 text-green-400" />
        현재 접속 중인 학생
        <span className="ml-1 text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          {presences.length}명
        </span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {presences.map(p => {
          const colorClass = PAGE_COLOR[p.current_page] || "bg-gray-100 text-gray-600";
          const timeAgo = p.last_seen_at
            ? Math.floor((Date.now() - new Date(p.last_seen_at).getTime()) / 1000)
            : null;
          const timeStr = timeAgo !== null
            ? timeAgo < 60 ? `${timeAgo}초 전` : `${Math.floor(timeAgo / 60)}분 전`
            : "";

          return (
            <div key={p.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-8 h-8 rounded-full bg-[#7c3aed]/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#7c3aed]">
                {(p.student_name || "?")[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.student_name || p.student_id}</p>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${colorClass}`}>
                  <MapPin className="w-2.5 h-2.5" />
                  {p.current_page_label || p.current_page || "알 수 없음"}
                </span>
                {p.page_detail && (
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{p.page_detail}</p>
                )}
                {timeStr && <p className="text-[10px] text-gray-300 mt-0.5">{timeStr}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}