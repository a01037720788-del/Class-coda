import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: '인증되지 않은 사용자입니다.', code: 'AUTH_FAILED' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: '관리자 권한이 필요합니다.', code: 'FORBIDDEN' }, { status: 403 });
    }

    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({
        connected: false,
        error: 'Google Calendar 연결이 없습니다. 학원 관리자가 연결해야 합니다.',
        code: 'NO_CONNECTION'
      });
    }
    if (!accessToken) {
      return Response.json({
        connected: false,
        error: 'Google 인증 토큰이 없습니다. 연결이 만료되었을 수 있습니다.',
        code: 'AUTH_EXPIRED'
      });
    }

    // 토큰 유효성 검증: primary 캘린더 조회
    let res;
    try {
      res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (e) {
      return Response.json({
        connected: false,
        error: '네트워크 오류로 Google Calendar 상태를 확인할 수 없습니다.',
        code: 'NETWORK_ERROR'
      });
    }

    if (res.status === 401 || res.status === 403) {
      const errBody = await res.json().catch(() => ({}));
      return Response.json({
        connected: false,
        error: 'Google 인증이 만료되었거나 캘린더 권한이 부족합니다: ' + (errBody?.error?.message || res.status),
        code: 'AUTH_EXPIRED'
      });
    }
    if (!res.ok) {
      return Response.json({
        connected: false,
        error: 'Google Calendar 조회 실패 (status ' + res.status + ')',
        code: 'FETCH_FAILED'
      });
    }

    const data = await res.json();
    return Response.json({
      connected: true,
      calendar: data.summary || data.id || 'primary',
    });
  } catch (error) {
    return Response.json({
      connected: false,
      error: error.message || '상태 확인 중 오류가 발생했습니다.',
      code: 'STATUS_ERROR'
    });
  }
}