// 학생별 테마는 이 브라우저에 저장합니다. Base44 서버는 사용하지 않습니다.
import { useState, useEffect } from "react";

export const DEFAULT_THEME = {
  background_color: "#f0f0f5",
  card_color: "#ffffff",
  button_color: "#7c3aed",
  accent_color: "#2563eb",
  example_code_bg: "#111827",
  example_code_text: "#86efac",
  student_code_bg: "#1e1e1e",
  student_code_text: "#d4d4d4",
  result_bg: "#111827",
  result_text: "#e5e7eb",
};

const storageKey = (studentId) => `coda_student_theme_${String(studentId || 'guest')}`;
const readTheme = (studentId) => {
  try {
    const raw = localStorage.getItem(storageKey(studentId));
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) };
    // 기존 단일 계정 저장 형식에서 현재 학생으로 1회 이전
    const legacy = localStorage.getItem('coda_student_theme');
    if (legacy && studentId) {
      const parsed = { ...DEFAULT_THEME, ...JSON.parse(legacy) };
      localStorage.setItem(storageKey(studentId), JSON.stringify(parsed));
      localStorage.removeItem('coda_student_theme');
      return parsed;
    }
  } catch { /* 브라우저 저장소 제한 */ }
  return { ...DEFAULT_THEME };
};

export function useTheme(studentId) {
  const [theme, setThemeState] = useState(() => readTheme(studentId));
  useEffect(() => { setThemeState(readTheme(studentId)); }, [studentId]);

  const saveTheme = async (newTheme) => {
    const next = { ...DEFAULT_THEME, ...newTheme };
    setThemeState(next);
    try { localStorage.setItem(storageKey(studentId), JSON.stringify(next)); }
    catch { /* 저장소 접근이 막힌 경우 현재 화면에만 반영 */ }
  };

  return { theme, saveTheme };
}
