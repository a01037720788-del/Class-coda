// 관리자용 Unit 조회 함수 (asServiceRole — Base44 Entity 전용)
// Supabase 의존성 완전 제거 — Base44 Entity에서만 조회.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// subjectType → Base44 Entity 이름 매핑
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

function mapBase44Unit(row: any, subjectType: string, { full = false }: { full?: boolean } = {}) {
  const { id, created_date, updated_date, created_by_id, ...content } = row;
  if (full) {
    return {
      ...content,
      id: row.id,
      subject_type: subjectType,
      unit_number: row.unit_number,
      title: row.title,
      subtitle: row.subtitle || "",
      is_active: row.is_active !== false,
      _source: "base44",
    };
  }
  return {
    id: row.id,
    subject_type: subjectType,
    unit_number: row.unit_number,
    title: row.title,
    subtitle: row.subtitle || "",
    is_active: row.is_active !== false,
    _source: "base44",
    learning_objectives: content.learning_objectives || [],
    concept_sections_count: content.concept_sections?.length || 0,
    tables_count: content.tables?.length || 0,
    example_codes_count: content.example_codes?.length || 0,
    questions_count: content.questions?.length || 0,
    missions_count: content.missions?.length || 0,
    summary_count: content.summary?.length || 0,
  };
}

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const subjectType = body.subjectType;
    const unitId = body.unitId;

    const client = createClientFromRequest(req);
    const admin = client.asServiceRole;

    // ─── 단일 Unit 전체 콘텐츠 조회 (수정 화면용) ──────────────
    if (unitId) {
      for (const [st, entityName] of Object.entries(ENTITY_MAP)) {
        try {
          const item = await (admin.entities as any)[entityName].get(unitId);
          if (item) {
            return Response.json({
              source: "base44",
              unit: mapBase44Unit(item, st, { full: true }),
            });
          }
        } catch {}
      }
      return Response.json({ source: "error", unit: null, error: "Unit을 찾을 수 없습니다." });
    }

    // ─── 목록 조회 ─────────────────────────────────────────────
    // subjectType이 지정된 경우 해당 Entity만 조회
    if (subjectType && ENTITY_MAP[subjectType]) {
      const entityName = ENTITY_MAP[subjectType];
      try {
        const items = await (admin.entities as any)[entityName].list("unit_number", 5000);
        return Response.json({
          source: "base44",
          units: items.map((u: any) => mapBase44Unit(u, subjectType)),
          count: items.length,
          entityName,
        });
      } catch (err) {
        return Response.json({
          source: "error",
          units: [],
          count: 0,
          error: `${entityName} 조회 실패: ${err.message}`,
        });
      }
    }

    // subjectType이 없는 경우 모든 Unit Entity 조회
    const allUnits: any[] = [];
    const entityCounts: Record<string, number> = {};
    for (const [st, entityName] of Object.entries(ENTITY_MAP)) {
      try {
        const items = await (admin.entities as any)[entityName].list("unit_number", 5000);
        entityCounts[entityName] = items.length;
        for (const u of items) {
          allUnits.push(mapBase44Unit(u, st));
        }
      } catch {
        entityCounts[entityName] = -1;
      }
    }

    return Response.json({
      source: "base44",
      units: allUnits,
      count: allUnits.length,
      entityCounts,
    });
  } catch (error) {
    return Response.json(
      { source: "error", units: [], count: 0, error: error.message },
      { status: 500 }
    );
  }
}