import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ── Asia/Seoul 기준 ISO → { classDate, time } 변환 ──────────────────────────
function formatSeoulDateTime(isoString: string): { classDate: string; time: string } {
  if (!isoString) return { classDate: '', time: '' };
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { classDate: '', time: '' };

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return {
    classDate: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
  };
}

// ── 과목 코드 매핑 ──────────────────────────────────────────────────────────
const SUBJECT_CODE_MAP: Record<string, string> = {
  py: 'Python', python: 'Python',
  cpp: 'C++', 'c++': 'C++', c: 'C++',
  alg: '알고리즘 학습', algorithm: '알고리즘 학습', algo: '알고리즘 학습',
  jpy: '저학년 Python', jrpy: '저학년 Python', juniorpy: '저학년 Python', junior: '저학년 Python',
  java: 'Java',
  html: 'HTML', web: 'HTML',
  entry: '엔트리',
  block: '블록코딩',
  cos: 'COS',
};

const SUBJECT_TYPE_TO_NAME: Record<string, string> = {
  python: 'Python', junior_python: '저학년 Python', cpp: 'C++',
  java: 'Java', html: 'HTML', algorithm_learning: '알고리즘 학습',
  algorithm: '알고리즘', entry: '엔트리', block: '블록코딩', cos: 'COS',
};

// ── Google 일정 제목 파서 ───────────────────────────────────────────────────
function parseGoogleEventTitle(rawTitle: string) {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return { prefix: '', display_time: '', student_name: '', school: '', grade: '', week_or_level: '', subject_code: '', subject_name: '' };
  }
  const title = rawTitle.trim();
  const result = { prefix: '', display_time: '', student_name: '', school: '', grade: '', week_or_level: '', subject_code: '', subject_name: '' };

  // 괄호 안 정보: (NLCS/Y5/W1/Py)
  const parenMatch = title.match(/\(([^)]+)\)/);
  let parenContent = '';
  if (parenMatch) parenContent = parenMatch[1].trim();

  if (parenContent) {
    const parts = parenContent.split('/').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (SUBJECT_CODE_MAP[lower]) {
        result.subject_code = part;
        result.subject_name = SUBJECT_CODE_MAP[lower];
        continue;
      }
      if (/^[yg]\d+$/i.test(part) || /^[yg]\d+\-\d+$/i.test(part)) {
        result.grade = part;
        continue;
      }
      if (/^w\d+$/i.test(part)) {
        result.week_or_level = part;
        continue;
      }
      if (!result.school) result.school = part;
    }
  }

  // 괄호 외부: H-17:00 신도헌
  const outsideText = title.replace(/\([^)]+\)/, '').trim();
  const prefixTimeMatch = outsideText.match(/^([A-Za-z])\s*[-:]\s*(\d{1,2}:\d{2})\s*(.*)/);
  if (prefixTimeMatch) {
    result.prefix = prefixTimeMatch[1].toUpperCase();
    result.display_time = prefixTimeMatch[2];
    result.student_name = prefixTimeMatch[3].trim();
  } else {
    const timeOnlyMatch = outsideText.match(/^(\d{1,2}:\d{2})\s+(.*)/);
    if (timeOnlyMatch) {
      result.display_time = timeOnlyMatch[1];
      result.student_name = timeOnlyMatch[2].trim();
    } else {
      result.student_name = outsideText;
    }
  }

  if (result.student_name) {
    result.student_name = result.student_name.replace(/^[\-:\s]+/, '').replace(/[\-:\s]+$/, '').trim();
  }
  return result;
}

// ── 과목 매칭 ──────────────────────────────────────────────────────────────
function matchSubjectFromParsed(parsedInfo: any, subjects: any[]) {
  if (!parsedInfo || !subjects || subjects.length === 0) return null;
  const code = (parsedInfo.subject_code || '').toLowerCase();
  const nameFromCode = parsedInfo.subject_name || (code ? SUBJECT_CODE_MAP[code] : '');
  if (!nameFromCode) return null;

  let match = subjects.find(s => s.name === nameFromCode && !s.is_deleted);
  if (match) return { subject_id: match.id, subject_name: match.name };

  const typeKey = Object.entries(SUBJECT_TYPE_TO_NAME).find(([, name]) => name === nameFromCode)?.[0];
  if (typeKey) {
    match = subjects.find(s => s.type === typeKey && !s.is_deleted);
    if (match) return { subject_id: match.id, subject_name: match.name };
  }

  match = subjects.find(s => !s.is_deleted && s.name && s.name.toLowerCase().includes(nameFromCode.toLowerCase()));
  if (match) return { subject_id: match.id, subject_name: match.name };

  return { subject_id: '', subject_name: nameFromCode };
}

