// CODA 학습 데이터 접근 레이어
// Python / 저학년 Python / C++ 단원은 GitHub JSON에서 조회합니다.
// 학습 진도, 퀴즈, 미션, 예제 연습은 Google Sheets API에 저장합니다.
// 기타 기존 관리자/과목 관리 함수에는 Base44 의존성이 남아 있습니다.
import { loadActiveUnitsFromRepo, loadUnitsFromRepo } from "./unitsRepo";
import { getStudentProgress as sheetsGetProgress, saveStudentProgress as sheetsSaveProgress, saveQuizResult as sheetsSaveQuiz, saveMissionSubmission as sheetsSaveMission } from "./sheetsApi";
import { base44 } from "@/api/base44Client";
import { adminListUnitOverrides, adminSaveUnitOverride } from "./sheetsApi";
import { adminListStudents, adminCreateStudent as sheetsCreateStudent, adminUpdateStudent as sheetsUpdateStudent, adminSetStudentStatus, adminResetStudentPassword } from "./sheetsApi";
import { getSessionToken, getSessionUser } from "./auth";
import { extractFunctionError } from "./errorUtils";

// ─── Base44 관리자 CRUD 헬퍼 ──────────────────────────────────
async function b44Action(action, params = {}) {
  const token = getSessionToken();
  const user = getSessionUser();
  const res = await base44.functions.invoke("base44AdminAction", {
    session_token: token || null,
    caller_login_id: user?.login_id || null,
    action,
    ...params,
  });
  const data = res?.data || res;
  if (!data?.success) {
    throw new Error(data?.error || "작업 실패");
  }
  return data;
}

