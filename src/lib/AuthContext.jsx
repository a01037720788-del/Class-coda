// CODA 독립 인증 컨텍스트: Base44 공개 설정/인증 호출 제거
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { validateSession, logout as sheetsLogout } from '@/lib/sheetsApi';
import { getSessionToken, setSessionUser, clearSession } from '@/lib/auth';
import { appPath } from '@/lib/basePath';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      if (!getSessionToken()) {
        setUser(null);
        setSessionUser(null);
        return;
      }
      const verified = await validateSession();
      setUser(verified || null);
      setSessionUser(verified || null);
      if (!verified) clearSession();
    } catch (error) {
      console.error('[CODA] 세션 확인 실패:', error);
      setUser(null);
      setAuthError({ type: 'network_error', message: '로그인 상태를 확인하지 못했습니다.' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => { checkUserAuth(); }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    try { await sheetsLogout(); } finally {
      clearSession();
      setUser(null);
      if (shouldRedirect) window.location.href = appPath('/login');
    }
  };

  const navigateToLogin = () => { window.location.href = appPath('/login'); };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoadingAuth,
      isLoadingPublicSettings: false, authError,
      appPublicSettings: null, authChecked, logout,
      navigateToLogin, checkUserAuth, checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
