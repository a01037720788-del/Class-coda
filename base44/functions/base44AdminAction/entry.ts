// Base44 전용 관리자 CRUD 함수 (Supabase 의존성 제거)
//
// Student, Subject, Enrollment 엔티티의 CRUD를 asServiceRole로 처리.
// Supabase가 다운되어도 Base44 엔티티로 모든 관리자 기능이 작동.
//
// 사용: base44.functions.invoke("base44AdminAction", { action, caller_login_id, ...params })

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { hashPassword, hashPasswordLocal } from "../../shared/authUtils.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { session_token, caller_login_id, action, ...params } = body;

    // ── 호출자 인증 (Base44 AppUser) ──
    let caller: any = null;
    if (caller_login_id) {
      const callers = await base44.asServiceRole.entities.AppUser.filter({ login_id: caller_login_id });
      if (callers && callers.length > 0) caller = callers[0];
    }
    if (!caller) {
      return Response.json({ success: false, error: "세션 만료: 다시 로그인해 주세요." }, { status: 401 });
    }

    const isAdmin = ["admin", "super_admin", "teacher"].includes(caller.role);

    // ── Student actions ──
    if (action === "list_students") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const students = await base44.asServiceRole.entities.Student.list();
      return Response.json({ success: true, students, count: students.length });
    }

    if (action === "get_student") {
      const { student_id } = params;
      if (!student_id) return Response.json({ success: false, error: "student_id가 필요합니다." }, { status: 400 });
      try {
        const student = await base44.asServiceRole.entities.Student.get(student_id);
        return Response.json({ success: true, student });
      } catch {
        return Response.json({ success: true, student: null });
      }
    }

    if (action === "create_student") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { password, enrollments, ...studentData } = params;
      // Student 생성
      const student = await base44.asServiceRole.entities.Student.create({
        ...studentData,
        is_active: studentData.is_active !== false,
      });
      // AppUser 로그인 계정 생성
      if (params.login_id && password) {
        let hashedPw: string;
        try {
          hashedPw = await hashPassword(password);
        } catch {
          hashedPw = await hashPasswordLocal(password);
        }
        await base44.asServiceRole.entities.AppUser.create({
          name: studentData.name,
          login_id: params.login_id,
          password: hashedPw,
          role: "student",
          student_id: student.id,
          is_active: true,
        });
      }
      // 수강 정보 생성
      let enrollmentCount = 0;
      if (enrollments && Array.isArray(enrollments) && enrollments.length > 0) {
        for (const en of enrollments) {
          try {
            await base44.asServiceRole.entities.Enrollment.create({
              ...en,
              student_id: student.id,
              student_name: studentData.name,
            });
            enrollmentCount++;
          } catch {}
        }
      }
      return Response.json({ success: true, student_id: student.id, enrollment_count: enrollmentCount });
    }

    if (action === "update_student") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { id, ...data } = params;
      if (!id) return Response.json({ success: false, error: "id가 필요합니다." }, { status: 400 });
      await base44.asServiceRole.entities.Student.update(id, data);
      return Response.json({ success: true, student_id: id });
    }

    if (action === "delete_student") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { student_id } = params;
      if (!student_id) return Response.json({ success: false, error: "student_id가 필요합니다." }, { status: 400 });

      // 관련 데이터 삭제
      try {
        const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ student_id });
        for (const en of enrollments) {
          await base44.asServiceRole.entities.Enrollment.delete(en.id);
        }
      } catch {}
      try {
        const progress = await base44.asServiceRole.entities.StudentUnitProgress.filter({ student_id });
        for (const p of progress) {
          await base44.asServiceRole.entities.StudentUnitProgress.delete(p.id);
        }
      } catch {}
      try {
        const submissions = await base44.asServiceRole.entities.StudentSubmission.filter({ student_id });
        for (const s of submissions) {
          await base44.asServiceRole.entities.StudentSubmission.delete(s.id);
        }
      } catch {}
      try {
        const users = await base44.asServiceRole.entities.AppUser.filter({ student_id });
        for (const u of users) {
          await base44.asServiceRole.entities.AppUser.delete(u.id);
        }
      } catch {}
      // 학생 삭제
      await base44.asServiceRole.entities.Student.delete(student_id);
      return Response.json({ success: true, student_id });
    }

    if (action === "get_student_by_login_id") {
      const { login_id } = params;
      if (!login_id) return Response.json({ success: true, student: null });
      try {
        const students = await base44.asServiceRole.entities.Student.filter({ login_id });
        return Response.json({ success: true, student: students && students.length > 0 ? students[0] : null });
      } catch {
        return Response.json({ success: true, student: null });
      }
    }

    if (action === "verify_student") {
      const { student_id } = params;
      if (!student_id) return Response.json({ success: true, exists: false });
      try {
        const student = await base44.asServiceRole.entities.Student.get(student_id);
        return Response.json({ success: true, exists: !!student });
      } catch {
        return Response.json({ success: true, exists: false });
      }
    }

    if (action === "delete_progress_by_student") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { student_id } = params;
      try {
        const progress = await base44.asServiceRole.entities.StudentUnitProgress.filter({ student_id });
        for (const p of progress) {
          await base44.asServiceRole.entities.StudentUnitProgress.delete(p.id);
        }
      } catch {}
      return Response.json({ success: true });
    }

    if (action === "delete_submissions_by_student") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { student_id } = params;
      try {
        const submissions = await base44.asServiceRole.entities.StudentSubmission.filter({ student_id });
        for (const s of submissions) {
          await base44.asServiceRole.entities.StudentSubmission.delete(s.id);
        }
      } catch {}
      return Response.json({ success: true });
    }

    // ── Subject actions ──
    if (action === "list_subjects") {
      const subjects = await base44.asServiceRole.entities.Subject.list();
      return Response.json({ success: true, subjects });
    }

    if (action === "create_subject") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const subject = await base44.asServiceRole.entities.Subject.create({
        ...params,
        is_active: params.is_active !== false,
        is_deleted: false,
      });
      return Response.json({ success: true, subject_id: subject.id });
    }

    if (action === "update_subject") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { id, ...data } = params;
      if (!id) return Response.json({ success: false, error: "id가 필요합니다." }, { status: 400 });
      await base44.asServiceRole.entities.Subject.update(id, data);
      return Response.json({ success: true, subject_id: id });
    }

    if (action === "delete_subject") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { id } = params;
      if (!id) return Response.json({ success: false, error: "id가 필요합니다." }, { status: 400 });
      await base44.asServiceRole.entities.Subject.update(id, { is_deleted: true });
      return Response.json({ success: true, subject_id: id });
    }

    if (action === "hard_delete_subject") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { id } = params;
      if (!id) return Response.json({ success: false, error: "id가 필요합니다." }, { status: 400 });
      await base44.asServiceRole.entities.Subject.delete(id);
      return Response.json({ success: true, subject_id: id });
    }

    // ── Enrollment actions ──
    if (action === "list_enrollments") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const enrollments = await base44.asServiceRole.entities.Enrollment.list();
      return Response.json({ success: true, enrollments });
    }

    if (action === "list_enrollments_by_student") {
      const { student_id } = params;
      if (!student_id) return Response.json({ success: true, enrollments: [] });
      const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ student_id });
      return Response.json({ success: true, enrollments });
    }

    if (action === "list_enrollments_by_subject") {
      const { subject_id } = params;
      if (!subject_id) return Response.json({ success: true, enrollments: [] });
      const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ subject_id });
      return Response.json({ success: true, enrollments });
    }

    if (action === "create_enrollment") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const enrollment = await base44.asServiceRole.entities.Enrollment.create(params);
      return Response.json({ success: true, enrollment_id: enrollment.id });
    }

    if (action === "update_enrollment") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { id, ...data } = params;
      if (!id) return Response.json({ success: false, error: "id가 필요합니다." }, { status: 400 });
      await base44.asServiceRole.entities.Enrollment.update(id, data);
      return Response.json({ success: true, enrollment_id: id });
    }

    if (action === "delete_enrollment") {
      if (!isAdmin) {
        return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
      }
      const { id } = params;
      if (!id) return Response.json({ success: false, error: "id가 필요합니다." }, { status: 400 });
      await base44.asServiceRole.entities.Enrollment.delete(id);
      return Response.json({ success: true, enrollment_id: id });
    }

    return Response.json({ success: false, error: `알 수 없는 action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("[base44AdminAction] 예외:", error.message || error);
    return Response.json({ success: false, error: error.message || "서버 오류" }, { status: 500 });
  }
});