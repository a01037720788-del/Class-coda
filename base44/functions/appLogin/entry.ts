import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { verifyPassword, hashPassword } from "../../shared/authUtils.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { login_id, password } = await req.json();

    if (!login_id || !password) {
      return Response.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const digitsOnly = login_id.replace(/[^0-9]/g, '');

    // ── 사용자 검증 헬퍼 ──
    async function verifyUser(user: any): Promise<Response | null> {
      if (user.is_active === false) {
        return Response.json({ error: 'ACCOUNT_DEACTIVATED' }, { status: 403 });
      }
      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return Response.json({ error: 'WRONG_PASSWORD' }, { status: 401 });
      }
      // 비밀번호가 bcrypt 해시가 아니면 마이그레이션 (평문, pbkdf2 등)
      if (!user.password?.startsWith('$2')) {
        try {
          const hashedPw = await hashPassword(password);
          await base44.asServiceRole.entities.AppUser.update(user.id, { password: hashedPw });
        } catch { /* non-critical */ }
      }
      const { password: _pw, ...safeUser } = user;
      return Response.json({
        user: {
          ...safeUser,
          must_change_password: user.must_change_password || false,
        },
      });
    }

    // 1. AppUser 테이블에서 정확한 login_id로 검색
    const users = await base44.asServiceRole.entities.AppUser.filter({ login_id });
    if (users && users.length > 0) {
      const result = await verifyUser(users[0]);
      if (result) return result;
    }

    // 2. 전화번호(숫자만)로 parent 계정 검색
    if (digitsOnly.length >= 10) {
      const allParents = await base44.asServiceRole.entities.AppUser.filter({ role: 'parent' });
      const matchedParent = allParents.find(u => {
        const uDigits = (u.login_id || '').replace(/[^0-9]/g, '');
        return uDigits === digitsOnly;
      });
      if (matchedParent) {
        const result = await verifyUser(matchedParent);
        if (result) return result;
      }
    }

    // 3. AppUser에 없으면 Student 엔티티에서 직접 검색 (하위 호환)
    const students = await base44.asServiceRole.entities.Student.filter({ login_id });
    if (students && students.length > 0) {
      const student = students[0];
      if (student.is_active === false) {
        return Response.json({ error: 'ACCOUNT_DEACTIVATED' }, { status: 403 });
      }
      const valid = await verifyPassword(password, student.password);
      if (!valid) {
        return Response.json({ error: 'WRONG_PASSWORD' }, { status: 401 });
      }
      if (!student.password?.startsWith('$2')) {
        try {
          const hashedPw = await hashPassword(password);
          await base44.asServiceRole.entities.Student.update(student.id, { password: hashedPw });
        } catch { /* non-critical */ }
      }
      const { password: _pw, ...safeStudent } = student;
      return Response.json({
        user: { ...safeStudent, role: 'student', student_id: student.id, id: student.id, must_change_password: false, student_info: safeStudent },
      });
    }

    // 사용자를 찾을 수 없음
    return Response.json({ error: 'USER_NOT_FOUND' }, { status: 401 });
  } catch (error) {
    return Response.json({ error: error.message || '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
});