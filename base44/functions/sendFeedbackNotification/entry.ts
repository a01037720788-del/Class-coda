import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * 피드백 저장 후 학부모/학생에게 알림을 전송합니다.
 * 
 * 현재는 앱 내 Notification 엔티티에 알림을 생성합니다.
 * 추후 카카오 알림톡 / SMS 연동 시 아래 TODO 섹션을 구현하세요.
 * 
 * Payload:
 *   - studentId: string
 *   - studentName: string
 *   - subjectName: string
 *   - classDate: string (yyyy-MM-dd)
 *   - teacherName: string
 *   - attendanceStatus: string
 *   - learnedContent: string
 *   - homework: string
 *   - parentMemo: string
 *   - notifyChannels: { inApp: boolean, sms: boolean, kakao: boolean }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      studentId,
      studentName,
      subjectName,
      classDate,
      teacherName,
      attendanceStatus,
      learnedContent,
      homework,
      parentMemo,
      notifyChannels = { inApp: true, sms: false, kakao: false },
    } = await req.json();

    const results = { inApp: null, sms: null, kakao: null };

    // ── 1. 앱 내 알림 (Notification 엔티티) ──────────────────────────────
    if (notifyChannels.inApp) {
      // 해당 학생과 연결된 부모 AppUser 찾기
      const students = await base44.asServiceRole.entities.Student.filter({ id: studentId });
      const student = students[0];

      const contentLines = [
        `📅 수업일: ${classDate}`,
        `📚 과목: ${subjectName}`,
        `👨‍🏫 선생님: ${teacherName}`,
        `✅ 출석: ${attendanceStatus}`,
      ];
      if (learnedContent) contentLines.push(`📖 오늘 배운 내용: ${learnedContent}`);
      if (homework) contentLines.push(`📝 숙제: ${homework}`);
      if (parentMemo) contentLines.push(`💬 선생님 메모: ${parentMemo}`);

      const notifData = {
        title: `${studentName} 수업 피드백이 도착했어요`,
        content: contentLines.join('\n'),
        notification_type: 'feedback_added',
        is_read: false,
        is_deleted: false,
        link_path: '/parent/feedback',
      };

      // 학생 본인 알림
      await base44.asServiceRole.entities.Notification.create({
        ...notifData,
        user_id: studentId,
        user_role: 'student',
      });

      // 연결된 부모 알림
      if (student?.parent_user_id) {
        await base44.asServiceRole.entities.Notification.create({
          ...notifData,
          user_id: student.parent_user_id,
          user_role: 'parent',
        });
      }

      results.inApp = 'sent';
    }

    // ── 2. SMS 전송 (TODO: 실제 SMS API 연동) ────────────────────────────
    if (notifyChannels.sms) {
      // TODO: 아래 주석을 해제하고 SMS API 키를 환경변수로 설정하세요.
      // 예: NHN Cloud, 알리고, 솔라피(Solapi) 등
      //
      // const students = await base44.asServiceRole.entities.Student.filter({ id: studentId });
      // const student = students[0];
      // const phoneNumber = student?.parent_phone || student?.phone;
      // if (phoneNumber) {
      //   const smsApiKey = Deno.env.get("SMS_API_KEY");
      //   const smsApiSecret = Deno.env.get("SMS_API_SECRET");
      //   const senderNumber = Deno.env.get("SMS_SENDER_NUMBER");
      //   // ... SMS API 호출 ...
      // }
      results.sms = 'not_implemented';
    }

    // ── 3. 카카오 알림톡 (TODO: 카카오 비즈니스 API 연동) ─────────────────
    if (notifyChannels.kakao) {
      // TODO: 카카오 비즈메시지(알림톡) API 연동
      // 카카오 채널 개설 + 알림톡 템플릿 승인 후 아래를 구현하세요.
      // 참고: https://business.kakao.com/info/bizmessage/
      //
      // const kakaoApiKey = Deno.env.get("KAKAO_BIZTALK_API_KEY");
      // const senderKey = Deno.env.get("KAKAO_SENDER_KEY");
      // const templateCode = Deno.env.get("KAKAO_TEMPLATE_CODE");
      // ...
      results.kakao = 'not_implemented';
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});