// ─── AppUser 관리 (manageAppUser 백엔드 함수) ──────
async function appUserAction(action, params = {}) {
  const user = getSessionUser();
  const res = await base44.functions.invoke("manageAppUser", {
    caller_login_id: user?.login_id || null,
    action,
    ...params,
  });
  const data = res?.data || res;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listAppUsers() { return []; }
export async function createAppUser() { throw new Error("계정 관리 기능은 아직 이전되지 않았습니다."); }
export async function updateAppUser() { throw new Error("계정 관리 기능은 아직 이전되지 않았습니다."); }
export async function resetAppUserPassword(id, password) { return adminResetStudentPassword(id, password); }
export async function deleteAppUser() { throw new Error("계정 삭제는 지원하지 않습니다."); }

// ─── subjectType → Base44 Entity 이름 매핑 ─────
const UNIT_ENTITY_MAP = {
  python: "PythonUnit",
  junior_python: "JuniorPythonUnit",
  cpp: "CppUnit",
  html: "HTMLUnit",
  java: "JavaUnit",
  generic: "GenericUnit",
  entry: "EntryUnit",
  cos: "COSUnit",
  algorithm_learning: "AlgorithmUnit",
};

// ─── Unit 로드 (학생용 — 활성 Unit만) ──────────────────────────

export async function loadUnits(subjectType, { metadataOnly = false } = {}) {
  try {
    const units = await loadActiveUnitsFromRepo(subjectType);
    return units.map((unit) => ({
      ...unit,
      subject_type: subjectType,
      _source: "repo",
    }));
  } catch (err) {
    console.error(`[dataAccess] loadUnits(${subjectType}) 실패:`, err);
    return [];
  }
}



// ─── Generic Units (algorithm, other 등) ─────
export async function loadGenericUnits(subjectType, subjectId) {
  return loadUnits(subjectType);
}

// ─── Admin: Unit CRUD ─────
export async function loadAllUnits(subjectType) {
  const original = await loadUnitsFromRepo(subjectType);
  const response = await adminListUnitOverrides(subjectType);
  const replacements = new Map((response.units || []).map(unit => [String(unit.id), unit]));
  const merged = original.map(unit => replacements.get(String(unit.id)) || unit);
  const existing = new Set(original.map(unit => String(unit.id)));
  for (const unit of replacements.values()) if (!existing.has(String(unit.id))) merged.push(unit);
  return merged.sort((a,b) => Number(a.unit_number||0)-Number(b.unit_number||0));
}

// 관리자용: 데이터 출처 정보와 함께 반환
export async function loadAllUnitsWithSource(subjectType) {
  const units = await loadAllUnits(subjectType);
  return {units, source:"github-json+google-sheets-overrides", count:units.length};
}

// ─── 단일 Unit 전체 콘텐츠 로드 (수정 화면용) ─────────────────
export async function loadUnitContent(unitId) {
  for (const type of ["python", "junior_python", "cpp"]) {
    const units = await loadUnitsFromRepo(type);
    const unit = units.find(u => String(u.id) === String(unitId));
    if (unit) return unit;
  }
  return null;
}

export async function saveUnit(subjectType, unit) {
  if (!["python", "junior_python", "cpp"].includes(subjectType)) throw new Error("지원하지 않는 과목입니다.");
  return adminSaveUnitOverride(subjectType, unit);
}

// Unit 삭제
export async function deleteUnit(...args) { throw new Error("단원 변경은 아직 연결되지 않았습니다. 기존 데이터를 보호하기 위해 저장을 중단했습니다."); }

// 특정 과목 Unit 전체 삭제
export async function deleteUnitsBySubject(...args) { throw new Error("단원 변경은 아직 연결되지 않았습니다. 기존 데이터를 보호하기 위해 저장을 중단했습니다."); }

// Unit 활성화 토글
export async function toggleUnitActive(...args) { throw new Error("단원 변경은 아직 연결되지 않았습니다. 기존 데이터를 보호하기 위해 저장을 중단했습니다."); }

// ─── Admin: Unit 관련 데이터 일괄 삭제 ──
export async function deleteProgressByUnit(...args) { throw new Error("단원 변경은 아직 연결되지 않았습니다. 기존 데이터를 보호하기 위해 저장을 중단했습니다."); }

export async function deleteSubmissionsByUnit(...args) { throw new Error("단원 변경은 아직 연결되지 않았습니다. 기존 데이터를 보호하기 위해 저장을 중단했습니다."); }

// ─── 학습 기록: Google Sheets / Apps Script ────────────────────────────────
// 세 과목의 JSON 단원 ID를 사용해 서버에서 요구하는 subject를 찾습니다.
const CODA_SUBJECTS = ["python", "junior_python", "cpp"];
let unitSubjectIndexPromise;
async function unitSubjectIndex() {
  if (!unitSubjectIndexPromise) {
    unitSubjectIndexPromise = Promise.all(CODA_SUBJECTS.map(async subject => {
      const units = await loadUnitsFromRepo(subject);
      return units.map(u => [String(u.id), subject]);
    })).then(groups => new Map(groups.flat())).catch(err => {
      unitSubjectIndexPromise = null;
      throw err;
    });
  }
  return unitSubjectIndexPromise;
}
async function resolveSubject(unitId, context = {}) {
  const explicit = context.unitType || context.subject_type || context.subject;
  if (CODA_SUBJECTS.includes(explicit)) return explicit;
  const index = await unitSubjectIndex();
  const subject = index.get(String(unitId));
  if (!subject) throw new Error(`지원하지 않는 단원입니다: ${unitId}`);
  return subject;
}
function assertOwnStudent(studentId) {
  const current = getSessionUser()?.student_id;
  if (!current || String(studentId) !== String(current)) {
    throw new Error("현재 로그인한 학생의 학습 기록만 조회·저장할 수 있습니다.");
  }
}
const readLearning = () => sheetsGetProgress();
const asObject = v => v && typeof v === "object" && !Array.isArray(v) ? v : {};
function normalizeProgress(r) {
  let stored = r.data ?? r.progress_data ?? {};
  if (typeof stored === "string") {
    try { stored = JSON.parse(stored); } catch { stored = {}; }
  }
  return {
    ...asObject(stored),
    student_id: r.student_id,
    subject_type: r.subject,
    unit_type: r.subject,
    unit_id: r.unit_id,
    completed: r.completed === true || String(r.completed).toLowerCase() === "true",
    last_studied_at: r.last_accessed,
    last_accessed: r.last_accessed,
  };
}
function normalizeSubmission(r, type) {
  const d = asObject(r.data);
  const num = type === "question" ? r.item_number : r.mission_number;
  return {
    ...d,
    id: `${type}:${r.unit_id}:${num}`,
    student_id: r.student_id,
    unit_id: r.unit_id,
    item_type: type,
    item_number: num,
    data: d,
    is_correct: type === "question" ? d.is_correct === true : r.is_correct === true || String(r.is_correct).toLowerCase() === "true",
    submitted_at: r.submitted_at,
  };
}
export async function loadAllProgress(studentId) {
  if (!studentId) return [];
  assertOwnStudent(studentId);
  const result = await readLearning();
  return (result.progress || [])
    .filter(r => !r.student_id || String(r.student_id) === String(studentId))
    .map(normalizeProgress);
}
export async function loadProgress(studentId, unitId) {
  if (!studentId || !unitId) return null;
  return (await loadAllProgress(studentId)).find(p => String(p.unit_id) === String(unitId)) || null;
}
// 진도 ID를 정규화하고, 현재 단원의 실제 항목 수를 기준으로 완료를 계산합니다.
function normalizedIds(value, count) {
  let ids = value;
  if (typeof ids === "string") {
    try { ids = JSON.parse(ids); } catch { ids = []; }
  }
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < count))].sort((a, b) => a - b);
}

