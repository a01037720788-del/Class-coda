// 학생 생성 백엔드 함수 (Base44 전용 — Supabase 의존성 제거)
//
// 학생 + 로그인 계정(AppUser) + 수강 정보(Enrollment)를 Base44 엔티티에 생성.
// Supabase가 다운되어도 작동.
//
// 사용: base44.functions.invoke("adminCreateStudent", { caller_login_id, ... })

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { hashPassword, hashPasswordLocal } from "../../shared/authUtils.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      session_token, caller_login_id,
      student_id,
      name, login_id, password,
      grade, school_name, school_type,
      teacher_ids, teacher_names,
      subjects, subject_permissions,
      student_phone, parent_phone, email, notes,
      enrollments,
    } = body;

    // ── 1. 관리자 인증 (Base44 AppUser) ──
    let caller: any = null;
    if (caller_login_id) {
      const callers = await base44.asServiceRole.entities.AppUser.filter({ login_id: caller_login_id });
      if (callers && callers.length > 0) caller = callers[0];
    }
    if (!caller) {
      return Response.json({ success: false, error: "세션 만료: 다시 로그인해 주세요." }, { status: 401 });
    }
    if (!["admin", "super_admin", "teacher"].includes(caller.role)) {
      return Response.json({ success: false, error: "관리자 권한이 없습니다." }, { status: 403 });
    }

    // ── 2. 필수값 검증 ──
    if (!name?.trim()) {
      return Response.json({ success: false, error: "이름은 필수입니다." }, { status: 200 });
    }
    if (!student_id) {
      return Response.json({ success: false, error: "학생 ID가 필요합니다." }, { status: 200 });
    }

    // ── 3. Student 엔티티 생성 ──
    const studentData: Record<string, any> = {
      id: student_id,
      name,
      login_id: login_id || null,
      password: password || null,
      grade: grade || null,
      school_name: school_name || null,
      school_type: school_type || "preset",
      teacher_ids: teacher_ids || [],
      teacher_names: teacher_names || [],
      subjects: subjects || [],
      subject_permissions: subject_permissions || {},
      student_phone: student_phone || null,
      parent_phone: parent_phone || null,
      email: email || null,
      notes: notes || null,
      is_active: true,
    };

    let student;
    try {
      student = await base44.asServiceRole.entities.Student.create(studentData);
    } catch (err: any) {
      return Response.json({
        success: false,
        error: "학생 생성 실패: " + (err.message || err),
      }, { status: 200 });
    }

    // ── 4. AppUser 로그인 계정 생성 ──
    if (login_id && password) {
      let hashedPw: string;
      try {
        hashedPw = await hashPassword(password);
      } catch {
        // Supabase 다운 시 로컬 PBKDF2 해시 사용
        hashedPw = await hashPasswordLocal(password);
      }
      try {
        await base44.asServiceRole.entities.AppUser.create({
          name,
          login_id,
          password: hashedPw,
          role: "student",
          student_id: student.id,
          is_active: true,
        });
      } catch (err: any) {
        console.error("[adminCreateStudent] AppUser 생성 실패:", err.message);
        // AppUser 생성 실패는 학생 생성 성공에 영향 주지 않음
      }
    }

    // ── 5. 수강 정보 생성 ──
    let enrollmentCount = 0;
    if (enrollments && Array.isArray(enrollments) && enrollments.length > 0) {
      for (const en of enrollments) {
        try {
          await base44.asServiceRole.entities.Enrollment.create({
            ...en,
            student_id: student.id,
            student_name: name,
          });
          enrollmentCount++;
        } catch (err: any) {
          console.error("[adminCreateStudent] 수강 생성 실패:", err.message);
        }
      }
    }

    return Response.json({
      success: true,
      student_id: student.id,
      login_id: login_id || null,
      enrollment_count: enrollmentCount,
    });

  } catch (error) {
    console.error("[adminCreateStudent] 예외:", error.message || error);
    return Response.json({
      success: false,
      error: error.message || "서버 오류",
    }, { status: 500 });
  }
});