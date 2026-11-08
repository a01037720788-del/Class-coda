import { gradeCodeWithAI } from "./sheetsApi";

// Google Apps Script가 API 키를 서버 측 Script Properties에서 읽습니다.
export async function requestAiGrade(payload) {
  const data = await gradeCodeWithAI(payload);
  if (typeof data?.is_correct !== "boolean" || typeof data?.feedback !== "string") {
    throw new Error("AI 채점 응답 형식이 올바르지 않습니다.");
  }
  return data;
}
