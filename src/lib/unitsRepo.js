/**
 * 단원(Unit) 콘텐츠 로더 — 정적 JSON
 *
 * 단원 학습 내용은 저장소의 public/data/units/*.json 에 들어 있습니다.
 * GitHub Pages 가 이 파일을 정적으로 서빙하므로 데이터베이스가 필요 없습니다.
 * (관리자 전용 정답 코드 answer_code 는 내보낼 때 제거했습니다.)
 *
 * 파일을 다시 만들려면 scripts/export-units.mjs 를 참고하세요.
 */

const BASE = import.meta.env.BASE_URL || "/";
const cache = new Map();

const VALID_SUBJECTS = ["python", "junior_python", "cpp", "cos_pro_3", "cos_pro_2"];

export function isSupportedSubject(subjectType) {
  return VALID_SUBJECTS.includes(subjectType);
}

/** 해당 과목의 전체 단원을 반환합니다 (비활성 포함). */
export async function loadUnitsFromRepo(subjectType) {
  if (!isSupportedSubject(subjectType)) return [];
  if (cache.has(subjectType)) return cache.get(subjectType);

  const res = await fetch(`${BASE}data/units/${subjectType}.json`);
  if (!res.ok) throw new Error(`단원 데이터를 불러올 수 없습니다 (${subjectType}, HTTP ${res.status})`);

  const units = await res.json();
  cache.set(subjectType, units);
  return units;
}

/** 학생 화면용: 활성 단원만, 단원 번호 순으로 반환합니다. */
export async function loadActiveUnitsFromRepo(subjectType) {
  const units = await loadUnitsFromRepo(subjectType);
  return units
    .filter((u) => u.is_active !== false)
    .sort((a, b) => (a.unit_number || 0) - (b.unit_number || 0));
}

/** 과목별 실제 단원 수. 관리자 저장분까지 포함하며 고정 index.json 숫자를 사용하지 않습니다. */
export async function loadUnitsSummary() {
  const { loadUnits } = await import("./dataAccess");
  return Promise.all(VALID_SUBJECTS.map(async key => {
    const units = await loadUnits(key);
    return { key, units: units.length };
  }));
}

export default { loadUnitsFromRepo, loadActiveUnitsFromRepo, loadUnitsSummary, isSupportedSubject };