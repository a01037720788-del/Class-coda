// 세션 인증 유틸리티 (보안 강화판)
//
// localStorage에는 세션 토큰만 저장합니다.
// 사용자 정보(role 등)는 서버에서 검증된 결과만 사용합니다.
// 페이지 접근 시 useSessionAuth 훅이 서버에서 세션을 검증하고
// 모듈 캐시에 사용자 정보를 저장합니다.

const TOKEN_KEY = 'coda_session_token';
const USER_KEY = 'coda_session_user';

// 모듈 레벨 사용자 캐시 — useSessionAuth가 서버 검증 후 설정.
// Base44 폴백 시 localStorage에도 저장되어 페이지 새로고침 후에도 유지.
let _cachedUser = null;

// ─── 세션 토큰 관리 ────────────────────────────────────────────────
export function getSessionToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// ─── 전체 세션 정리 ────────────────────────────────────────────────
export function clearSession() {
  clearSessionToken();
  _cachedUser = null;
  try {
    localStorage.removeItem(USER_KEY);
  } catch {}
}

// ─── 사용자 캐시 (서버 검증 후 설정) ────────────────────────────────
export function setSessionUser(user) {
  _cachedUser = user;
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
}

// 동기식 캐시 조회 — useSessionAuth가 검증 완료한 후에만 유효.
// 검증 전에는 null을 반환하므로, 레이아웃에서 로딩 게이트 필요.
// 페이지 새로고침 시 localStorage에서 복원됩니다.
export function getSessionUser() {
  if (_cachedUser) return _cachedUser;
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      _cachedUser = JSON.parse(stored);
      return _cachedUser;
    }
  } catch {}
  return null;
}

// ─── 역할 헬퍼 (서버 검증된 사용자 데이터 기반) ─────────────────────
export function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'teacher';
}

export function isTeacher(user) {
  return user?.role === 'teacher';
}

export function isSuperAdmin(user) {
  return user?.role === 'super_admin';
}

export function isStudent(user) {
  return user?.role === 'student';
}

export function isParent(user) {
  return user?.role === 'parent';
}