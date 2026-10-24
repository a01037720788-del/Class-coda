
import { useState, useEffect } from "react";

import {
  getSessionToken,
  setSessionUser,
  clearSession,
  toSessionUser,
  consumeFreshServerLogin
} from "@/lib/auth";

import { validateSession } from "@/lib/sheetsApi";

export function useSessionAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = getSessionToken();

      if (!token) {
        clearSession();

        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }

        return;
      }

      try {
        // 같은 SPA 실행 중 방금 서버 로그인에 성공한 경우 중복 왕복을 생략합니다.
        // 새로고침/직접 접속 시에는 반드시 서버 검증을 다시 수행합니다.
        const freshUser = consumeFreshServerLogin(token);
        if (freshUser) {
          if (!cancelled) { setUser(freshUser); setLoading(false); }
          return;
        }
        // 반드시 서버에서 세션 검증
        const student = await validateSession();

        if (cancelled) return;

        if (!student || student.status !== "active") {
          clearSession();
          setUser(null);
          return;
        }

        const verifiedUser = toSessionUser(student);

        if (!verifiedUser?.student_id && verifiedUser?.role !== "admin") {
          clearSession();
          setUser(null);
          return;
        }

        setSessionUser(verifiedUser);
        setUser(verifiedUser);

      } catch (error) {
        // 인증 서버 오류 시 접근 차단
        if (!cancelled) {
          setSessionUser(null);
          setUser(null);
        }

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}
