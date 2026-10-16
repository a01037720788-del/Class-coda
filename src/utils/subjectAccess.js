/**
 * 과목 접근 권한 공통 유틸 (학생 전용 사이트 — Python / 저학년 Python / C++ 3과목)
 * - subject_permissions (name or subject_id 기반)
 * - studentData.subjects 배열
 * - Enrollment 데이터
 * 세 가지 모두 고려하여 과목 접근 허용 여부를 결정합니다.
 */

// 과목 타입 → 식별에 사용할 alias 목록 (소문자 정규화 후 비교)
const SUBJECT_ALIASES = {
  junior_python: ["저학년python", "저학년파이썬", "juniorpython", "junior_python"],
  python:        ["python", "파이썬"],
  cpp:           ["c++", "cpp", "cplusplus", "씨플플", "씨쁠쁠"],
};

// 지원하는 과목 설정 (표시 순서)
export const SUBJECT_CONFIGS = [
  { key: "python",        label: "Python",        desc: "Python 프로그래밍 기초부터 실습까지",      path: "/student/python",        gradient: "from-green-600 to-emerald-500", accent: "green" },
  { key: "junior_python", label: "저학년 Python", desc: "초등 저학년을 위한 쉬운 Python 기초 과정", path: "/student/junior-python", gradient: "from-lime-500 to-green-400",    accent: "green" },
  { key: "cpp",           label: "C++",           desc: "C++ 문법과 알고리즘 실습",                path: "/student/cpp",           gradient: "from-blue-700 to-cyan-500",     accent: "cyan"  },
];

/** 문자열 정규화 (소문자 + 특수문자 제거) */
export function normalizeSubjectName(name = "") {
  return name.toLowerCase().replace(/[\s\\/\-_.]/g, "");
}

/**
 * 과목 이름, subject_id, 또는 Subject 엔티티에서 subjectType(key)을 반환
 */
export function getSubjectType(name, subjectList = []) {
  if (!name) return null;

  // 1. subject_id인 경우 → Subject 엔티티에서 name과 type으로 변환
  const subj = subjectList.find(s => s.id === name);
  if (subj) {
    if (subj.type && SUBJECT_ALIASES[subj.type]) return subj.type;
    const n = normalizeSubjectName(subj.name);
    for (const [key, aliases] of Object.entries(SUBJECT_ALIASES)) {
      if (aliases.some(alias => n === normalizeSubjectName(alias) || n.includes(normalizeSubjectName(alias)))) {
        return key;
      }
    }
  }

  // 2. name이 직접 과목명인 경우
  const n = normalizeSubjectName(name);
  for (const [key, aliases] of Object.entries(SUBJECT_ALIASES)) {
    if (aliases.some(alias => n === normalizeSubjectName(alias) || n.includes(normalizeSubjectName(alias)))) {
      return key;
    }
  }

  // 3. exact key match fallback (e.g. "junior_python" stored directly)
  if (SUBJECT_ALIASES[n]) return n;
  return null;
}

/**
 * 학생이 특정 과목(subjectKey)에 접근 가능한지 확인
 */
export function hasSubjectAccess(subjectKey, studentData, subjectList = [], enrollments = []) {
  if (!studentData) return false;

  // 1. subject_permissions (key = 과목명 or subject_id)
  const perms = studentData.subject_permissions || {};
  for (const [k, v] of Object.entries(perms)) {
    if (!v) continue;
    if (getSubjectType(k, subjectList) === subjectKey) return true;
  }

  // 2. subjects 배열
  for (const s of (studentData.subjects || [])) {
    if (getSubjectType(s, subjectList) === subjectKey) return true;
  }

  // 3. Enrollment
  for (const e of enrollments) {
    if (getSubjectType(e.subject_name, subjectList) === subjectKey) return true;
    if (getSubjectType(e.subject_id, subjectList) === subjectKey) return true;
  }

  return false;
}

/**
 * 학생이 접근 가능한 모든 과목 key Set 반환
 */
export function resolveActiveSubjects(studentData, subjectList = [], enrollments = []) {
  const inactiveSubjectTypes = new Set(
    subjectList
      .filter(s => s.is_active === false && s.type)
      .map(s => s.type)
  );
  subjectList
    .filter(s => s.is_active === false && !s.type)
    .forEach(s => {
      const t = getSubjectType(s.name, []);
      if (t) inactiveSubjectTypes.add(t);
    });

  const active = new Set();
  for (const cfg of SUBJECT_CONFIGS) {
    if (inactiveSubjectTypes.has(cfg.key)) continue;
    if (hasSubjectAccess(cfg.key, studentData, subjectList, enrollments)) {
      active.add(cfg.key);
    }
  }
  return active;
}