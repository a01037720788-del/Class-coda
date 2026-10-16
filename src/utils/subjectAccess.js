/**
 * 과목 접근 권한 공통 유틸
 * - subject_permissions (name or subject_id 기반)
 * - studentData.subjects 배열
 * - Enrollment 데이터
 * 세 가지 모두 고려하여 과목 접근 허용 여부를 결정합니다.
 */

// 과목 타입 → 식별에 사용할 alias 목록 (소문자 정규화 후 비교)
const SUBJECT_ALIASES = {
  junior_python:  ["저학년python", "저학년파이썬", "juniorpython", "junior_python"],
  python:         ["python", "파이썬"],
  cpp:            ["c++", "cpp", "cplusplus", "씨플플", "씨쁠쁠"],
  java:           ["java", "자바"],
  algorithm:      ["알고리즘", "algorithm"],
  algorithm_learning: ["알고리즘학습", "알고리즘기초", "algorithmlearning", "algorithm_learning"],
  html:           ["html", "web", "웹"],
  entry:          ["엔트리", "entry"],
  block:          ["블록코딩", "block", "블록"],
  cos:            ["cos", "cos자격증"],
};

// 지원하는 모든 과목 설정 (표시 순서)
export const SUBJECT_CONFIGS = [
  { key: "python",        label: "Python 학습",        desc: "Python 프로그래밍 기초부터 실습까지",       path: "/student/python",        gradient: "from-green-600 to-emerald-500",  accent: "green"  },
  { key: "junior_python", label: "저학년 Python 학습", desc: "초등 저학년을 위한 쉬운 Python 기초 과정",  path: "/student/junior-python", gradient: "from-lime-500 to-green-400",     accent: "green"  },
  { key: "cpp",           label: "C++ 학습",           desc: "C++ 문법과 알고리즘 실습",                 path: "/student/cpp",           gradient: "from-blue-700 to-cyan-500",      accent: "cyan"   },
  { key: "algorithm",     label: "알고리즘 문제풀이",  desc: "알고리즘 문제 풀이 및 코딩 실력 향상",      path: "/student/algorithm",     gradient: "from-indigo-600 to-indigo-400",  accent: "indigo" },
  { key: "algorithm_learning", label: "알고리즘 학습", desc: "개념→시뮬레이션→구현→문제풀이 알고리즘 학습", path: "/student/algorithm-learning", gradient: "from-violet-600 to-purple-500", accent: "violet" },
  { key: "html",          label: "HTML 학습",          desc: "HTML / CSS / JavaScript 웹 개발 기초",      path: "/student/html",          gradient: "from-orange-500 to-amber-400",   accent: "orange" },
  { key: "entry",         label: "엔트리 학습",        desc: "엔트리로 배우는 블록 코딩",                 path: "/student/entry",         gradient: "from-purple-500 to-violet-500",  accent: "purple" },
  { key: "block",         label: "블록코딩 학습",      desc: "블록 코딩으로 프로그래밍 기초 익히기",      path: "/student/block-coding",  gradient: "from-pink-500 to-rose-400",      accent: "pink"   },
  { key: "cos",           label: "COS 학습",           desc: "COS 코딩 자격증 대비 학습",                 path: "/student/cos",           gradient: "from-teal-500 to-cyan-500",      accent: "teal"   },
];

/** 문자열 정규화 (소문자 + 특수문자 제거) */
export function normalizeSubjectName(name = "") {
  return name.toLowerCase().replace(/[\s\\/\-_.]/g, "");
}

/**
 * 과목 이름, subject_id, 또는 Subject 엔티티에서 subjectType(key)을 반환
 * @param {string} name - 과목명 or subject_id
 * @param {Array}  subjectList - Subject 엔티티 목록 (id→name/type 변환용)
 * @returns {string|null} SUBJECT_ALIASES의 key (e.g. "python") or null
 */
export function getSubjectType(name, subjectList = []) {
  if (!name) return null;

  // 1. subject_id인 경우 → Subject 엔티티에서 name과 type으로 변환
  const subj = subjectList.find(s => s.id === name);
  if (subj) {
    // type 필드가 있고 알려진 key이면 type 우선 사용
    if (subj.type && SUBJECT_ALIASES[subj.type]) return subj.type;
    // type이 없거나 알 수 없으면 name으로 추론
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
 * @param {string}  subjectKey  - SUBJECT_ALIASES의 key (e.g. "html", "python")
 * @param {Object}  studentData - Student 엔티티 레코드
 * @param {Array}   subjectList - Subject 엔티티 목록
 * @param {Array}   enrollments - Enrollment 엔티티 목록 (해당 학생 것)
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
 * Subject 엔티티의 is_active 상태도 반영 (비활성 과목은 표시 안 함)
 */
export function resolveActiveSubjects(studentData, subjectList = [], enrollments = []) {
  // 비활성(is_active === false) Subject의 type key Set — 이것만 제외
  const inactiveSubjectTypes = new Set(
    subjectList
      .filter(s => s.is_active === false && s.type)
      .map(s => s.type)
  );
  // type 없는 기존 Subject는 이름으로 추론해서 비활성 목록에 추가
  subjectList
    .filter(s => s.is_active === false && !s.type)
    .forEach(s => {
      const t = getSubjectType(s.name, []);
      if (t) inactiveSubjectTypes.add(t);
    });

  const active = new Set();
  for (const cfg of SUBJECT_CONFIGS) {
    // 비활성 과목이면 스킵
    if (inactiveSubjectTypes.has(cfg.key)) continue;
    if (hasSubjectAccess(cfg.key, studentData, subjectList, enrollments)) {
      active.add(cfg.key);
    }
  }
  return active;
}