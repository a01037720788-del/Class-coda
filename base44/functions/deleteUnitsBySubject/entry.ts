// 관리자용 특정 과목 Unit 전체 삭제 함수 (asServiceRole — Base44 Entity 전용)
// Supabase 의존성 완전 제거.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

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

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const subjectType = body.subjectType;

    if (!subjectType) {
      return Response.json({ success: false, error: "subjectType이 필요합니다." }, { status: 400 });
    }

    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user) {
      return Response.json({ success: false, error: "인증이 필요합니다." }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "super_admin") {
      return Response.json({ success: false, error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const entityName = ENTITY_MAP[subjectType];
    if (!entityName) {
      return Response.json({ success: false, error: `지원하지 않는 과목: ${subjectType}` }, { status: 400 });
    }

    const admin = client.asServiceRole;
    const result = {
      success: true,
      subjectType,
      base44UnitsDeleted: 0,
      progressDeleted: 0,
      submissionsDeleted: 0,
      errors: [] as string[],
    };

    // ─── 1. Base44 Entity에서 전체 Unit 조회 및 삭제 ──
    let unitIds: string[] = [];
    try {
      const items = await (admin.entities as any)[entityName].list("unit_number", 5000);
      unitIds = items.map((u: any) => u.id);
      let b44Deleted = 0;
      for (const id of unitIds) {
        try {
          await (admin.entities as any)[entityName].delete(id);
          b44Deleted++;
        } catch (err: any) {
          result.errors.push(`Base44 ${entityName} ${id}: ${err.message}`);
        }
      }
      result.base44UnitsDeleted = b44Deleted;
    } catch (err: any) {
      result.errors.push(`Base44 ${entityName} 조회/삭제: ${err.message}`);
    }

    // ─── 2. 관련 StudentUnitProgress 삭제 ──
    if (unitIds.length > 0) {
      for (const uid of unitIds) {
        try {
          await admin.entities.StudentUnitProgress.deleteMany({ unit_id: uid });
        } catch (err: any) {
          result.errors.push(`progress ${uid}: ${err.message}`);
        }
      }
      result.progressDeleted = unitIds.length;
    }

    // ─── 3. 관련 StudentSubmission 삭제 ──
    if (unitIds.length > 0) {
      for (const uid of unitIds) {
        try {
          await admin.entities.StudentSubmission.deleteMany({ unit_id: uid });
        } catch (err: any) {
          result.errors.push(`submissions ${uid}: ${err.message}`);
        }
      }
      result.submissionsDeleted = unitIds.length;
    }

    return Response.json(result);
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}