// 핵심 학습 데이터 접근 레이어 (Base44 Entity 전용)
//
// 모든 데이터는 Base44 Entity를 통해 접근합니다. Supabase 의존성 완전 제거.
// 학생/과목/수강관리는 base44AdminAction 백엔드 함수 사용.
// Unit/진도/제출 데이터는 Base44 Entity 직접 조회.

import { base44 } from "@/api/base44Client";
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

export async function listAppUsers() {
  try {
    const data = await appUserAction("list");
    return data.users || [];
  } catch (err) {
    console.warn("[dataAccess] listAppUsers 실패:", err.message);
    return [];
  }
}

export async function createAppUser(userData) {
  return appUserAction("create", userData);
}

export async function updateAppUser(id, updateData) {
  return appUserAction("update", { id, data: updateData });
}

export async function resetAppUserPassword(id, newPassword) {
  return appUserAction("resetPassword", { id, newPassword });
}

export async function deleteAppUser(id) {
  return appUserAction("delete", { id });
}

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
  const entityName = UNIT_ENTITY_MAP[subjectType];
  if (!entityName || !base44.entities[entityName]) return [];
  try {
    const items = await base44.entities[entityName].filter({ is_active: true }, "unit_number", 5000);
    return items.map((u) => ({
      ...u,
      subject_type: subjectType,
      _source: "base44",
    }));
  } catch (err) {
    console.warn(`[dataAccess] loadUnits(${subjectType}) 실패:`, err.message);
    return [];
  }
}

// ─── Generic Units (algorithm, other 등) ─────
export async function loadGenericUnits(subjectType, subjectId) {
  return loadUnits(subjectType);
}

// ─── Admin: Unit CRUD ─────
export async function loadAllUnits(subjectType) {
  try {
    const res = await base44.functions.invoke("loadUnitsAdmin", { subjectType });
    const data = res?.data || res;
    if (data && data.units && data.units.length > 0) {
      return data.units;
    }
  } catch (err) {
    console.warn("[dataAccess] loadUnitsAdmin 실패:", err.message);
  }
  // 폴백: 직접 Base44 Entity 조회
  const entityName = UNIT_ENTITY_MAP[subjectType];
  if (entityName && base44.entities[entityName]) {
    try {
      const items = await base44.entities[entityName].list("unit_number", 5000);
      return items.map((u) => ({
        ...u,
        subject_type: subjectType,
        _source: "base44",
        concept_sections_count: u.concept_sections?.length || 0,
        tables_count: u.tables?.length || 0,
        example_codes_count: u.example_codes?.length || 0,
        questions_count: u.questions?.length || 0,
        missions_count: u.missions?.length || 0,
        summary_count: u.summary?.length || 0,
      }));
    } catch (err) {
      console.warn(`[dataAccess] ${entityName} 조회 실패:`, err.message);
    }
  }
  return [];
}

// 관리자용: 데이터 출처 정보와 함께 반환
export async function loadAllUnitsWithSource(subjectType) {
  try {
    const res = await base44.functions.invoke("loadUnitsAdmin", { subjectType });
    const data = res?.data || res;
    return {
      units: data?.units || [],
      source: data?.source || "base44",
      count: data?.count || 0,
      entityCounts: data?.entityCounts,
      error: data?.error,
    };
  } catch (err) {
    console.warn("[dataAccess] loadUnitsAdmin 실패:", err.message);
    return { units: [], source: "error", count: 0, error: err.message };
  }
}

// ─── 단일 Unit 전체 콘텐츠 로드 (수정 화면용) ─────────────────
export async function loadUnitContent(unitId) {
  if (!unitId) return null;
  try {
    const res = await base44.functions.invoke("loadUnitsAdmin", { unitId });
    const data = res?.data || res;
    return data?.unit || null;
  } catch (err) {
    console.warn("[dataAccess] loadUnitContent 실패:", err.message);
    return null;
  }
}

export async function saveUnit(unitData) {
  const { id, subject_type, subject_id, unit_number, title, subtitle, is_active, ...content } = unitData;
  const token = getSessionToken();
  if (!token) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
  const user = getSessionUser();
  try {
    const res = await base44.functions.invoke("unitAdminAction", {
      action: "save",
      session_token: token,
      caller_login_id: user?.login_id || null,
      unit_data: unitData,
    });
    const data = res?.data || res;
    if (!data?.success) {
      throw new Error(data?.error || "Unit 저장 실패");
    }
    return data;
  } catch (err) {
    const realError = extractFunctionError(err, "Unit 저장 실패");
    throw new Error(realError);
  }
}

