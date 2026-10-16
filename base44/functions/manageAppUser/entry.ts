import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { hashPassword } from "../../shared/authUtils.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, caller_login_id } = body;

    // ── 호출자 인증 (Base44 AppUser) ──
    let caller = null;
    if (caller_login_id) {
      const callers = await base44.asServiceRole.entities.AppUser.filter({ login_id: caller_login_id });
      if (callers && callers.length > 0) {
        caller = callers[0];
      }
    }
    if (!caller) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    if (!['admin', 'super_admin', 'teacher'].includes(caller.role)) {
      return Response.json({ error: '권한이 없습니다.' }, { status: 403 });
    }
    if (caller.is_active === false) {
      return Response.json({ error: '비활성화된 계정입니다.' }, { status: 403 });
    }

    const isSuperAdmin = caller.role === 'super_admin';

    // ── LIST ──
    if (action === "list") {
      const users = await base44.asServiceRole.entities.AppUser.list();
      // password 필드 제거
      const safeUsers = (users || []).map(({ password, ...rest }) => rest);
      return Response.json({ users: safeUsers });
    }

    // ── CREATE ──
    if (action === "create") {
      const { name, login_id, password, role, phone, student_id, linked_student_ids, is_active, must_change_password } = body;
      if (!name || !login_id || !password || !role) {
        return Response.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
      }
      // super_admin 계정은 super_admin만 생성 가능
      if (role === 'super_admin' && !isSuperAdmin) {
        return Response.json({ error: 'super_admin 계정은 총 관리자만 생성할 수 있습니다.' }, { status: 403 });
      }
      // 중복 검사
      const existing = await base44.asServiceRole.entities.AppUser.filter({ login_id });
      if (existing && existing.length > 0) {
        return Response.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
      }
      const passwordHash = await hashPassword(password);
      const data: any = { name, login_id, password: passwordHash, role, is_active: is_active !== false };
      if (phone !== undefined) data.phone = phone;
      if (student_id !== undefined) data.student_id = student_id;
      if (linked_student_ids !== undefined) data.linked_student_ids = linked_student_ids;
      if (must_change_password !== undefined) data.must_change_password = must_change_password;
      const created = await base44.asServiceRole.entities.AppUser.create(data);
      const { password: _pw, ...safe } = created;
      return Response.json({ user: safe });
    }

    // ── UPDATE ──
    if (action === "update") {
      const { id, data } = body;
      if (!id) return Response.json({ error: 'id가 필요합니다.' }, { status: 400 });

      // 대상 사용자 조회
      const targetUser = await base44.asServiceRole.entities.AppUser.get(id);
      if (!targetUser) {
        return Response.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      // super_admin 계정은 super_admin만 수정 가능
      if (targetUser.role === 'super_admin' && !isSuperAdmin) {
        return Response.json({ error: 'super_admin 계정은 총 관리자만 수정할 수 있습니다.' }, { status: 403 });
      }
      // super_admin 권한 부여는 super_admin만 가능
      if (data.role === 'super_admin' && !isSuperAdmin) {
        return Response.json({ error: 'super_admin 권한은 총 관리자만 부여할 수 있습니다.' }, { status: 403 });
      }

      const updateData = { ...data };
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      if (updateData.login_id) {
        const existing = await base44.asServiceRole.entities.AppUser.filter({ login_id: updateData.login_id });
        if (existing && existing.length > 0 && existing[0].id !== id) {
          return Response.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
        }
      }
      await base44.asServiceRole.entities.AppUser.update(id, updateData);
      return Response.json({ success: true });
    }

    // ── RESET PASSWORD ──
    if (action === "resetPassword") {
      const { id, newPassword } = body;
      if (!id || !newPassword) return Response.json({ error: 'id와 newPassword가 필요합니다.' }, { status: 400 });

      const targetUser = await base44.asServiceRole.entities.AppUser.get(id);
      if (!targetUser) {
        return Response.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      // super_admin 계정의 비밀번호는 super_admin만 초기화 가능
      if (targetUser.role === 'super_admin' && !isSuperAdmin) {
        return Response.json({ error: 'super_admin 계정의 비밀번호는 총 관리자만 초기화할 수 있습니다.' }, { status: 403 });
      }

      const passwordHash = await hashPassword(newPassword);
      await base44.asServiceRole.entities.AppUser.update(id, {
        password: passwordHash,
        must_change_password: true
      });
      return Response.json({ success: true });
    }

    // ── DELETE ──
    if (action === "delete") {
      const { id } = body;
      if (!id) return Response.json({ error: 'id가 필요합니다.' }, { status: 400 });

      const targetUser = await base44.asServiceRole.entities.AppUser.get(id);
      if (!targetUser) {
        return Response.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      // super_admin 계정은 super_admin만 삭제 가능
      if (targetUser.role === 'super_admin' && !isSuperAdmin) {
        return Response.json({ error: 'super_admin 계정은 총 관리자만 삭제할 수 있습니다.' }, { status: 403 });
      }

      await base44.asServiceRole.entities.AppUser.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: '알 수 없는 action입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
});