const PROGRESS_ONLY_FIELDS = [
  "completed_example_ids", "completed_question_ids", "completed_mission_ids",
  "current_example_index", "current_question_index", "current_mission_index",
  "example_progress_rate", "question_progress_rate", "mission_progress_rate",
  "is_unit_completed", "is_completed", "completed", "last_studied_at", "memo",
  "latest_question_answers", "latest_mission_codes"
];

export async function saveProgress(studentId, unitId, data, context = {}) {
  if (!studentId || !unitId) return;
  assertOwnStudent(studentId);
  const subject = await resolveSubject(unitId, context);
  const [existing, units] = await Promise.all([
    loadProgress(studentId, unitId), loadUnitsFromRepo(subject)
  ]);
  const unit = units.find(u => String(u.id) === String(unitId));
  if (!unit) throw new Error(`단원 정보를 찾을 수 없습니다: ${unitId}`);

  // 기존 제출 코드·실행 결과·개별 답안은 새 진행도 데이터에 포함하지 않습니다.
  const source = { ...asObject(existing), ...asObject(data) };
  const merged = {};
  for (const key of PROGRESS_ONLY_FIELDS) {
    if (source[key] !== undefined) merged[key] = source[key];
  }
  const counts = {
    example: unit.example_codes?.length || 0,
    question: unit.questions?.length || 0,
    mission: unit.missions?.length || 0,
  };
  for (const [type, count] of Object.entries(counts)) {
    const ids = normalizedIds(merged[`completed_${type}_ids`], count);
    merged[`completed_${type}_ids`] = ids;
    merged[`current_${type}_index`] = ids.length;
    merged[`${type}_progress_rate`] = count ? (ids.length / count) * 100 : 100;
  }
  const total = counts.example + counts.question + counts.mission;
  const isDone = total > 0 && Object.entries(counts).every(([type, count]) =>
    merged[`completed_${type}_ids`].length === count
  );
  merged.is_unit_completed = isDone;
  merged.is_completed = isDone;
  merged.completed = isDone;
  merged.student_name = context.studentName || existing?.student_name || "";
  merged.unit_title = context.unitTitle || existing?.unit_title || unit.title || "";
  merged.last_studied_at = new Date().toISOString();
  await sheetsSaveProgress({ subject, unitId: String(unitId), completed: isDone, data: merged });
  return { ...merged, student_id: studentId, unit_id: unitId };
}
export async function loadSubmissions(studentId, unitId, itemType) {
  if (!studentId || !unitId) return [];
  assertOwnStudent(studentId);
  const result = await readLearning();
  const rows = [
    ...(result.quiz_results || []).map(r => normalizeSubmission(r, "question")),
    ...(result.mission_submissions || []).map(r => normalizeSubmission(r, "mission")),
    ...((result.progress || []).flatMap(r => {
      const examples = asObject(r.data).example_practices || {};
      return Object.entries(examples).map(([num, data]) => ({
        id: `example:${r.unit_id}:${num}`, student_id: r.student_id,
        unit_id: r.unit_id, item_type: "example", item_number: Number(num),
        data, is_correct: data.is_matched === true, submitted_at: data.tried_at,
      }));
    })),
  ];
  return rows.filter(r => String(r.unit_id) === String(unitId) && (!itemType || r.item_type === itemType))
    .sort((a,b) => Number(a.item_number || 0) - Number(b.item_number || 0));
}
export async function loadExamplePractices(studentId, unitId) {
  const rows = await loadSubmissions(studentId, unitId, "example");
  return rows.map(r => ({
    id: r.id, example_index: r.item_number,
    filename: r.data?.filename || "", typed_code: r.data?.typed_code || "",
    stdin: r.data?.stdin || "", execution_result: r.data?.execution_result || "",
    expected_output: r.data?.expected_output || "", is_matched: r.is_correct,
    tried_at: r.submitted_at,
  }));
}
export async function loadQuestionResults(studentId, unitId) {
  const rows = await loadSubmissions(studentId, unitId, "question");
  return rows.map(r => ({
    id: r.id, question_number: r.item_number, answer: r.data?.answer ?? "",
    is_correct: r.is_correct, question_type: r.data?.question_type || "",
    attempt_count: r.data?.attempt_count || 1, answered_at: r.submitted_at,
  }));
}
export async function loadMissionSubmissions(studentId, unitId) {
  const rows = await loadSubmissions(studentId, unitId, "mission");
  return rows.map(r => ({
    id: r.id, mission_number: r.item_number,
    submitted_code: r.data?.submitted_code || "",
    submitted_stdin: r.data?.submitted_stdin || "",
    execution_result: r.data?.execution_result || "",
    expected_output: r.data?.expected_output || "",
    is_correct: r.is_correct, grading_mode: r.data?.grading_mode || "normalize",
    test_case_results: r.data?.test_case_results || [], submitted_at: r.submitted_at,
  }));
}
// 제출 이력은 저장하지 않습니다. 정답으로 제출된 항목의 ID만 StudentProgress에 저장합니다.
// 화면에서 사용하는 기존 함수 시그니처는 유지합니다.
async function saveCompletedItem(studentId, unitId, type, index, isCorrect, context, progressUpdate, submission = null) {
  assertOwnStudent(studentId);
  const subject = await resolveSubject(unitId, context);
  const units = await loadUnitsFromRepo(subject);
  const unit = units.find(u => String(u.id) === String(unitId));
  if (!unit) throw new Error(`단원 정보를 찾을 수 없습니다: ${unitId}`);
  const count = type === "example" ? (unit.example_codes?.length || 0)
    : type === "question" ? (unit.questions?.length || 0) : (unit.missions?.length || 0);
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= count) throw new Error(`잘못된 ${type} 항목 번호입니다: ${index}`);
  if (!isCorrect && !submission) return { saved: false, reason: "incorrect" };
  const existing = await loadProgress(studentId, unitId);
  const key = `completed_${type}_ids`;
  const current = normalizedIds(existing?.[key], count);
  const incoming = normalizedIds(asObject(progressUpdate)[key], count);
  const ids = isCorrect ? [...new Set([...current, ...incoming, idx])].sort((a, b) => a - b) : current;
  const update = { [key]: ids };
  // One compact latest submission per item, not a growing attempt history.
  if (submission && (type === "question" || type === "mission")) {
    const field = type === "question" ? "latest_question_answers" : "latest_mission_codes";
    const old = asObject(existing?.[field]);
    update[field] = { ...old, [String(idx)]: submission };
  }
  await saveProgress(studentId, unitId, update, context);
  return { saved: true, completed_ids: ids };
}
export async function saveExamplePractice(studentId, unitId, exampleIndex, data, context = {}, progressUpdate = null) {
  return saveCompletedItem(studentId, unitId, "example", exampleIndex, data?.is_matched === true, context, progressUpdate);
}
export async function saveQuestionResult(studentId, unitId, questionNumber, data, context = {}, progressUpdate = null) {
  const subject = await resolveSubject(unitId, context);
  const units = await loadUnitsFromRepo(subject);
  const unit = units.find(u => String(u.id) === String(unitId));
  const index = unit?.questions?.findIndex((q, i) => Number(q.number || i + 1) === Number(questionNumber)) ?? -1;
  return saveCompletedItem(studentId, unitId, "question", index, data?.is_correct === true, context, progressUpdate, {
    answer: String(data?.answer ?? "").slice(0, 1500),
    correct: data?.is_correct === true,
    at: new Date().toISOString(),
  });
}
export async function saveMissionSubmission(studentId, unitId, missionNumber, data, context = {}, progressUpdate = null) {
  const subject = await resolveSubject(unitId, context);
  const units = await loadUnitsFromRepo(subject);
  const unit = units.find(u => String(u.id) === String(unitId));
  const index = unit?.missions?.findIndex((m, i) => Number(m.number || i + 1) === Number(missionNumber)) ?? -1;
  // 기존 MissionPanel은 정답이면서 테스트케이스가 없고 expected 출력도 없으면 통과 처리합니다.
  // 서버 진도 저장은 실제 정답 판정에 따라 수행합니다.
  // progressUpdate 유무로 정답 여부를 판단하면 재제출 시 저장이 누락될 수 있습니다.
  return saveCompletedItem(studentId, unitId, "mission", index, data?.is_correct === true, context, progressUpdate, {
    code: String(data?.submitted_code ?? "").slice(0, 12000),
    correct: data?.is_correct === true,
    at: new Date().toISOString(),
  });
}