// Unit 삭제
export async function deleteUnit(unitOrId) {
  if (!unitOrId) return;
  const unitId = typeof unitOrId === "object" ? unitOrId.id : unitOrId;
  const subjectType = typeof unitOrId === "object" ? unitOrId.subject_type : null;
  if (typeof unitOrId === "object" && unitOrId !== null) {
    const entityName = UNIT_ENTITY_MAP[subjectType];
    if (unitOrId._source === "base44" && entityName && base44.entities[entityName]) {
      return base44.entities[entityName].delete(unitId);
    }
  }
  const token = getSessionToken();
  if (!token) throw new Error("인증이 필요합니다.");
  const user = getSessionUser();
  const res = await base44.functions.invoke("unitAdminAction", {
    action: "delete",
    session_token: token,
    caller_login_id: user?.login_id || null,
    unit_id: unitId,
    subject_type: subjectType,
  });
  return res?.data || res;
}

// 특정 과목 Unit 전체 삭제
export async function deleteUnitsBySubject(subjectType) {
  const res = await base44.functions.invoke("deleteUnitsBySubject", { subjectType });
  return res?.data || res;
}

// Unit 활성화 토글
export async function toggleUnitActive(id, isActive) {
  const token = getSessionToken();
  if (!token) throw new Error("인증이 필요합니다.");
  const user = getSessionUser();
  const res = await base44.functions.invoke("unitAdminAction", {
    action: "toggle",
    session_token: token,
    caller_login_id: user?.login_id || null,
    unit_id: id,
    is_active: isActive,
  });
  return res?.data || res;
}

// ─── Admin: Unit 관련 데이터 일괄 삭제 ──
export async function deleteProgressByUnit(unitId) {
  const token = getSessionToken();
  if (!token) throw new Error("인증이 필요합니다.");
  const user = getSessionUser();
  const res = await base44.functions.invoke("unitAdminAction", {
    action: "delete_related",
    session_token: token,
    caller_login_id: user?.login_id || null,
    unit_id: unitId,
  });
  return res?.data || res;
}

export async function deleteSubmissionsByUnit(unitId) {
  return deleteProgressByUnit(unitId);
}

// ─── Progress (Base44 StudentUnitProgress Entity) ──────────────
export async function loadAllProgress(studentId) {
  if (!studentId) return [];
  try {
    const items = await base44.entities.StudentUnitProgress.filter({ student_id: studentId });
    return items || [];
  } catch (err) {
    console.warn("[dataAccess] loadAllProgress 실패:", err?.message);
    return [];
  }
}

export async function loadProgress(studentId, unitId) {
  if (!studentId || !unitId) return null;
  try {
    const items = await base44.entities.StudentUnitProgress.filter({ student_id: studentId, unit_id: unitId });
    return items?.[0] || null;
  } catch (err) {
    console.warn("[dataAccess] loadProgress 실패:", err?.message);
    return null;
  }
}

