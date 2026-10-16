import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { verifyPassword, hashPassword } from "../../shared/authUtils.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { session_token, login_id, old_password, new_password } = body;

    if (!new_password) {
      return Response.json({ error: '새 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    let userId: string | null = null;

    // login_id + old_password로 인증
    if (login_id && old_password) {
      const users = await base44.asServiceRole.entities.AppUser.filter({ login_id });
      if (users && users.length > 0) {
        const user = users[0];
        const valid = await verifyPassword(old_password, user.password);
        if (valid) {
          userId = user.id;
        }
      }
    }

    // session_token으로 인증 (b44_ 토큰 — localStorage 사용자에서 login_id 추출)
    if (!userId && session_token) {
      // b44_ 토큰은 클라이언트에서 사용자 정보를 가져오므로 login_id 필요
      // login_id가 없으면 session_token만으로는 인증 불가
    }

    if (!userId) {
      return Response.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
    }

    // 비밀번호 변경 + must_change_password 해제
    const passwordHash = await hashPassword(new_password);
    await base44.asServiceRole.entities.AppUser.update(userId, {
      password: passwordHash,
      must_change_password: false
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message || '비밀번호 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
});