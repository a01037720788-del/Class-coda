import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Database, Eye, EyeOff } from "lucide-react";
import { isSuperAdmin } from "@/lib/auth";

// Supabase students 원본 row에서 비밀번호/secret 제외 후 JSON 표시용 객체 생성
function buildSafeRawJson(student) {
  if (!student) return null;
  const {
    password, // 비밀번호 필드 제외
    ...safe
  } = student;
  return safe;
}

// 섹션 래퍼
function Section({ number, title, children }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">
          <span className="text-blue-600 mr-1.5">{number}</span>
          {title}
        </p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// 키-값 행
function Field({ label, value, fallback = "-" }) {
  const display = value ?? fallback;
  return (
    <div className="flex gap-2 py-1.5 text-sm">
      <span className="w-28 flex-shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-900 break-all">{display === "" ? fallback : display}</span>
    </div>
  );
}

// 연결 상태 표시 (✓/✕)
function StatusItem({ ok, label, warn = false }) {
  return (
    <div className="flex items-center gap-1.5 py-1 text-sm">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : warn ? (
        <AlertTriangle className="w-4 h-4 text-amber-500" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400" />
      )}
      <span className={ok ? "text-gray-700" : warn ? "text-amber-700" : "text-red-600"}>{label}</span>
    </div>
  );
}

