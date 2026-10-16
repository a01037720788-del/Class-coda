import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getSessionUser } from "@/lib/auth";

const PAGE_LABELS = {
  "/student/home": "홈",
  "/student/python": "Python 학습",
  "/student/problems": "알고리즘 문제",
  "/student/live": "실시간 수업",
  "/student/settings": "설정",
};

/**
 * 학생이 현재 보고 있는 페이지를 StudentPresence에 실시간으로 기록합니다.
 * @param {string} pageDetail - 세부 정보 (선택)
 */
export function usePageTracker(pageDetail = "") {
  const location = useLocation();
  const presenceId = useRef(null);
  const lastPath = useRef(null);
  const timer = useRef(null);

  const upsertPresence = async (path, detail) => {
    const u = getSessionUser();
    if (!u) return;
    const sid = u.student_id;
    if (!sid) return; // student_id 없으면 기록하지 않음 (연결 오류 화면에서 처리)
    const label = PAGE_LABELS[path] || path;
    const now = new Date().toISOString();

    if (presenceId.current) {
      await base44.entities.StudentPresence.update(presenceId.current, {
        current_page: path,
        current_page_label: label,
        page_detail: detail || "",
        last_seen_at: now,
      });
    } else {
      // 기존 레코드 찾기
      const existing = await base44.entities.StudentPresence.filter({ student_id: sid });
      if (existing.length > 0) {
        presenceId.current = existing[0].id;
        await base44.entities.StudentPresence.update(presenceId.current, {
          current_page: path,
          current_page_label: label,
          page_detail: detail || "",
          last_seen_at: now,
        });
      } else {
        const created = await base44.entities.StudentPresence.create({
          student_id: sid,
          student_name: u.name || "",
          current_page: path,
          current_page_label: label,
          page_detail: detail || "",
          last_seen_at: now,
        });
        presenceId.current = created.id;
      }
    }
  };

  // 페이지 변경 시 기록
  useEffect(() => {
    const path = location.pathname;
    if (!path.startsWith("/student")) return;
    if (path === lastPath.current) return;
    lastPath.current = path;

    clearTimeout(timer.current);
    timer.current = setTimeout(() => upsertPresence(path, pageDetail), 400);
  }, [location.pathname]);

  // pageDetail 변경 시 기록
  useEffect(() => {
    const path = location.pathname;
    if (!path.startsWith("/student") || !pageDetail) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => upsertPresence(path, pageDetail), 600);
  }, [pageDetail]);

  // last_seen_at 주기적 갱신 (30초마다 — 접속 중 표시용)
  useEffect(() => {
    const interval = setInterval(() => {
      const path = location.pathname;
      if (!path.startsWith("/student")) return;
      upsertPresence(path, pageDetail);
    }, 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer.current);
    };
  }, []);
}