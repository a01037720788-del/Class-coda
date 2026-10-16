import React, { useEffect, useState } from "react";
import { getSessionUser } from "@/lib/auth";
import { loadStudent, loadAllSubjects, loadEnrollments } from "@/lib/dataAccess";
import { Lock } from "lucide-react";
import { hasSubjectAccess, getSubjectType } from "@/utils/subjectAccess";

export default function SubjectGuard({ subjectKey, children }) {
  const [allowed, setAllowed] = useState(null); // null = 로딩 중

  useEffect(() => {
    const u = getSessionUser();
    if (!u?.student_id) { setAllowed(false); return; }

    Promise.all([
      loadStudent(u.student_id),
      loadAllSubjects(),
      loadEnrollments(u.student_id),
    ])
      .then(([student, subjectList, enrollments]) => {
        if (!student) { setAllowed(false); return; }
        // subjectKey는 과목 이름 (e.g. "HTML", "엔트리", "저학년 Python") → type key로 변환
        const typeKey = getSubjectType(subjectKey, subjectList) || subjectKey.toLowerCase().replace(/\s/g, "_");
        // 해당 Subject가 명시적으로 비활성(is_active === false)이면 접근 불가
        const subjectRecord = subjectList.find(s => s.type === typeKey || getSubjectType(s.name, []) === typeKey);
        if (subjectRecord && subjectRecord.is_active === false) { setAllowed(false); return; }
        setAllowed(hasSubjectAccess(typeKey, student, subjectList, enrollments));
      })
      .catch(() => setAllowed(false));
  }, [subjectKey]);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#7c3aed] rounded-full animate-spin" />
      </div>
    );
  }

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