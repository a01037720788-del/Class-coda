import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getSessionUser, getSessionToken } from "@/lib/auth";
import { loadAllStudents, listAppUsers } from "@/lib/dataAccess";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { Users, CalendarCheck, Calendar, Code2, BookOpen, UserCog } from "lucide-react";
import OnlineStudentsPanel from "@/components/admin/OnlineStudentsPanel";

export default function AdminDashboardPage() {
  const [allStudents, setAllStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [weeklyClassStudentIds, setWeeklyClassStudentIds] = useState(new Set());
  const [user, setUser] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

    Promise.all([
      loadAllStudents(),
      listAppUsers(),
      base44.entities.ClassSchedule.filter(
        { class_date: { $gte: weekStart, $lte: weekEnd } },
        "class_date",
        2000
      ),
    ]).then(([students, allUsers, schedules]) => {
      const activeStudents = students.filter(s => s.is_active !== false);
      const adminAndTeachers = (allUsers || []).filter(
        u => u.role === "admin" || u.role === "super_admin" || u.role === "teacher"
      );
      setAllStudents(activeStudents);
      setTeachers(adminAndTeachers);

      const activeSchedules = (schedules || []).filter(s => s.is_deleted !== true);
      setWeeklyClassStudentIds(new Set(activeSchedules.flatMap(s => s.student_ids || [])));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const isSuperAdmin = user?.role === "super_admin";

  // 담당 학생 필터링 — super_admin은 전체 또는 선택한 선생님 담당 학생, 일반 admin/teacher는 본인 담당 학생만
  const myStudents = useMemo(() => {
    if (!user) return [];
    if (isSuperAdmin) {
      if (selectedTeacherId === "all") return allStudents;
      if (selectedTeacherId === "unassigned")
        return allStudents.filter(s => !s.teacher_ids || s.teacher_ids.length === 0);
      return allStudents.filter(s => s.teacher_ids?.includes(selectedTeacherId));
    }
    // 일반 admin/teacher: 본인이 담당하는 학생만 — fallback 없음
    return allStudents.filter(s => s.teacher_ids?.includes(user.id));
  }, [allStudents, user, isSuperAdmin, selectedTeacherId]);

  const weeklyClassCount = useMemo(() => {
    return myStudents.filter(s => weeklyClassStudentIds.has(s.id)).length;
  }, [myStudents, weeklyClassStudentIds]);

  // super_admin용 담당 선생님별 학생 수
  const teacherCounts = useMemo(() => {
    if (!isSuperAdmin) return [];
    return teachers.map(t => ({
      ...t,
      count: allStudents.filter(s => s.teacher_ids?.includes(t.id)).length,
    }));
  }, [teachers, allStudents, isSuperAdmin]);

  const unassignedCount = useMemo(() => {
    if (!isSuperAdmin) return 0;
    return allStudents.filter(s => !s.teacher_ids || s.teacher_ids.length === 0).length;
  }, [allStudents, isSuperAdmin]);

  const cards = [
    { label: isSuperAdmin ? "재원 학생" : "내 담당 학생", value: myStudents.length, icon: Users, color: "bg-blue-100 text-blue-600" },
    { label: "이번주 수업 학생", value: weeklyClassCount, icon: CalendarCheck, color: "bg-green-100 text-green-600" },
  ];

  const roleName = isSuperAdmin ? "총 관리자" : "관리자";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">대시보드</h2>
        {user && <p className="text-gray-500 text-sm">{user.name} {roleName}님, 환영합니다.</p>}
      </div>

      {/* 담당 선생님별 보기 탭 (super_admin만) */}
      {isSuperAdmin && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setSelectedTeacherId("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedTeacherId === "all"
                ? "bg-violet-500 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            전체 {allStudents.length}
          </button>
          {teacherCounts.map(t => (
            <button key={t.id} onClick={() => setSelectedTeacherId(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedTeacherId === t.id
                  ? "bg-violet-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {t.name} ({t.count})
            </button>
          ))}
          {unassignedCount > 0 && (
            <button onClick={() => setSelectedTeacherId("unassigned")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedTeacherId === "unassigned"
                  ? "bg-gray-500 text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}>
              담당 미지정 ({unassignedCount})
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-sm text-gray-500">{c.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 담당 학생이 없는 경우 — fallback 없이 명확한 메시지 표시 */}
      {!loading && !isSuperAdmin && myStudents.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center mb-5">
          <UserCog className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">담당 학생이 없습니다.</p>
        </div>
      )}

      {/* 담당 학생 목록 */}
      {myStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {isSuperAdmin ? "학생 목록" : "내 담당 학생"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myStudents.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {s.name?.[0] || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {s.teacher_names?.length > 0 ? s.teacher_names.join(", ") : "담당 미지정"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <OnlineStudentsPanel />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">빠른 메뉴</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "학생 관리", icon: Users, href: "/admin/students" },
            { label: "과목 관리", icon: BookOpen, href: "/admin/subjects" },
            { label: "수업 캘린더", icon: Calendar, href: "/admin/calendar" },
            { label: "문제 관리", icon: Code2, href: "/admin/problems" },
          ].map(m => {
            const Icon = m.icon;
            return (
              <a key={m.label} href={m.href} className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-[#7c3aed]/5 border border-transparent hover:border-[#7c3aed]/20 transition-colors cursor-pointer">
                <Icon className="w-6 h-6 text-[#7c3aed]" />
                <span className="text-sm font-medium text-gray-700">{m.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}