// ─── 학생 전용 학습 컨텍스트 (Base44 Entity 직접 조회) ───
export async function getStudentLearningContext(token) {
  // 이 함수는 더 이상 사용되지 않음 — StudentLayout에서 개별 조회함.
  // 호환성을 위해 null 반환.
  return null;
}

// ─── 학생용 AlgorithmUnit 로드 (Base44 Entity + 클라이언트 sanitize) ──
export async function loadStudentAlgorithmUnits() {
  try {
    const items = await base44.entities.AlgorithmUnit.filter({ is_active: true }, "unit_number", 5000);
    return (items || []).map(unit => {
      const u = { ...unit, subject_type: "algorithm_learning", _source: "base44" };

      // implementations에서 answer_code 제거 + hidden TC 데이터 제거
      if (u.implementations) {
        u.implementations = u.implementations.map(impl => {
          const { answer_code, ...rest } = impl;
          if (rest.test_cases) {
            rest.test_cases = rest.test_cases.map(tc => tc.hidden ? { hidden: true } : tc);
          }
          return rest;
        });
      }

      // missions에서 answer_code 제거 + hidden TC 데이터 제거
      if (u.missions) {
        u.missions = u.missions.map(m => {
          const { answer_code, ...rest } = m;
          if (rest.test_cases) {
            rest.test_cases = rest.test_cases.map(tc => tc.hidden ? { hidden: true } : tc);
          }
          return rest;
        });
      }

      // judge_problems에서 answer_code 제거 + hidden TC 데이터 제거 + 미공개 필터
      if (u.judge_problems) {
        u.judge_problems = u.judge_problems
          .filter(p => p.is_published !== false)
          .map(p => {
            const { answer_code, ...publicFields } = p;
            if (publicFields.test_cases) {
              publicFields.test_cases = publicFields.test_cases.map(tc => {
                if (tc.hidden) {
                  return { id: tc.id, hidden: true, description: tc.description || '' };
                }
                return tc;
              });
            }
            return publicFields;
          });
      }

      return u;
    });
  } catch (err) {
    console.warn("[dataAccess] loadStudentAlgorithmUnits 실패:", err.message);
    return [];
  }
}

