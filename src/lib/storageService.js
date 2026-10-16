/**
 * storageService — localStorage 중앙 관리 모듈
 * 모든 키 패턴을 여기서 정의하고 사용합니다.
 */

const PREFIX = "coda_";

// ── 키 생성 함수 ──────────────────────────────────────────────────────────────

export const storageKeys = {
  /** 에디터 설정 (전역) */
  editorSettings: () => "coda_editor_settings",

  /** Python 예제 학생 코드 */
  pythonExampleCode: (sid, unitId, idx) => `${PREFIX}py_ex_${sid}_${unitId}_${idx}`,

  /** Python 예제 실행결과 */
  pythonExampleResult: (sid, unitId, idx) => `${PREFIX}py_res_${sid}_${unitId}_${idx}`,

  /** Python 미션 제출 상태 (MissionPanel) */
  pythonMissionState: (unitId, mNum) => `${PREFIX}py_mission_${unitId}_${mNum}`,

  /** Python 미션 코드 자동저장 */
  pythonMissionCode: (unitId, mNum) => `${PREFIX}autosave_py_${unitId}_${mNum}`,

  /** C++ 예제 코드 자동저장 */
  cppExampleCode: (unitId, idx) => `${PREFIX}autosave_cpp_ex_${unitId}_${idx}`,

  /** C++ 미션 코드 자동저장 */
  cppMissionCode: (unitId, idx) => `${PREFIX}autosave_cpp_mission_${unitId}_${idx}`,

  /** HTML 미션 코드 (html/css/js) */
  htmlMissionCode: (studentId, unitId, missionIdx, field) =>
    `${PREFIX}html_${studentId}_${unitId}_m${missionIdx}_${field}`,

  /** TripleEditor 자동저장 (html/css/js 통합 객체) */
  tripleEditorSave: (key) => `${PREFIX}triple_${key}`,

  /** MultiFileEditor 자동저장 (파일 배열) */
  multiFileEditorSave: (key) => `${PREFIX}mfe_${key}`,
};

// ── CRUD 헬퍼 ────────────────────────────────────────────────────────────────

export function storageSave(key, value) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch (_) {}
}

export function storageLoad(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch { return fallback; }
}

export function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (_) {}
}

/**
 * 특정 Unit의 모든 localStorage 데이터를 제거합니다.
 * Unit 삭제 시 또는 학생 데이터 초기화 시 호출하세요.
 */
export function clearUnitStorage(unitId, studentId = null) {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      const matchesUnit = key.includes(`_${unitId}_`) || key.includes(`_${unitId}`);
      const matchesStudent = studentId ? key.includes(`_${studentId}_`) : true;
      if (matchesUnit && matchesStudent) {
        localStorage.removeItem(key);
      }
    });
  } catch (_) {}
}

/**
 * 특정 학생의 모든 localStorage 데이터를 제거합니다.
 */
export function clearStudentStorage(studentId) {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes(`_${studentId}_`) || key.endsWith(`_${studentId}`)) {
        localStorage.removeItem(key);
      }
    });
  } catch (_) {}
}

export default { storageKeys, storageSave, storageLoad, storageRemove, clearUnitStorage, clearStudentStorage };