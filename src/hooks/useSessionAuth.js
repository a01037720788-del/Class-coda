// 세션 인증 훅 — Google Apps Script 서버에 세션 유효성을 확인한 뒤 사용자 정보를 반환합니다.
// 로컬 캐시만 믿지 않고, 만료 · 로그아웃 · 비활성 계정은 서버 응답으로 차단됩니다.

import { useState, useEffect } from 'react';
import {
  getSessionToken, getSessionUser, setSessionUser, clearSession, toSessionUser,
} from '@/lib/auth';
import { validateSession } from '@/lib/sheetsApi';

export function useSessionAuth() {
  const [user, setUser] = useState(() => getSessionUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!getSessionToken()) {
        if (!cancelled) { setUser(null); setLoading(false); }
        return;
      }

      try {
        const student = await validateSession();       // 서버 검증 (무효면 null)
        if (cancelled) return;

        if (student) {
          const fresh = toSessionUser(student);
          setSessionUser(fresh);                       // 검증된 값으로 갱신 (수강 과목 포함)
          setUser(fresh);
        } else {
          clearSession();
          setUser(null);
        }
      } catch (err) {
        // 서버에 연결할 수 없는 일시적 상황에서는 캐시된 사용자로 화면을 유지합니다.
        if (!cancelled) setUser(getSessionUser());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    verify();
    return () => { cancelled = true; };
  }, []);

  return { user, loading };
}