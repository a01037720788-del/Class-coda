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

    const body = await req.json().catch(() => ({}));

    // 연결 확인
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({
        error: 'Google Calendar 연결이 없습니다.',
        code: 'NO_CONNECTION'
      }, { status: 401 });
    }
    if (!accessToken) {
      return Response.json({
        error: 'Google 인증 토큰이 없습니다. 연결이 만료되었을 수 있습니다.',
        code: 'AUTH_EXPIRED'
      }, { status: 401 });
    }

    // 캘린더 선택 저장
    if (body.action === 'select' && body.calendar_id) {
      try {
        const existing = await base44.asServiceRole.entities.GoogleCalendarSetting.list('-updated_date', 10);
        const calendarTitle = body.calendar_title || '';
        if (existing.length > 0) {
          await base44.asServiceRole.entities.GoogleCalendarSetting.update(existing[0].id, {
            calendar_id: body.calendar_id,
            calendar_title: calendarTitle,
          });
        } else {
          await base44.asServiceRole.entities.GoogleCalendarSetting.create({
            calendar_id: body.calendar_id,
            calendar_title: calendarTitle,
          });
        }
      } catch (e) {
        return Response.json({
          error: '캘린더 선택 저장 실패: ' + (e.message || ''),
          code: 'SAVE_FAILED'
        }, { status: 500 });
      }
    }

    // 캘린더 목록 조회
    let res;
    try {
      res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (e) {
      return Response.json({
        error: '네트워크 오류로 캘린더 목록을 불러올 수 없습니다.',
        code: 'NETWORK_ERROR'
      }, { status: 502 });
    }
    if (res.status === 401 || res.status === 403) {
      const errBody = await res.json().catch(() => ({}));
      return Response.json({
        error: 'Google 인증 만료 또는 캘린더 권한 부족: ' + (errBody?.error?.message || res.status),
        code: 'AUTH_EXPIRED'
      }, { status: 401 });
    }
    if (!res.ok) {
      return Response.json({
        error: '캘린더 목록 조회 실패 (status ' + res.status + ')',
        code: 'FETCH_FAILED'
      }, { status: 502 });
    }
    const data = await res.json();
    const calendars = (data.items || []).map(c => ({
      id: c.id,
      title: c.summary || c.id,
      primary: c.primary || false,
    }));

    // 현재 선택된 캘린더
    let selected = null;
    try {
      const settings = await base44.asServiceRole.entities.GoogleCalendarSetting.list('-updated_date', 10);
      if (settings.length > 0 && settings[0].calendar_id) {
        selected = {
          id: settings[0].calendar_id,
          title: settings[0].calendar_title || '',
        };
      }
    } catch (e) { /* 없음 */ }

    return Response.json({ calendars, selected });
  } catch (error) {
    return Response.json({
      error: error.message || '캘린더 목록 조회 중 오류가 발생했습니다.',
      code: 'LIST_ERROR'
    }, { status: 500 });
  }
}