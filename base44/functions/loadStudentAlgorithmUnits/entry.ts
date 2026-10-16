import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// 학생용 AlgorithmUnit 로더 — answer_code와 hidden 테스트케이스 데이터를 제거하여 반환
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}

    const units = await base44.asServiceRole.entities.AlgorithmUnit.list();

    const sanitized = (units || [])
      .filter(u => u.is_active !== false)
      .map(u => {
        const unit = { ...u };

        // implementations에서 answer_code 제거
        if (unit.implementations) {
          unit.implementations = unit.implementations.map(impl => {
            const { answer_code, ...rest } = impl;
            // test_cases에서 hidden 제거
            if (rest.test_cases) {
              rest.test_cases = rest.test_cases.map(tc => {
                if (tc.hidden) {
                  return { hidden: true };
                }
                return tc;
              });
            }
            return rest;
          });
        }

        // missions에서 answer_code 제거
        if (unit.missions) {
          unit.missions = unit.missions.map(m => {
            const { answer_code, ...rest } = m;
            if (rest.test_cases) {
              rest.test_cases = rest.test_cases.map(tc => {
                if (tc.hidden) {
                  return { hidden: true };
                }
                return tc;
              });
            }
            return rest;
          });
        }

        // judge_problems에서 answer_code 제거 + hidden 테스트케이스 데이터 제거
        if (unit.judge_problems) {
          unit.judge_problems = unit.judge_problems
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

        return unit;
      })
      .sort((a, b) => (a.unit_number || 0) - (b.unit_number || 0));

    return Response.json({ units: sanitized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}