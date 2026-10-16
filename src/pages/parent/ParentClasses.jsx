import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar, Clock, User, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AttendanceBadge from "@/components/common/AttendanceBadge";

export default function ParentClasses() {
  const { session } = useOutletContext();
  const [schedules, setSchedules] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [children, setChildren] = useState([]);
  const [filterChild, setFilterChild] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.linked_student_ids?.length > 0) {
      loadData(session.linked_student_ids);
    } else {
      setLoading(false);
    }
  }, [session]);

  const loadData = async (studentIds) => {
    const [allStudents, allSchedules, allFbs] = await Promise.all([
      base44.entities.Student.list(),
      base44.entities.ClassSchedule.list("-class_date", 500),
      base44.entities.LessonFeedback.list("-class_date", 500),
    ]);
    setChildren(allStudents.filter(s => studentIds.includes(s.id)));
    const filtered = allSchedules.filter(s => s.student_ids?.some(id => studentIds.includes(id)) && s.is_deleted !== true);
    // 최신순 정렬
    filtered.sort((a, b) => b.class_date.localeCompare(a.class_date));
    setSchedules(filtered);
    setFeedbacks(allFbs.filter(f => studentIds.includes(f.student_id) && !f.is_deleted));
    setLoading(false);
  };

  const filtered = schedules.filter(s =>
    filterChild === "all" ? true : s.student_ids?.includes(filterChild)
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcoming = filtered.filter(s => s.class_date >= todayStr).sort((a, b) => a.class_date.localeCompare(b.class_date));
  const past = filtered.filter(s => s.class_date < todayStr); // loadData에서 이미 최신순 정렬됨

  const getChildNames = (s) =>
    (s.student_ids || [])
      .filter(id => children.some(c => c.id === id))
      .map(id => children.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");

  if (loading) return <div className="p-6 text-center text-gray-400">불러오는 중...</div>;

  const getFeedback = (scheduleId, studentId) =>
    feedbacks.find(f => f.schedule_id === scheduleId && f.student_id === studentId);

  const ScheduleCard = ({ s }) => {
    const childNames = getChildNames(s);
    const durationLabel = s.duration_type === "2hour" ? "2시간" : "1시간";
    const isPast = s.class_date < todayStr;
    // 이 수업에 연관된 자녀 ID
    const linkedChildIds = (s.student_ids || []).filter(id => children.some(c => c.id === id));
    const hasFeedback = linkedChildIds.some(id => getFeedback(s.id, id));
    const fb = linkedChildIds.map(id => getFeedback(s.id, id)).find(Boolean);

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-semibold text-gray-900">{s.subject_name}</span>
              {isPast && (
                hasFeedback ? (
                  <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100 gap-1 border-0">
                    <CheckCircle className="w-2.5 h-2.5" />피드백 완료
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-gray-400 gap-1">
                    <Clock className="w-2.5 h-2.5" />피드백 미작성
                  </Badge>
                )
              )}
              {fb?.attendance_status && <AttendanceBadge status={fb.attendance_status} />}
            </div>
            {childNames && (
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <User className="w-3 h-3" />{childNames}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {format(parseISO(s.class_date), "yyyy-MM-dd (eee)", { locale: ko })}
              </span>
              {s.start_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  {s.start_time} ({durationLabel})
                </span>
              )}
            </div>
            {s.teacher_name && (
              <p className="text-xs text-gray-400 mt-1">{s.teacher_name} 선생님</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">수업 일정</h2>
        <p className="text-gray-500 text-sm mt-1">자녀의 수업 일정입니다.</p>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setFilterChild("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterChild === "all" ? "bg-pink-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >전체</button>
          {children.map(c => (
            <button key={c.id} onClick={() => setFilterChild(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterChild === c.id ? "bg-pink-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}
            >{c.name}</button>
          ))}
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />
          예정 수업 ({upcoming.length}개)
        </h3>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">예정된 수업이 없습니다.</div>
        ) : (
          <div className="space-y-3">{upcoming.map(s => <ScheduleCard key={s.id} s={s} />)}</div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full inline-block" />
            지난 수업 ({past.length}개)
          </h3>
          <div className="space-y-3">
            {past.map(s => <ScheduleCard key={s.id} s={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}