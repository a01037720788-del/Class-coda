import { SHEETS_API_URL as FALLBACK_API_URL } from "./sheetsConfig";

/**
 * Google Apps Script 웹 앱 클라이언트
 *
 * Base44 / Supabase 없이 Google Sheets 백엔드와 통신합니다.
 * - 인증 판단은 전적으로 서버가 합니다. 브라우저에는 불투명한 토큰만 보관합니다.
 * - Content-Type 을 text/plain 으로 보내 CORS preflight(OPTIONS)를 피합니다.
 *   (Apps Script 웹 앱은 OPTIONS 요청을 처리하지 않습니다)
 */

// 우선순위: 빌드 환경변수 → sheetsConfig.js 에 적어 둔 주소
const API_URL = (import.meta.env.VITE_SHEETS_API_URL || FALLBACK_API_URL || "").trim();
const TOKEN_KEY = "coda_session_token";

export function isConfigured() {
  return API_URL.length > 0;
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* 저장 불가 환경 무시 */ }
}

export function clearToken() {
  setToken("");
}

async function call(action, payload = {}) {
  if (!isConfigured()) {
    throw new Error("백엔드 주소가 설정되지 않았습니다. (VITE_SHEETS_API_URL)");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token: getToken(), ...payload }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`서버 응답을 해석할 수 없습니다. (HTTP ${res.status})`);
  }
  if (!data.ok) {
    const err = new Error(data.message || "요청이 실패했습니다.");
    err.code = data.error;
    throw err;
  }
  return data.data;
}

/* ── 인증 ───────────────────────────────────────────────────────────── */

/** 로그인 성공 시 토큰을 저장하고 학생 정보를 반환합니다. */
export async function login(loginId, password) {
  const data = await call("login", { login_id: loginId, password });
  setToken(data.token);
  return data.student;
}

/**
 * 저장된 토큰이 아직 유효한지 서버에 확인합니다.
 * - 서버가 "무효"라고 답하면 null (만료 · 로그아웃 · 비활성 계정)
 * - 서버에 연결할 수 없으면 예외를 던집니다 → 일시적 오류를 로그아웃으로 처리하지 않도록
 */
export async function validateSession() {
  if (!getToken()) return null;
  const data = await call("validateSession");
  return data.valid ? data.student : null;
}

export async function logout() {
  try { await call("logout"); } catch { /* 무시 */ }
  clearToken();
}

export function getStudentProfile() {
  return call("getStudentProfile");
}

export function getStudentSubjects() {
  return call("getStudentSubjects");
}

/* ── 학습 기록 ──────────────────────────────────────────────────────── */

export function getStudentProgress(subject) {
  return call("getStudentProgress", subject ? { subject } : {});
}

export function saveStudentProgress({ subject, unitId, completed, data }) {
  return call("saveStudentProgress", { subject, unit_id: unitId, completed, data });
}

export function saveQuizResult({ subject, unitId, itemNumber, score, answer, data }) {
  return call("saveQuizResult", {
    subject, unit_id: unitId, item_number: itemNumber, score, answer, data,
  });
}

export function saveMissionSubmission({ subject, unitId, missionNumber, submission, isCorrect, data }) {
  return call("saveMissionSubmission", {
    subject, unit_id: unitId, mission_number: missionNumber,
    submission, is_correct: isCorrect, data,
  });
}

export default {
  isConfigured, getToken, setToken, clearToken,
  login, validateSession, logout,
  getStudentProfile, getStudentSubjects,
  getStudentProgress, saveStudentProgress, saveQuizResult, saveMissionSubmission,
};
/** 관리자 전용 학생 목록 — 서버에서 관리자 토큰을 확인합니다. */
export function adminListStudents() { return call("adminListStudents"); }

export function adminCreateStudent(data) { return call('adminCreateStudent',{data}); }
export function adminUpdateStudent(studentId,data) { return call('adminUpdateStudent',{student_id:studentId,data}); }
export function adminSetStudentStatus(studentId,active) { return call('adminSetStudentStatus',{student_id:studentId,active}); }
export function adminResetStudentPassword(studentId,password) { return call('adminResetStudentPassword',{student_id:studentId,password}); }

// CODA_002 단원 오버라이드 API (관리자 세션 필요)
export function adminListUnitOverrides(subject) { return call('adminListUnitOverrides',{subject}); }
export function adminSaveUnitOverride(subject,unit) { return call('adminSaveUnitOverride',{subject,unit}); }

// CODA_003: 학생 인증 토큰으로 자신의 수강 과목 변경분만 조회
export function getStudentUnitOverrides(subject) { return call('getStudentUnitOverrides', {subject}); }

/** 관리자 AI 단원 생성 (Google Apps Script 서버 측 OpenAI 호출) */
export function generateAIUnit(payload) { return call("generateAIUnit", { payload }); }

/** 본인 비밀번호 변경. 성공 시 서버에서 기존 세션을 종료합니다. */
export function changeMyPassword(oldPassword, newPassword) { return call("changeMyPassword", { old_password: oldPassword, new_password: newPassword }); }
