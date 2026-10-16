// 관리자용 Unit CRUD 함수 (asServiceRole — Base44 Entity 전용)
//
// Supabase 의존성 완전 제거 — Base44 Entity에서만 CRUD 수행.
//
// 사용: base44.functions.invoke("unitAdminAction", { action, session_token, caller_login_id, ... })
// action: "save" | "toggle" | "delete" | "delete_related"

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ENTITY_MAP: Record<string, string> = {
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

function isJsonSerializable(obj: any): boolean {
  try {
    JSON.stringify(obj);
    return true;
  } catch {
    return false;
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, caller_login_id } = body;

    // ── 관리자 권한 검증 (Base44 AppUser) ──
    let caller: any = null;

    if (caller_login_id) {
      try {
        const callers = await base44.asServiceRole.entities.AppUser.filter({ login_id: caller_login_id });
        if (callers && callers.length > 0) {
          caller = callers[0];
        }
      } catch {}
    }

    if (!caller) {
      return Response.json({ success: false, error: "세션 만료: 다시 로그인해 주세요." }, { status: 401 });
    }
    if (!["admin", "super_admin", "teacher"].includes(caller.role)) {
      return Response.json({ success: false, error: "관리자 권한이 없습니다.", role: caller.role }, { status: 403 });
    }

    // ── 액션 처리 ──
    switch (action) {
      case "save":
        return await handleSave(base44, body);
      case "toggle":
        return await handleToggle(base44, body);
      case "delete":
        return await handleDelete(base44, body);
      case "delete_related":
        return await handleDeleteRelated(base44, body);
      default:
        return Response.json({ success: false, error: `지원하지 않는 action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[unitAdminAction] 예외:", error.message || error);
    return Response.json({ success: false, error: error.message || "서버 오류" }, { status: 500 });
  }
}

// ── save: Unit upsert (신규 생성 또는 기존 수정) ──
async function handleSave(base44: any, body: any): Promise<Response> {
  const { unit_data } = body;
  if (!unit_data) {
    return Response.json({ success: false, error: "unit_data가 필요합니다." }, { status: 400 });
  }

  const { id, subject_type, subject_id, unit_number, title, subtitle, is_active, ...content } = unit_data;

  if (!subject_type) {
    return Response.json({ success: false, error: "subject_type이 필요합니다." }, { status: 400 });
  }
  if (!title || !String(title).trim()) {
    return Response.json({ success: false, error: "title이 필요합니다." }, { status: 400 });
  }

  if (!isJsonSerializable(content)) {
    return Response.json({
      success: false,
      error: "Unit 내용에 JSON으로 변환할 수 없는 데이터가 포함되어 있습니다.",
      error_code: "JSON_SERIALIZABLE",
    }, { status: 422 });
  }

  const entityName = ENTITY_MAP[subject_type];
  if (!entityName) {
    return Response.json({ success: false, error: `지원하지 않는 subject_type: ${subject_type}` }, { status: 400 });
  }

  const isNew = !id;
  const unitId = id;

  const entityData: any = {
    unit_number: unit_number ?? null,
    title: String(title).trim(),
    subtitle: subtitle ?? "",
    is_active: is_active !== false,
    ...content,
  };
  if (subject_id) entityData.subject_id = subject_id;

  if (!isJsonSerializable(entityData)) {
    return Response.json({
      success: false,
      error: "저장 데이터를 JSON으로 변환할 수 없습니다.",
      error_code: "PAYLOAD_NOT_SERIALIZABLE",
    }, { status: 422 });
  }

  try {
    if (isNew) {
      await base44.asServiceRole.entities[entityName].create(entityData);
    } else {
      try {
        const existing = await base44.asServiceRole.entities[entityName].get(unitId);
        if (existing) {
          await base44.asServiceRole.entities[entityName].update(unitId, entityData);
        } else {
          await base44.asServiceRole.entities[entityName].create({ id: unitId, ...entityData });
        }
      } catch {
        await base44.asServiceRole.entities[entityName].create({ id: unitId, ...entityData });
      }
    }
  } catch (err: any) {
    console.error("[unitAdminAction.save] Base44 저장 실패", {
      subject_type, entityName, error_message: err.message,
    });
    return Response.json({ success: false, error: `저장 실패: ${err.message}`, error_code: "DB_ERROR" }, { status: 500 });
  }

  return Response.json({
    success: true,
    id: unitId,
    source: "base44",
    action: isNew ? "created" : "updated",
  });
}

// ── toggle: is_active만 업데이트 ──
async function handleToggle(base44: any, body: any): Promise<Response> {
  const { unit_id, is_active, subject_type } = body;
  if (!unit_id) {
    return Response.json({ success: false, error: "unit_id가 필요합니다." }, { status: 400 });
  }

  const entityName = subject_type ? ENTITY_MAP[subject_type] : null;
  if (entityName) {
    try {
      await base44.asServiceRole.entities[entityName].update(unit_id, { is_active });
    } catch (err: any) {
      return Response.json({ success: false, error: `활성화 토글 실패: ${err.message}` }, { status: 500 });
    }
  } else {
    // subject_type을 모르면 모든 Entity에서 찾기
    for (const [st, en] of Object.entries(ENTITY_MAP)) {
      try {
        const item = await base44.asServiceRole.entities[en].get(unit_id);
        if (item) {
          await base44.asServiceRole.entities[en].update(unit_id, { is_active });
          break;
        }
      } catch {}
    }
  }

  return Response.json({ success: true, id: unit_id, is_active });
}

// ── delete: Unit 삭제 ──
async function handleDelete(base44: any, body: any): Promise<Response> {
  const { unit_id, subject_type } = body;
  if (!unit_id) {
    return Response.json({ success: false, error: "unit_id가 필요합니다." }, { status: 400 });
  }

  const entityName = subject_type ? ENTITY_MAP[subject_type] : null;
  if (entityName) {
    try {
      await base44.asServiceRole.entities[entityName].delete(unit_id);
    } catch {}
  } else {
    for (const [st, en] of Object.entries(ENTITY_MAP)) {
      try {
        await base44.asServiceRole.entities[en].delete(unit_id);
      } catch {}
    }
  }

  return Response.json({ success: true, id: unit_id });
}

// ── delete_related: Unit 관련 progress + submissions 삭제 ──
async function handleDeleteRelated(base44: any, body: any): Promise<Response> {
  const { unit_id } = body;
  if (!unit_id) {
    return Response.json({ success: false, error: "unit_id가 필요합니다." }, { status: 400 });
  }

  let progressDeleted = 0;
  let submissionsDeleted = 0;

  try {
    const progressItems = await base44.asServiceRole.entities.StudentUnitProgress.filter({ unit_id });
    if (progressItems && progressItems.length > 0) {
      await base44.asServiceRole.entities.StudentUnitProgress.deleteMany({ unit_id });
      progressDeleted = progressItems.length;
    }
  } catch (err: any) {
    console.warn("[unitAdminAction.delete_related] progress 삭제 실패:", err.message);
  }

  try {
    const submissionItems = await base44.asServiceRole.entities.StudentSubmission.filter({ unit_id });
    if (submissionItems && submissionItems.length > 0) {
      await base44.asServiceRole.entities.StudentSubmission.deleteMany({ unit_id });
      submissionsDeleted = submissionItems.length;
    }
  } catch (err: any) {
    console.warn("[unitAdminAction.delete_related] submissions 삭제 실패:", err.message);
  }

  return Response.json({ success: true, id: unit_id, progress_deleted: progressDeleted, submissions_deleted: submissionsDeleted });
}