// ── 학생 매칭 (이름 + 학교/학년 검증) ────────────────────────────────────────
function matchStudentFromParsed(parsedInfo: any, students: any[]) {
  if (!parsedInfo || !parsedInfo.student_name) {
    return { matched: [] as any[], ambiguous: false, reason: '학생 이름 없음' };
  }
  const name = parsedInfo.student_name.trim();
  if (!name) return { matched: [] as any[], ambiguous: false, reason: '학생 이름 없음' };

  const byName = students.filter(s => s.name === name);
  if (byName.length === 0) {
    return { matched: [] as any[], ambiguous: false, reason: `이름 "${name}"과 일치하는 학생 없음` };
  }
  if (byName.length === 1) {
    return { matched: [byName[0]], ambiguous: false, reason: '정상 연결' };
  }

  // 동명이인: 학교/학년으로 좁히기
  let candidates = byName;

  if (parsedInfo.school) {
    const schoolLower = parsedInfo.school.toLowerCase();
    const bySchool = candidates.filter(s => s.school_name && s.school_name.toLowerCase().includes(schoolLower));
    if (bySchool.length > 0 && bySchool.length < candidates.length) {
      candidates = bySchool;
    }
  }

  if (parsedInfo.grade) {
    const gradeLower = parsedInfo.grade.toLowerCase();
    const gradeNum = gradeLower.replace(/[^0-9]/g, '');
    if (gradeNum) {
      const byGrade = candidates.filter(s => {
        if (!s.grade) return false;
        const studentGradeNum = s.grade.toLowerCase().replace(/[^0-9]/g, '');
        return studentGradeNum && gradeNum === studentGradeNum;
      });
      if (byGrade.length > 0 && byGrade.length < candidates.length) {
        candidates = byGrade;
      }
    }
  }

  if (candidates.length === 1) {
    return { matched: [candidates[0]], ambiguous: false, reason: '동명이인 → 학교/학년으로 식별' };
  }

  return { matched: [] as any[], ambiguous: true, reason: `동명이인 ${candidates.length}명: 학교/학년으로 식별 불가` };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: '인증되지 않은 사용자입니다.', code: 'AUTH_FAILED' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: '관리자 권한이 필요합니다.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'sync'; // 'sync' | 'forceSync' | 'preview' | 'diagnose' | 'reset' | 'fullReset' | 'siteOnlyReset' | 'googleOnlyReset'
    const isForce = mode === 'forceSync' || mode === 'reset';
    const isPreview = mode === 'preview';
    const isFullReset = mode === 'fullReset';
    const isSiteOnlyReset = mode === 'siteOnlyReset';
    const isGoogleOnlyReset = mode === 'googleOnlyReset';
    const deleteAttendance = body.deleteAttendance === true;

    // ── 사이트 전용 초기화: Google Calendar 없이 일정만 모두 삭제 + 검증 ──
    if (isSiteOnlyReset) {
      // 1) 전체 ClassSchedule 삭제
      const allSchedules = await base44.asServiceRole.entities.ClassSchedule.list('-created_date', 10000);
      const deletedSchedules = allSchedules.length;
      if (deletedSchedules > 0) {
        await base44.asServiceRole.entities.ClassSchedule.deleteMany({});
      }
      // 2) 전체 ClassScheduleStudent 삭제 (고아 데이터 방지)
      const allCss = await base44.asServiceRole.entities.ClassScheduleStudent.list('-created_date', 10000);
      const deletedCss = allCss.length;
      if (deletedCss > 0) {
        await base44.asServiceRole.entities.ClassScheduleStudent.deleteMany({});
      }
      // 3) 검증: 실제로 0건인지 재조회
      const verifySchedules = await base44.asServiceRole.entities.ClassSchedule.list('-created_date', 100);
      const verifyCss = await base44.asServiceRole.entities.ClassScheduleStudent.list('-created_date', 100);
      const verified = verifySchedules.length === 0 && verifyCss.length === 0;
      return Response.json({
        success: verified,
        mode: 'siteOnlyReset',
        deletedSchedules,
        deletedCss,
        remainingSchedules: verifySchedules.length,
        remainingCss: verifyCss.length,
        verified,
      });
    }

    // 동기화 범위: 커스텀 범위 또는 기본값 (이전 3개월 ~ 이후 12개월)
    const now = new Date();
    let timeMin: Date, timeMax: Date;
    if (body.range && body.range.from && body.range.to) {
      timeMin = new Date(body.range.from + 'T00:00:00+09:00');
      timeMax = new Date(body.range.to + 'T23:59:59+09:00');
    } else {
      timeMin = new Date(now);
      timeMin.setMonth(timeMin.getMonth() - 3);
      timeMax = new Date(now);
      timeMax.setMonth(timeMax.getMonth() + 12);
    }
    const rangeStart = timeMin.toISOString().slice(0, 10);
    const rangeEnd = timeMax.toISOString().slice(0, 10);

    // 1) Google Calendar 연결 확인
    let accessToken: string;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({
        error: 'Google Calendar 연결이 없습니다. 학원 관리자가 Google Calendar를 연결해야 합니다.',
        code: 'NO_CONNECTION'
      }, { status: 401 });
    }
    if (!accessToken) {
      return Response.json({
        error: 'Google 인증 토큰이 없습니다. 연결이 만료되었을 수 있습니다.',
        code: 'AUTH_EXPIRED'
      }, { status: 401 });
    }

    // 2) 선택된 캘린더 확인
    let calendarId = 'primary';
    try {
      const settings = await base44.asServiceRole.entities.GoogleCalendarSetting.list('-updated_date', 10);
      if (settings.length > 0 && settings[0].calendar_id) {
        calendarId = settings[0].calendar_id;
      }
    } catch (e) { /* 기본 primary 사용 */ }

    // 3) Google Calendar 이벤트 조회 (페이지네이션, singleEvents=true로 반복 일정 개별 조회)
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const baseParams = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const allEvents: any[] = [];
    let pageToken: string | null = null;
    let fetchOk = true;
    let fetchError = '';
    let fetchCode = '';

    do {
      const url = pageToken
        ? `${baseUrl}?${baseParams.toString()}&pageToken=${encodeURIComponent(pageToken)}`
        : `${baseUrl}?${baseParams.toString()}`;
      let res: Response;
      try {
        res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      } catch (e: any) {
        fetchOk = false;
        fetchError = '네트워크 오류: ' + (e.message || '');
        fetchCode = 'NETWORK_ERROR';
        break;
      }
      if (res.status === 401 || res.status === 403) {
        const errBody = await res.json().catch(() => ({}));
        fetchOk = false;
        fetchError = 'Google 인증 실패: ' + (errBody?.error?.message || res.status);
        fetchCode = 'AUTH_FAILED';
        break;
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        fetchOk = false;
        fetchError = 'Google 일정 조회 실패: ' + (errBody?.error?.message || `status ${res.status}`);
        fetchCode = 'FETCH_FAILED';
        break;
      }
      const data = await res.json();
      allEvents.push(...(data.items || []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    if (!fetchOk) {
      return Response.json({ error: fetchError, code: fetchCode }, { status: 502 });
    }

    // 4) 학생/과목 목록 로드
    const [students, subjects] = await Promise.all([
      base44.asServiceRole.entities.Student.list('-created_date', 5000),
      base44.asServiceRole.entities.Subject.list('-created_date', 500),
    ]);

    // 5) 기존 Google 일정 로드 (google_event_id 기준)
    let existingInRange: any[] = [];
    let existingByEventId: Record<string, any> = {};

    // ── 전체 초기화 모드: 기존 일정 모두 삭제 ──
    let deletedSchedules = 0, deletedCss = 0;
    if (isFullReset || isGoogleOnlyReset) {
      if (isFullReset) {
        // fullReset: 모든 ClassSchedule 삭제 (site + google 모두)
        const allSchedules = await base44.asServiceRole.entities.ClassSchedule.list('-created_date', 10000);
        deletedSchedules = allSchedules.length;
        if (deletedSchedules > 0) {
          await base44.asServiceRole.entities.ClassSchedule.deleteMany({});
        }
        // ClassScheduleStudent 전체 삭제 (고아 데이터 방지)
        const allCss = await base44.asServiceRole.entities.ClassScheduleStudent.list('-created_date', 10000);
        deletedCss = allCss.length;
        if (deletedCss > 0) {
          await base44.asServiceRole.entities.ClassScheduleStudent.deleteMany({});
        }
      } else {
        // googleOnlyReset: calendar_source='google'인 일정만 삭제 (site 일정 보호)
        const googleSchedules = await base44.asServiceRole.entities.ClassSchedule.filter(
          { calendar_source: 'google' }, '-created_date', 10000
        );
        deletedSchedules = googleSchedules.length;
        if (deletedSchedules > 0) {
          await base44.asServiceRole.entities.ClassSchedule.deleteMany({ calendar_source: 'google' });
        }
        // 삭제된 google 일정에 연결된 ClassScheduleStudent만 삭제
        const deletedSchedIds = new Set(googleSchedules.map(s => s.id));
        if (deletedSchedIds.size > 0) {
          const allCss = await base44.asServiceRole.entities.ClassScheduleStudent.list('-created_date', 10000);
          const orphanCss = allCss.filter(c => deletedSchedIds.has(c.schedule_id));
          deletedCss = orphanCss.length;
          for (const css of orphanCss) {
            try { await base44.asServiceRole.entities.ClassScheduleStudent.delete(css.id); } catch (e) { /* 이미 삭제됨 */ }
          }
        }
      }
      // 검증: 실제로 0건인지 재조회
      const verifySchedules = isFullReset
        ? await base44.asServiceRole.entities.ClassSchedule.list('-created_date', 100)
        : (await base44.asServiceRole.entities.ClassSchedule.filter({ calendar_source: 'google' }, '-created_date', 100));
      if (verifySchedules.length > 0) {
        return Response.json({
          error: `초기화 검증 실패: ${isFullReset ? 'ClassSchedule' : 'Google 일정'}이 ${verifySchedules.length}건 남아있습니다.`,
          code: 'RESET_VERIFY_FAILED',
        }, { status: 500 });
      }
      // existingByEventId, existingInRange는 빈 상태 유지 → 모든 Google 이벤트를 신규로 처리
    } else {
      const existing = await base44.asServiceRole.entities.ClassSchedule.filter(
        { calendar_source: 'google' },
        '-class_date',
        5000
      );
      existingInRange = existing.filter(s => {
        if (!s.class_date) return false;
        return s.class_date >= rangeStart && s.class_date <= rangeEnd;
      });
      existingInRange.forEach(s => {
        if (s.google_event_id) existingByEventId[s.google_event_id] = s;
      });
    }

    // ── 진단 모드 ──────────────────────────────────────────────────────────
    if (mode === 'diagnose') {
      const recentEvents = allEvents.filter(e => e.status !== 'cancelled').slice(0, 20);
      const diagnostics = recentEvents.map(ev => {
        const startObj = ev.start || {};
        const endObj = ev.end || {};
        const isAllDay = !startObj.dateTime;
        let googleDate: string, googleStart: string, googleEnd: string;
        if (isAllDay) {
          googleDate = startObj.date || '';
          googleStart = '종일';
          googleEnd = '';
        } else {
          const s = formatSeoulDateTime(startObj.dateTime);
          const e = formatSeoulDateTime(endObj.dateTime);
          googleDate = s.classDate;
          googleStart = s.time;
          googleEnd = e.time;
        }
        const parsed = parseGoogleEventTitle(ev.summary || '');
        const existingRec = existingByEventId[ev.id];
        const studentMatch = matchStudentFromParsed(parsed, students);
        const subjectMatch = matchSubjectFromParsed(parsed, subjects);

        const issues: string[] = [];
        if (!existingRec) {
          issues.push('사이트에 없는 일정');
        } else {
          if (existingRec.class_date !== googleDate) issues.push('날짜 불일치');
          if (!isAllDay && existingRec.start_time !== googleStart) issues.push('시간 불일치');
          if (studentMatch.matched.length > 0 && (!existingRec.student_ids || existingRec.student_ids.length === 0)) {
            issues.push('학생 연결 누락');
          }
          if (studentMatch.ambiguous) issues.push('동명이인: ' + studentMatch.reason);
        }

        return {
          eventId: ev.id,
          googleTitle: ev.summary || '',
          googleDate, googleStart, googleEnd, isAllDay,
          parsed,
          studentMatch: { matched_names: studentMatch.matched.map(s => s.name), ambiguous: studentMatch.ambiguous, reason: studentMatch.reason },
          subjectMatch: subjectMatch ? { subject_name: subjectMatch.subject_name, subject_id: subjectMatch.subject_id } : null,
          siteExists: !!existingRec,
          siteDate: existingRec?.class_date || '',
          siteStart: existingRec?.start_time || '',
          siteEnd: existingRec?.end_time || '',
          siteStudentNames: existingRec?.student_names || [],
          siteSubjectName: existingRec?.subject_name || '',
          issues,
        };
      });
      return Response.json({ success: true, mode: 'diagnose', diagnostics, totalFetched: allEvents.length });
    }

    // ── 미리보기 모드 ──────────────────────────────────────────────────────
    if (isPreview) {
      const previews: any[] = [];
      let pCreated = 0, pUpdated = 0, pStudentLinked = 0, pStudentMatchFailed = 0, pSubjectLinked = 0;
      for (const ev of allEvents.slice(0, 100)) {
        if (ev.status === 'cancelled') continue;
        const startObj = ev.start || {};
        const endObj = ev.end || {};
        const isAllDay = !startObj.dateTime;
        let classDate = '', startTime = '', endTime = '';
        if (isAllDay) {
          classDate = startObj.date || '';
        } else {
          const s = formatSeoulDateTime(startObj.dateTime);
          const e = formatSeoulDateTime(endObj.dateTime);
          classDate = s.classDate;
          startTime = s.time;
          endTime = e.time;
        }
        const parsed = parseGoogleEventTitle(ev.summary || '');
        const studentMatch = matchStudentFromParsed(parsed, students);
        const subjectMatch = matchSubjectFromParsed(parsed, subjects);
        const existingRec = existingByEventId[ev.id];

        if (studentMatch.matched.length > 0) pStudentLinked++;
        if (studentMatch.ambiguous || (parsed.student_name && studentMatch.matched.length === 0)) pStudentMatchFailed++;
        if (subjectMatch && subjectMatch.subject_id) pSubjectLinked++;
        if (existingRec) pUpdated++; else pCreated++;

        previews.push({
          googleTitle: ev.summary || '',
          parsed,
          classDate, startTime, endTime,
          studentMatch: {
            matched_names: studentMatch.matched.map(s => s.name),
            matched_ids: studentMatch.matched.map(s => s.id),
            ambiguous: studentMatch.ambiguous,
            reason: studentMatch.reason,
          },
          subjectMatch: subjectMatch ? { subject_name: subjectMatch.subject_name, subject_id: subjectMatch.subject_id } : null,
          isExisting: !!existingRec,
          status: studentMatch.matched.length > 0 ? '✓ 정상 연결' : studentMatch.ambiguous ? '⚠ 동명이인' : '⚠ 학생 연결 필요',
        });
      }
      return Response.json({
        success: true, mode: 'preview',
        previews,
        summary: {
          totalShown: previews.length,
          totalFetched: allEvents.length,
          created: pCreated, updated: pUpdated,
          studentLinked: pStudentLinked, studentMatchFailed: pStudentMatchFailed,
          subjectLinked: pSubjectLinked,
        },
      });
    }

    // 6) 동기화 처리 (sync / forceSync / reset)
    const fetchedIds = new Set<string>();
    let created = 0, updated = 0, cancelled = 0, skipped = 0;
    let studentLinked = 0, studentMatchFailed = 0, subjectLinked = 0;
    let cssCreated = 0, attendancePreserved = 0;
    const lastSyncedAt = new Date().toISOString();

    const newRecords: any[] = [];
    const updateRecords: any[] = [];
    const cancelUpdates: any[] = [];
    const cssToCreate: any[] = []; // ClassScheduleStudent 생성 목록

    // 기존 ClassScheduleStudent 로드 (누락 보정용)
    const allCssRecords = await base44.asServiceRole.entities.ClassScheduleStudent.list('-created_date', 10000);
    const cssByScheduleId: Record<string, any[]> = {};
    allCssRecords.forEach(c => {
      if (!c.is_deleted) {
        if (!cssByScheduleId[c.schedule_id]) cssByScheduleId[c.schedule_id] = [];
        cssByScheduleId[c.schedule_id].push(c);
      }
    });

    for (const ev of allEvents) {
      if (!ev.id) continue;
      fetchedIds.add(ev.id);
      const existingRec = existingByEventId[ev.id];

      // 취소된 일정 처리
      if (ev.status === 'cancelled') {
        if (existingRec && existingRec.status !== 'cancelled') {
          cancelUpdates.push({
            id: existingRec.id,
            status: 'cancelled',
            is_deleted: true,
            google_status: 'cancelled',
            last_synced_at: lastSyncedAt,
          });
          cancelled++;
        }
        continue;
      }

      const startObj = ev.start || {};
      const endObj = ev.end || {};
      const isAllDay = !startObj.dateTime;

      // 날짜/시간 계산 (Asia/Seoul 기준)
      let classDate: string, startTime: string, endTime: string;
      let startAt: string, endAt: string;

      if (isAllDay) {
        classDate = startObj.date || '';
        startTime = '';
        endTime = '';
        startAt = startObj.date ? startObj.date + 'T00:00:00+09:00' : '';
        endAt = endObj.date ? endObj.date + 'T00:00:00+09:00' : '';
      } else {
        startAt = startObj.dateTime || '';
        endAt = endObj.dateTime || '';
        const s = formatSeoulDateTime(startObj.dateTime);
        const e = formatSeoulDateTime(endObj.dateTime);
        classDate = s.classDate;
        startTime = s.time;
        endTime = e.time;
      }

      const title = ev.summary || '(제목 없음)';
      const description = ev.description || '';
      const location = ev.location || '';
      const attendees = (ev.attendees || []).map((a: any) => a.email).filter(Boolean);
      const recurrence = (ev.recurrence || []).join('\n');
      const googleStatus = ev.status || 'confirmed';
      const googleUpdated = ev.updated || '';
      const colorId = ev.colorId || '';

      // 제목 파싱
      const parsed = parseGoogleEventTitle(title);

      // 학생 매칭 (파서 결과 + 학교/학년 검증)
      let studentIds: string[] = [];
      let studentNames: string[] = [];
      let studentLinkSource = 'auto';
      let matchReason = '';

      // 수동 연결 보호: 기존 rec가 manual이면 학생 연결 유지
      if (existingRec && existingRec.student_link_source === 'manual') {
        studentIds = existingRec.student_ids || [];
        studentNames = existingRec.student_names || [];
        studentLinkSource = 'manual';
        matchReason = '수동 연결 유지';
      } else {
        const studentMatch = matchStudentFromParsed(parsed, students);
        studentIds = studentMatch.matched.map(s => s.id);
        studentNames = studentMatch.matched.map(s => s.name);

        if (studentMatch.matched.length > 0) {
          studentLinked++;
          matchReason = studentMatch.reason;
        }
        if (studentMatch.ambiguous || (parsed.student_name && studentMatch.matched.length === 0)) {
          studentMatchFailed++;
          matchReason = studentMatch.reason;
        }
      }

      // 과목 매칭
      const subjectMatch = matchSubjectFromParsed(parsed, subjects);
      let subjectId = '';
      let subjectName = '미지정';
      if (subjectMatch) {
        subjectId = subjectMatch.subject_id || '';
        subjectName = subjectMatch.subject_name || '미지정';
        if (subjectId) subjectLinked++;
      }

      // 기존 과목 연결 보호 (수동 설정된 경우)
      if (existingRec && existingRec.subject_id && !subjectId) {
        subjectId = existingRec.subject_id;
        subjectName = existingRec.subject_name || subjectName;
      }

      const googlePayload: any = {
        title,
        google_original_title: title,
        parsed_info: parsed,
        class_date: classDate,
        start_time: startTime,
        end_time: endTime,
        start_at: startAt,
        end_at: endAt,
        is_all_day: isAllDay,
        description,
        location,
        attendees,
        recurrence_rule: recurrence,
        google_status: googleStatus,
        google_updated: googleUpdated,
        google_color_id: colorId,
        last_synced_at: lastSyncedAt,
        status: 'scheduled',
        is_deleted: false,
        student_ids: studentIds,
        student_names: studentNames,
        student_link_source: studentLinkSource,
        subject_id: subjectId,
        subject_name: subjectName,
      };

      if (existingRec) {
        const googleChanged = existingRec.google_updated !== googleUpdated;

        if (isForce || googleChanged) {
          // forceSync 또는 Google 원본 변경 → 전체 재계산
          // 단, 수동 연결된 학생/과목은 보존
          if (existingRec.student_link_source === 'manual') {
            googlePayload.student_ids = existingRec.student_ids || [];
            googlePayload.student_names = existingRec.student_names || [];
            googlePayload.student_link_source = 'manual';
          }
          updateRecords.push({ id: existingRec.id, ...googlePayload });
          updated++;
        } else {
          // Google 필드 동일 — 내부 파생 데이터 검증 (학생/과목 연결 보정)
          const existingStudentIds = existingRec.student_ids || [];
          const needsStudentUpdate =
            existingStudentIds.length === 0 && studentIds.length > 0;
          const needsSubjectUpdate =
            (!existingRec.subject_id || existingRec.subject_name === '미지정') && subjectId;

          if (needsStudentUpdate || needsSubjectUpdate) {
            const patch: any = { id: existingRec.id, last_synced_at: lastSyncedAt };
            if (needsStudentUpdate && existingRec.student_link_source !== 'manual') {
              patch.student_ids = studentIds;
              patch.student_names = studentNames;
              patch.student_link_source = 'auto';
              if (studentIds.length > 0) studentLinked++;
            }
            if (needsSubjectUpdate) {
              patch.subject_id = subjectId;
              patch.subject_name = subjectName;
              if (subjectId) subjectLinked++;
            }
            patch.parsed_info = parsed;
            patch.google_original_title = title;
            updateRecords.push(patch);
            updated++;
          } else {
            skipped++;
          }
        }

        // ClassScheduleStudent 누락 보정
        const existingCss = cssByScheduleId[existingRec.id] || [];
        const existingStudentIdSet = new Set(existingCss.map(c => c.student_id));
        for (const sid of (existingRec.student_ids || studentIds)) {
          if (sid && !existingStudentIdSet.has(sid)) {
            const studentObj = students.find(s => s.id === sid);
            cssToCreate.push({
              schedule_id: existingRec.id,
              student_id: sid,
              student_name: studentObj?.name || studentNames.find(n => n) || '',
              attendance_status: '미정',
              feedback_completed: false,
              lesson_count_applied: false,
              is_deleted: false,
            });
            cssCreated++;
          } else if (sid && existingStudentIdSet.has(sid)) {
            attendancePreserved++;
          }
        }
      } else {
        // 신규 일정
        const newRec = {
          ...googlePayload,
          google_event_id: ev.id,
          calendar_source: 'google',
          schedule_type: 'single',
        };
        newRecords.push(newRec);
        created++;

        // 신규 일정의 ClassScheduleStudent 생성 (id는 bulkCreate 후 확인)
        for (const sid of studentIds) {
          cssToCreate.push({
            _newEventId: ev.id,
            student_id: sid,
            student_name: studentNames.find(n => n) || '',
            _pendingScheduleId: true,
          });
          cssCreated++;
        }
      }
    }

    // 7) Google에서 사라진 일정을 cancelled로 표시 (site 일정 보호)
    for (const rec of existingInRange) {
      if (rec.google_event_id && !fetchedIds.has(rec.google_event_id) && rec.status !== 'cancelled') {
        cancelUpdates.push({
          id: rec.id,
          status: 'cancelled',
          is_deleted: true,
          last_synced_at: lastSyncedAt,
        });
        cancelled++;
      }
    }

    // ── 미리보기 모드는 DB 변경 없이 결과만 반환 ──
    if (isPreview) {
      return Response.json({
        success: true, mode: 'preview',
        totalFetched: allEvents.length,
        created, updated, cancelled, skipped,
        studentLinked, studentMatchFailed, subjectLinked,
        cssCreated, attendancePreserved,
        range: { from: rangeStart, to: rangeEnd },
      });
    }

    // 8) 배치 실행 (500개씩 청크)
    const chunkSize = 500;
    const chunk = (arr: any[]) => {
      const out: any[][] = [];
      for (let i = 0; i < arr.length; i += chunkSize) out.push(arr.slice(i, i + chunkSize));
      return out;
    };

    // 신규 일정 생성 후 ClassScheduleStudent 연결
    const createdSchedules: any[] = [];
    for (const batch of chunk(newRecords)) {
      try {
        const result = await base44.asServiceRole.entities.ClassSchedule.bulkCreate(batch);
        if (Array.isArray(result)) createdSchedules.push(...result);
      } catch (e) {
        for (const rec of batch) {
          try {
            const r = await base44.asServiceRole.entities.ClassSchedule.create(rec);
            createdSchedules.push(r);
          } catch (e2) {}
        }
      }
    }

    // 신규 일정의 ClassScheduleStudent 생성 (google_event_id로 매핑)
    const newSchedByEventId: Record<string, any> = {};
    createdSchedules.forEach(s => {
      if (s.google_event_id) newSchedByEventId[s.google_event_id] = s;
    });

    const finalCssToCreate: any[] = [];
    for (const css of cssToCreate) {
      if (css._pendingScheduleId) {
        const sched = newSchedByEventId[css._newEventId];
        if (sched) {
          finalCssToCreate.push({
            schedule_id: sched.id,
            student_id: css.student_id,
            student_name: css.student_name,
            attendance_status: '미정',
            feedback_completed: false,
            lesson_count_applied: false,
            is_deleted: false,
          });
        }
      } else {
        delete css._newEventId;
        delete css._pendingScheduleId;
        finalCssToCreate.push(css);
      }
    }

    for (const batch of chunk(updateRecords)) {
      try {
        await base44.asServiceRole.entities.ClassSchedule.bulkUpdate(batch);
      } catch (e) {
        for (const rec of batch) {
          try { await base44.asServiceRole.entities.ClassSchedule.update(rec.id, rec); } catch (e2) {}
        }
      }
    }
    for (const batch of chunk(cancelUpdates)) {
      try {
        await base44.asServiceRole.entities.ClassSchedule.bulkUpdate(batch);
      } catch (e) {
        for (const rec of batch) {
          try { await base44.asServiceRole.entities.ClassSchedule.update(rec.id, rec); } catch (e2) {}
        }
      }
    }

    // ClassScheduleStudent 생성
    for (const batch of chunk(finalCssToCreate)) {
      try {
        await base44.asServiceRole.entities.ClassScheduleStudent.bulkCreate(batch);
      } catch (e) {
        for (const rec of batch) {
          try { await base44.asServiceRole.entities.ClassScheduleStudent.create(rec); } catch (e2) {}
        }
      }
    }

    return Response.json({
      success: true,
      mode,
      totalFetched: allEvents.length,
      created,
      updated,
      cancelled,
      skipped,
      studentLinked,
      studentMatchFailed,
      subjectLinked,
      cssCreated,
      attendancePreserved,
      deletedSchedules,
      deletedCss,
      range: { from: rangeStart, to: rangeEnd },
    });
  } catch (error: any) {
    return Response.json({
      error: error.message || '동기화 중 오류가 발생했습니다.',
      code: 'SYNC_ERROR'
    }, { status: 500 });
  }
}