// ─── Student ──────────────────────────────────────────────────────
export async function loadStudent(studentId) {
  if (!studentId) return null;
  try {
    const data = await b44Action("get_student", { student_id: studentId });
    return data.student || null;
  } catch (err) {
    console.warn("[dataAccess] loadStudent 실패:", err.message);
    return null;
  }
}

export async function loadStudentByLoginId(loginId) {
  if (!loginId) return null;
  try {
    const data = await b44Action("get_student_by_login_id", { login_id: loginId });
    return data.student || null;
  } catch (err) {
    console.warn("[dataAccess] loadStudentByLoginId 실패:", err.message);
    return null;
  }
}

// ─── 학생 전체 조회 ──
export async function loadAllStudents() {
  const data = await adminListStudents();
  return data.students || [];
}

export async function createStudent(data) { return sheetsCreateStudent(data); }

export async function updateStudent(id, data) { return sheetsUpdateStudent(id, data); }

export async function deleteStudent(id) { throw new Error("학생 데이터 보호를 위해 삭제는 비활성화되어 있습니다. 계정 비활성화를 이용하세요."); }

// ─── Subject ───────────────────────────────────────────────────────
export async function loadActiveSubjects() {
  return [
    { id: "python", name: "Python", type: "python", is_active: true, color: "#3B82F6" },
    { id: "junior_python", name: "저학년 Python", type: "junior_python", is_active: true, color: "#84CC16" },
    { id: "cpp", name: "C++", type: "cpp", is_active: true, color: "#2563EB" },
  ];
}

