// 학생 테마 설정을 StudentUnitProgress에 저장/로드
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

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

const THEME_KEY = "coda_student_theme";

export function useTheme(studentId) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved ? { ...DEFAULT_THEME, ...JSON.parse(saved) } : DEFAULT_THEME;
    } catch { return DEFAULT_THEME; }
  });

  const saveTheme = async (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, JSON.stringify(newTheme));
    // Also persist in DB via a dedicated theme record
    if (!studentId) return;
    const key = `theme_${studentId}`;
    const existing = await base44.entities.StudentUnitProgress.filter({ student_id: studentId, unit_id: key });
    if (existing.length > 0) {
      await base44.entities.StudentUnitProgress.update(existing[0].id, { theme_settings: newTheme });
    } else {
      await base44.entities.StudentUnitProgress.create({
        student_id: studentId, unit_id: key, unit_title: "__theme__",
        theme_settings: newTheme,
      });
    }
  };

  // Load from DB on mount
  useEffect(() => {
    if (!studentId) return;
    const key = `theme_${studentId}`;
    base44.entities.StudentUnitProgress.filter({ student_id: studentId, unit_id: key }).then(res => {
      if (res.length > 0 && res[0].theme_settings) {
        const t = { ...DEFAULT_THEME, ...res[0].theme_settings };
        setThemeState(t);
        localStorage.setItem(THEME_KEY, JSON.stringify(t));
      }
    }).catch(() => {});
  }, [studentId]);

  return { theme, saveTheme };
}