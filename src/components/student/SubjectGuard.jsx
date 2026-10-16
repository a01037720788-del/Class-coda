import React from "react";
import { getSessionUser } from "@/lib/auth";
import { Lock } from "lucide-react";
import { hasSubjectAccess, getSubjectType } from "@/utils/subjectAccess";

/**
 * 수강 과목 접근 제한.
 * Students 시트의 subjects 열(로그인 · 세션 검증 때 서버가 내려준 값)만 기준으로 판단합니다.
 */
export default function SubjectGuard({ subjectKey, children }) {
  const user = getSessionUser();
  const typeKey = getSubjectType(subjectKey, []) || subjectKey;
  const allowed = !!user?.student_id && hasSubjectAccess(typeKey, user);

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <div>
          <p className="text-gray-700 font-semibold text-lg">접근이 제한된 과목입니다</p>
          <p className="text-gray-400 text-sm mt-1">선생님이 아직 해당 과목을 열어주지 않았습니다.</p>
        </div>
      </div>
    );
  }

  return children;
}