export async function loadAllSubjects() {
  return [
    { id: "python", name: "Python", type: "python", is_active: true, color: "#3B82F6" },
    { id: "junior_python", name: "저학년 Python", type: "junior_python", is_active: true, color: "#84CC16" },
    { id: "cpp", name: "C++", type: "cpp", is_active: true, color: "#2563EB" },
  ];
}

export async function loadAllSubjectsAdmin() {
  return [
    { id: "python", name: "Python", type: "python", is_active: true, color: "#3B82F6" },
    { id: "junior_python", name: "저학년 Python", type: "junior_python", is_active: true, color: "#84CC16" },
    { id: "cpp", name: "C++", type: "cpp", is_active: true, color: "#2563EB" },
  ];
}

export async function createSubject(data) {
  return b44Action("create_subject", data);
}

export async function updateSubject(id, data) {
  return b44Action("update_subject", { id, ...data });
}

export async function deleteSubject(id) {
  return b44Action("delete_subject", { id });
}

export async function hardDeleteSubject(id) {
  return b44Action("hard_delete_subject", { id });
}

// ─── Enrollment ────────────────────────────────────────────────────
export async function loadEnrollments(studentId) {
  if (!studentId) return [];
  try {
    const data = await b44Action("list_enrollments_by_student", { student_id: studentId });
    return data.enrollments || [];
  } catch (err) {
    console.warn("[dataAccess] loadEnrollments 실패:", err.message);
    return [];
  }
}

export async function loadAllEnrollments() {
  try {
    const data = await b44Action("list_enrollments");
    return data.enrollments || [];
  } catch (err) {
    console.warn("[dataAccess] loadAllEnrollments 실패:", err.message);
    return [];
  }
}

export async function loadEnrollmentsBySubject(subjectId) {
  if (!subjectId) return [];
  try {
    const data = await b44Action("list_enrollments_by_subject", { subject_id: subjectId });
    return data.enrollments || [];
  } catch (err) {
    console.warn("[dataAccess] loadEnrollmentsBySubject 실패:", err.message);
    return [];
  }
}

export async function createEnrollment(data) {
  return b44Action("create_enrollment", data);
}

export async function updateEnrollment(id, data) {
  return b44Action("update_enrollment", { id, ...data });
}

export async function deleteEnrollment(id) {
  return b44Action("delete_enrollment", { id });
}

// ─── Admin: 학생 관련 데이터 일괄 삭제 ─────────────────────────────
export async function deleteProgressByStudent(studentId) {
  return b44Action("delete_progress_by_student", { student_id: studentId });
}

export async function deleteSubmissionsByStudent(studentId) {
  return b44Action("delete_submissions_by_student", { student_id: studentId });
}

// ─── 학생 저장 검증 ──
export async function verifyStudentExists(studentId) {
  if (!studentId) return false;
  try {
    const data = await b44Action("verify_student", { student_id: studentId });
    return !!data.exists;
  } catch (err) {
    console.warn("[dataAccess] verifyStudentExists 실패:", err.message);
    return false;
  }
}

// ─── 통합 학생 생성 ──
export async function adminCreateStudent(data) { return sheetsCreateStudent(data); }