export async function saveProgress(studentId, unitId, data, context = {}) {
  if (!studentId || !unitId) return;
  const { studentName, unitTitle, unitType } = context;
  try {
    const existing = await loadProgress(studentId, unitId);
    const updateData = {
      ...data,
      student_name: studentName || existing?.student_name || "",
      unit_title: unitTitle || existing?.unit_title || "",
      last_studied_at: new Date().toISOString(),
    };
    if (existing) {
      return await base44.entities.StudentUnitProgress.update(existing.id, updateData);
    } else {
      return await base44.entities.StudentUnitProgress.create({
        student_id: studentId,
        unit_id: unitId,
        student_name: studentName || "",
        unit_title: unitTitle || "",
        ...data,
        last_studied_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("[dataAccess] saveProgress 실패:", {
      errorMessage: err?.message,
      studentId, unitId,
    });
    throw err;
  }
}

// ─── Submissions (Base44 StudentSubmission Entity) ───────────────
export async function loadSubmissions(studentId, unitId, itemType) {
  if (!studentId || !unitId) return [];
  try {
    let filter = { student_id: studentId, unit_id: unitId };
    const items = await base44.entities.StudentSubmission.filter(filter);
    let result = items || [];
    if (itemType) {
      result = result.filter((s) => s.item_type === itemType);
    }
    return result.sort((a, b) => (a.item_number || 0) - (b.item_number || 0));
  } catch (err) {
    console.warn("[dataAccess] loadSubmissions 실패:", err?.message);
    return [];
  }
}

export async function loadExamplePractices(studentId, unitId) {
  const rows = await loadSubmissions(studentId, unitId, "example");
  return rows.map((r) => ({
    id: r.id,
    example_index: r.item_number,
    filename: r.data?.filename || "",
    typed_code: r.data?.typed_code || "",
    stdin: r.data?.stdin || "",
    execution_result: r.data?.execution_result || "",
    expected_output: r.data?.expected_output || "",
    is_matched: r.is_correct || false,
    tried_at: r.submitted_at,
  }));
}

export async function loadQuestionResults(studentId, unitId) {
  const rows = await loadSubmissions(studentId, unitId, "question");
  return rows.map((r) => ({
    id: r.id,
    question_number: r.item_number,
    answer: r.data?.answer || "",
    is_correct: r.is_correct || false,
    question_type: r.data?.question_type || "",
    attempt_count: r.data?.attempt_count || 1,
    answered_at: r.submitted_at,
  }));
}

export async function loadMissionSubmissions(studentId, unitId) {
  const rows = await loadSubmissions(studentId, unitId, "mission");
  return rows.map((r) => ({
    id: r.id,
    mission_number: r.item_number,
    submitted_code: r.data?.submitted_code || "",
    submitted_stdin: r.data?.submitted_stdin || "",
    execution_result: r.data?.execution_result || "",
    expected_output: r.data?.expected_output || "",
    is_correct: r.is_correct || false,
    grading_mode: r.data?.grading_mode || "normalize",
    test_case_results: r.data?.test_case_results || [],
    submitted_at: r.submitted_at,
  }));
}

// ─── 제출 저장 헬퍼 (upsert: 동일 student+unit+item_type+item_number) ──
async function upsertSubmission(studentId, unitId, itemType, itemNumber, data, isCorrect, context = {}) {
  if (!studentId || !unitId) return;
  const { studentName, unitTitle, unitType } = context;
  try {
    const existing = await base44.entities.StudentSubmission.filter({
      student_id: studentId,
      unit_id: unitId,
      item_type: itemType,
      item_number: itemNumber,
    });
    const record = {
      student_id: studentId,
      student_name: studentName || existing?.[0]?.student_name || "",
      login_id: getSessionUser()?.login_id || "",
      unit_id: unitId,
      unit_title: unitTitle || existing?.[0]?.unit_title || "",
      unit_type: unitType || existing?.[0]?.unit_type || "",
      item_type: itemType,
      item_number: itemNumber,
      data,
      is_correct: isCorrect,
      submitted_at: new Date().toISOString(),
    };
    if (existing && existing.length > 0) {
      return await base44.entities.StudentSubmission.update(existing[0].id, record);
    } else {
      return await base44.entities.StudentSubmission.create(record);
    }
  } catch (err) {
    console.error(`[dataAccess] upsertSubmission(${itemType}) 실패:`, err?.message);
    throw err;
  }
}

export async function saveExamplePractice(
  studentId, unitId, exampleIndex, data, context = {}, progressUpdate = null
) {
  const result = await upsertSubmission(studentId, unitId, "example", exampleIndex, data, data.is_matched || false, context);
  if (progressUpdate) {
    try { await saveProgress(studentId, unitId, progressUpdate, context); } catch {}
  }
  return result;
}

export async function saveQuestionResult(
  studentId, unitId, questionNumber, data, context = {}, progressUpdate = null
) {
  const result = await upsertSubmission(studentId, unitId, "question", questionNumber, data, data.is_correct || false, context);
  if (progressUpdate) {
    try { await saveProgress(studentId, unitId, progressUpdate, context); } catch {}
  }
  return result;
}

export async function saveMissionSubmission(
  studentId, unitId, missionNumber, data, context = {}, progressUpdate = null
) {
  const result = await upsertSubmission(studentId, unitId, "mission", missionNumber, data, data.is_correct || false, context);
  if (progressUpdate) {
    try { await saveProgress(studentId, unitId, progressUpdate, context); } catch {}
  }
  return result;
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
  try {
    const data = await b44Action("list_students");
    return data.students || [];
  } catch (err) {
    console.warn("[dataAccess] loadAllStudents 실패:", err.message);
    return [];
  }
}

export async function createStudent(data) {
  return b44Action("create_student", data);
}

export async function updateStudent(id, data) {
  return b44Action("update_student", { id, ...data });
}

export async function deleteStudent(id) {
  return b44Action("delete_student", { student_id: id });
}

// ─── Subject ───────────────────────────────────────────────────────
export async function loadActiveSubjects() {
  try {
    const data = await b44Action("list_subjects");
    return (data.subjects || []).filter(s => s.is_active !== false && !s.is_deleted);
  } catch (err) {
    console.warn("[dataAccess] loadActiveSubjects 실패:", err.message);
    return [];
  }
}

export async function loadAllSubjects() {
  try {
    const data = await b44Action("list_subjects");
    return (data.subjects || []).filter(s => !s.is_deleted);
  } catch (err) {
    console.warn("[dataAccess] loadAllSubjects 실패:", err.message);
    return [];
  }
}

export async function loadAllSubjectsAdmin() {
  try {
    const data = await b44Action("list_subjects");
    return data.subjects || [];
  } catch (err) {
    console.warn("[dataAccess] loadAllSubjectsAdmin 실패:", err.message);
    return [];
  }
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
export async function adminCreateStudent(data) {
  const token = getSessionToken();
  if (!token) throw new Error("인증이 필요합니다.");
  const user = getSessionUser();
  try {
    const res = await base44.functions.invoke("adminCreateStudent", {
      session_token: token,
      caller_login_id: user?.login_id || null,
      ...data,
    });
    const result = res?.data || res;
    if (!result?.success) {
      throw new Error(result?.error || "학생 생성 실패");
    }
    return result;
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || "학생 생성 실패";
    throw new Error(msg);
  }
}