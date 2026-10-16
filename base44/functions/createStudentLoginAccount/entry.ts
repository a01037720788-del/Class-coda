// 기존 학생 로그인 계정 생성 (Base44 전용)
//
// Student는 이미 존재하지만 AppUser가 없는 학생을 위해
// AppUser 로그인 계정을 생성/연결.
//
// 사용: base44.functions.invoke("createStudentLoginAccount", { caller_login_id, student_id, login_id, password })

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { hashPassword } from "../../shared/authUtils.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { caller_login_id, student_id, login_id, password } = body;

    // ── 1. 관리자 인증 (Base44 AppUser) ──
    let caller = null;
    if (caller_login_id) {
      const callers = await base44.asServiceRole.entities.AppUser.filter({ login_id: caller_login_id });
      if (callers && callers.length > 0) caller = callers[0];
    }
    if (!caller) {
      return Response.json({ success: false, error: "세션 만료: 다시 로그인해 주세요." }, { status: 401 });
    }
    if (!["admin", "super_admin", "teacher"].includes(caller.role)) {
      return Response.json({ success: false, error: "로그인 계정을 생성할 권한이 없습니다." }, { status: 403 });
    }

    // ── 2. 필수값 검증 ──
    if (!student_id) {
      return Response.json({ success: false, error: "학생 ID가 필요합니다." }, { status: 200 });
    }
    if (!login_id?.trim()) {
      return Response.json({ success: false, error: "로그인 아이디는 필수입니다." }, { status: 200 });
    }
    if (!password) {
      return Response.json({ success: false, error: "비밀번호는 필수입니다." }, { status: 200 });
    }

    // ── 3. Student 존재 확인 ──
    let student = null;
    try {
      student = await base44.asServiceRole.entities.Student.get(student_id);
    } catch {}
    if (!student) {
      return Response.json({ success: false, error: "학생 정보를 찾을 수 없습니다." }, { status: 200 });
    }

    // ── 4. login_id 중복 확인 ──
    const existing = await base44.asServiceRole.entities.AppUser.filter({ login_id: login_id.trim() });
    if (existing && existing.length > 0) {
      const ex = existing[0];
      if (ex.student_id && ex.student_id !== student_id) {
        return Response.json({ success: false, error: "이미 다른 학생에게 사용 중인 아이디입니다." }, { status: 200 });
      }
      // 기존 계정에 student_id 연결 + 비밀번호 갱신
      const hashedPw = await hashPassword(password);
      await base44.asServiceRole.entities.AppUser.update(ex.id, {
        password: hashedPw,
        role: "student",
        student_id: student_id,
        is_active: true,
      });
      // Student 엔티티에도 login_id 반영
      await base44.asServiceRole.entities.Student.update(student_id, { login_id: login_id.trim() });
      return Response.json({ success: true, student_id, login_id: login_id.trim(), student_name: student.name });
    }

    // ── 5. 새 AppUser 생성 ──
    const hashedPw = await hashPassword(password);
    await base44.asServiceRole.entities.AppUser.create({
      name: student.name || "",
      login_id: login_id.trim(),
      password: hashedPw,
      role: "student",
      student_id: student_id,
      is_active: true,
      must_change_password: false,
    });

    // Student 엔티티에도 login_id 반영
    await base44.asServiceRole.entities.Student.update(student_id, { login_id: login_id.trim() });

    return Response.json({
      success: true,
      student_id,
      login_id: login_id.trim(),
      student_name: student.name,
    });
  } catch (error) {
    console.error("[createStudentLoginAccount] 예외:", error.message || error);
    return Response.json({ success: false, error: error.message || "서버 오류" }, { status: 500 });
  }
});