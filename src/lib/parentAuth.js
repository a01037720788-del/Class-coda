// 학부모 전용 세션 관리 (전화번호 기반, AppUser 불필요)

const PARENT_SESSION_KEY = "coda_parent_session";

export function getParentSession() {
  try {
    const raw = localStorage.getItem(PARENT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearParentSession() {
  localStorage.removeItem(PARENT_SESSION_KEY);
}

export function isParentLoggedIn() {
  const session = getParentSession();
  return session?.role === "parent" && !!session?.parent_phone;
}

export function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}