export default function StudentDetailModal({
  student,
  appUser,       // 연결된 app_users row (없으면 null)
  enrollments,   // 해당 학생의 enrollments 배열
  subjects,      // 전체 과목 목록
  teachers,      // 전체 teacher/admin AppUser 목록
  open,
  onClose,
  onEdit,        // 수정 버튼 콜백
}) {
  const [showRaw, setShowRaw] = useState(false);
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("coda_session_user") || "null");
    } catch {
      return null;
    }
  }, []);
  const canViewRaw = isSuperAdmin(user);

  if (!student) return null;

  const studentPhone = student.student_phone || student.phone || "";
  const perms = student.subject_permissions || {};
  const teacherIds = student.teacher_ids || [];
  const teacherNames = student.teacher_names || [];
  const studentSubjects = student.subjects || [];

  // 담당 선생님 AppUser 연결 확인
  const connectedTeachers = teacherIds.map(id => teachers.find(t => t.id === id)).filter(Boolean);
  const hasDisconnectedTeacher = teacherIds.length > 0 && connectedTeachers.length < teacherIds.length;

  // 로그인 계정 연결 확인
  const hasAppUser = !!appUser;

  // 수강 과목 매칭 (subject_permissions 기준)
  const subjectPermList = subjects.map(sub => {
    const byId = perms[sub.id] === true;
    const byName = perms[sub.name] === true;
    return { name: sub.name, allowed: byId || byName };
  });

  const rawSafe = buildSafeRawJson(student);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>학생 상세</span>
            <Badge className={student.is_active !== false ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-500 border-0"}>
              {student.is_active !== false ? "재원중" : "비활성"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {/* ① 기본정보 */}
          <Section number="①" title="기본정보 (Supabase students)">
            <Field label="이름" value={student.name} />
            <Field label="학년" value={student.grade} />
            <Field label="학교" value={student.school_name} />
            <Field label="학교 유형" value={student.school_type === "custom" ? "직접 입력" : student.school_type === "preset" ? "선택" : student.school_type} />
            <Field label="학생 전화번호" value={studentPhone} />
            <Field label="이메일" value={student.email} />
            <Field label="재원 상태" value={student.is_active !== false ? "재원중" : "비활성"} />
            <Field label="등록일" value={student.created_at || student.created_date} />
          </Section>

          {/* ② 로그인 계정 */}
          <Section number="②" title="로그인 계정 (app_users)">
            {hasAppUser ? (
              <>
                <Field label="login_id" value={appUser.login_id} />
                <Field label="role" value={appUser.role} />
                <Field label="계정 활성" value={appUser.is_active ? "활성" : "비활성"} />
                <Field label="비밀번호 변경 필요" value={appUser.must_change_password ? "예" : "아니오"} />
              </>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>⚠ 연결되지 않음 (app_users에 연결된 계정 없음)</span>
              </div>
            )}
          </Section>

          {/* ③ 담당 선생님 */}
          <Section number="③" title="담당 선생님 (students.teacher_ids/names)">
            {teacherNames.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {teacherNames.map(n => (
                    <Badge key={n} variant="outline" className="text-xs">{n}</Badge>
                  ))}
                </div>
                {hasDisconnectedTeacher && (
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs mt-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>⚠ 일부 선생님 계정 연결 확인 필요 (AppUser에 없는 teacher_id 포함)</span>
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-400 font-mono">
                  teacher_ids: {JSON.stringify(teacherIds)}
                </div>
              </>
            ) : (
              <span className="text-gray-400 text-sm">미배정</span>
            )}
          </Section>

          {/* ④ 과목 및 권한 */}
          <Section number="④" title="과목 및 권한 (students.subjects / subject_permissions)">
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">수강 과목 (subjects)</p>
              {studentSubjects.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {studentSubjects.map(s => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 text-sm">없음</span>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">과목 접근 권한 (subject_permissions)</p>
              {subjectPermList.length > 0 ? (
                <div className="space-y-1">
                  {subjectPermList.map(p => (
                    <div key={p.name} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-gray-700">{p.name}</span>
                      <Badge className={p.allowed ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-500 border-0"}>
                        {p.allowed ? "사용 가능" : "사용 불가"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 text-sm">과목 권한 정보 없음</span>
              )}
            </div>
          </Section>

          {/* ⑤ 수강/결제 */}
          <Section number="⑤" title="수강/결제 (enrollments)">
            {enrollments && enrollments.length > 0 ? (
              <div className="space-y-2">
                {enrollments.map(e => {
                  const rem = e.remaining_lessons ?? (e.paid_lessons || 0) - (e.completed_lessons || 0);
                  const isLow = rem <= 0 && (e.paid_lessons || 0) > 0;
                  return (
                    <div key={e.id} className="border border-gray-100 rounded-lg p-2.5 bg-gray-50">
                      <p className="text-sm font-medium text-gray-800 mb-1">{e.subject_name}</p>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>결제 {e.paid_lessons || 0}회</span>
                        <span>수업 {e.completed_lessons || 0}회</span>
                        <span className={isLow ? "text-red-600 font-semibold" : "text-green-700"}>남은 {rem}회</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-gray-400 text-sm">수강 정보 없음</span>
            )}
          </Section>

          {/* ⑥ 학부모 정보 */}
          <Section number="⑥" title="학부모 정보">
            <Field label="학부모 전화번호" value={student.parent_phone} />
            <Field label="학부모 연결 ID" value={student.parent_user_id} />
          </Section>

          {/* ⑦ 메모 */}
          <Section number="⑦" title="메모">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{student.notes || "-"}</p>
          </Section>

          {/* 연결 상태 요약 */}
          <div className="border border-gray-200 rounded-lg p-3 bg-blue-50/30">
            <p className="text-xs font-semibold text-gray-600 mb-1.5">데이터 정합성 검사</p>
            <div className="grid grid-cols-2 gap-x-4">
              <StatusItem ok={true} label="학생 기본정보 (students row)" />
              <StatusItem ok={hasAppUser} warn={!hasAppUser} label={hasAppUser ? "로그인 계정 (app_users)" : "로그인 계정 연결 안됨"} />
              <StatusItem ok={teacherNames.length > 0} warn={teacherNames.length === 0} label={teacherNames.length > 0 ? "담당 선생님" : "담당 선생님 미배정"} />
              <StatusItem ok={studentSubjects.length > 0} warn={studentSubjects.length === 0} label={studentSubjects.length > 0 ? "과목 설정됨" : "과목 미설정"} />
              <StatusItem ok={enrollments && enrollments.length > 0} warn={!enrollments || enrollments.length === 0} label={enrollments && enrollments.length > 0 ? "수강정보 있음" : "수강정보 없음"} />
            </div>
          </div>

          {/* Supabase 원본 데이터 확인 (super_admin only) */}
          {canViewRaw && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowRaw(v => !v)}
                className="w-full px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
              >
                {showRaw ? <EyeOff className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                <span>Supabase 원본 데이터 확인</span>
                <span className="text-xs text-gray-400 ml-auto">(super_admin 전용)</span>
              </button>
              {showRaw && (
                <pre className="p-3 bg-gray-900 text-green-300 text-xs overflow-x-auto max-h-64 font-mono">
                  {JSON.stringify(rawSafe, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">닫기</Button>
            {onEdit && (
              <Button onClick={() => { onClose(); onEdit(); }} className="flex-1 bg-blue-600 hover:bg-blue-700">
                수정
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}