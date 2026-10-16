// 세션 인증 훅 — localStorage에 저장된 세션 사용자로 복원.
// Supabase 의존성 제거 — 서버 세션 검증 대신 로컬 캐시 사용.

import { useState, useEffect } from 'react';
import { getSessionToken, clearSessionToken, setSessionUser, getSessionUser } from '@/lib/auth';

export function useSessionAuth() {
  const [user, setUser] = useState(() => getSessionUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const token = getSessionToken();

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // localStorage에서 저장된 사용자 정보 복원
      const storedUser = getSessionUser();
      if (cancelled) return;

      if (!storedUser) {
        clearSessionToken();
        setUser(null);
        setLoading(false);
        return;
      }

      setSessionUser(storedUser);
      setUser(storedUser);
      setLoading(false);
    }

    verify();
    return () => { cancelled = true; };
  }, []);

  return { user, loading };
}