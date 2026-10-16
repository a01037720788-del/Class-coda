// 선생님 통계 페이지용 데이터 조회 (asServiceRole — RLS 우회)
// AppUser, ClassSchedule, Enrollment, ClassScheduleStudent을 한 번에 반환.
// 프론트엔드에서 base44.entities를 직접 호출하면 Supabase 인증 사용자에게 작동하지 않으므로
// 백엔드에서 asServiceRole로 조회하여 전달합니다.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

export default async function (req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const admin = client.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { caller_login_id } = body;

    // 권한 검증 — 선생님 통계는 super_admin만 접근 가능
    let caller: any = null;
    if (caller_login_id) {
      const callers = await admin.entities.AppUser.filter({ login_id: caller_login_id });
      if (callers && callers.length > 0) caller = callers[0];
    }
    if (!caller) {
      return Response.json({ error: "세션 만료: 다시 로그인해 주세요." }, { status: 401 });
    }
    if (caller.role !== "super_admin") {
      return Response.json({ error: "선생님 통계는 총 관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const [admins, scheds, enrs, cssAll] = await Promise.all([
      admin.entities.AppUser.filter({ role: "admin" }),
      admin.entities.ClassSchedule.list("-class_date", 2000),
      admin.entities.Enrollment.list(),
      admin.entities.ClassScheduleStudent.list("-created_date", 5000),
    ]);

    return Response.json({
      teachers: admins,
      schedules: scheds.filter((s: any) => s.is_deleted !== true),
      enrollments: enrs,
      cssRecords: cssAll.filter((c: any) => !c.is_deleted),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "데이터 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}