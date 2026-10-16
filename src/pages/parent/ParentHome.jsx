import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ko } from "date-fns/locale";
import {
  BookOpen, Calendar, MessageSquare, AlertCircle,
  CheckCircle2, CreditCard, Clock, ChevronRight
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color = "blue", alert = false }) {
  const colors = {
    blue:   { bg: "bg-blue-50",   border: "border-blue-100",   icon: "text-blue-500",   val: "text-blue-700" },
    green:  { bg: "bg-green-50",  border: "border-green-100",  icon: "text-green-500",  val: "text-green-700" },
    amber:  { bg: "bg-amber-50",  border: "border-amber-100",  icon: "text-amber-500",  val: "text-amber-700" },
    red:    { bg: "bg-red-50",    border: "border-red-100",    icon: "text-red-500",    val: "text-red-700" },
    purple: { bg: "bg-purple-50", border: "border-purple-100", icon: "text-purple-500", val: "text-purple-700" },
  };
  const c = colors[alert ? "red" : color];
  return (
    <div className={`rounded-xl p-4 border ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${c.icon}`} />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${c.val}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ParentHome() {
  const { session } = useOutletContext();
  const [children, setChildren] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState(null);

  useEffect(() => {
    if (session?.linked_student_ids?.length > 0) {
      loadData(session.linked_student_ids);
    } else {
      setLoading(false);
    }
  }, [session]);

  const loadData = async (studentIds) => {
    const [students, allEnrollments, allFeedbacks, allSchedules] = await Promise.all([
      base44.entities.Student.list(),
      base44.entities.Enrollment.list(),
      base44.entities.LessonFeedback.list("-class_date", 200),
      base44.entities.ClassSchedule.list("class_date", 500),
    ]);
    const myChildren = students.filter(s => studentIds.includes(s.id));
    setChildren(myChildren);
    setSelectedChild(myChildren[0]?.id || null);
    setEnrollments(allEnrollments.filter(e => studentIds.includes(e.student_id)));
    setFeedbacks(allFeedbacks.filter(f => studentIds.includes(f.student_id) && f.is_deleted !== true));
    setSchedules(allSchedules.filter(s => s.student_ids?.some(id => studentIds.includes(id)) && s.is_deleted !== true));
    setLoading(false);
  };

  const child = children.find(c => c.id === selectedChild);
  const childEnrollments = enrollments.filter(e => e.student_id === selectedChild);
  const childFeedbacks = feedbacks.filter(f => f.student_id === selectedChild)
    .sort((a, b) => b.class_date?.localeCompare(a.class_date));
  const latestFeedback = childFeedbacks[0];

  const today = startOfDay(new Date());
  const nextSchedule = schedules
    .filter(s => s.student_ids?.includes(selectedChild) && s.class_date)
    .filter(s => !isBefore(parseISO(s.class_date), today))
    .sort((a, b) => a.class_date.localeCompare(b.class_date))[0];

  const recentSchedule = schedules
    .filter(s => s.student_ids?.includes(selectedChild) && s.class_date)
    .filter(s => isBefore(parseISO(s.class_date), today))
    .sort((a, b) => b.class_date.localeCompare(a.class_date))[0];

  const totalPaid = childEnrollments.reduce((s, e) => s + (e.paid_lessons || 0), 0);
  const totalRemaining = childEnrollments.reduce((s, e) => s + (e.remaining_lessons ?? (e.paid_lessons - e.completed_lessons) ?? 0), 0);
  const needRepay = childEnrollments.some(e => e.repayment_needed || (e.remaining_lessons ?? (e.paid_lessons - e.completed_lessons)) <= 0);

  if (loading) return <div className="p-6 text-center text-gray-400">불러오는 중...</div>;

  if (!session?.linked_student_ids?.length || children.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="bg-white rounded-xl border border-gray-200 p-12">
          <p className="text-gray-400">연결된 자녀가 없습니다. 관리자에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* 인사 헤더 */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">안녕하세요, {session?.name}님 👋</h2>
        <p className="text-gray-500 text-sm mt-0.5">자녀의 학습 현황을 확인하세요.</p>
      </div>

      {/* 자녀 탭 */}
      {children.length > 1 && (
        <div className="flex gap-2">
          {children.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedChild(c.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedChild === c.id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {child && (
        <>
          {/* 학생 정보 */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center shadow">
              <span className="text-white font-bold text-lg">{child.name[0]}</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{child.name}</p>
              {child.grade && <p className="text-sm text-gray-500">{child.grade}</p>}
              {child.school_name && <p className="text-xs text-gray-400">{child.school_name}</p>}
            </div>
            {needRepay && (
              <div className="ml-auto flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-full">
                <AlertCircle className="w-3.5 h-3.5" />
                재결제 필요
              </div>
            )}
          </div>

          {/* 핵심 통계 카드 4개 */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={CreditCard} label="결제 차시" value={`${totalPaid}회`} color="blue" />
            <StatCard icon={CheckCircle2} label="수업 완료" value={`${childEnrollments.reduce((s, e) => s + (e.completed_lessons || 0), 0)}회`} color="green" />
            <StatCard icon={Clock} label="남은 차시" value={`${totalRemaining}회`} color={totalRemaining <= 0 ? "red" : "purple"} alert={totalRemaining <= 0} />
            <StatCard icon={BookOpen} label="수강 과목" value={`${childEnrollments.length}개`} color="amber" />
          </div>

          {/* 다음 수업 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-bold text-gray-800">다음 수업</span>
            </div>
            {nextSchedule ? (
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {format(parseISO(nextSchedule.class_date), "M월 d일 (eee)", { locale: ko })}
                    {nextSchedule.start_time && ` ${nextSchedule.start_time}`}
                  </p>
                  <p className="text-sm text-blue-600 mt-0.5">{nextSchedule.subject_name}</p>
                  {nextSchedule.teacher_name && (
                    <p className="text-xs text-gray-400 mt-0.5">{nextSchedule.teacher_name} 선생님</p>
                  )}
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded-full font-medium">
                  {nextSchedule.duration_type === "2hour" ? "2시간" : "1시간"}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">예정된 수업이 없습니다.</p>
            )}
          </div>

          {/* 최근 수업 */}
          {recentSchedule && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-bold text-gray-800">최근 수업</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {format(parseISO(recentSchedule.class_date), "M월 d일 (eee)", { locale: ko })}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{recentSchedule.subject_name}</p>
              </div>
            </div>
          )}

          {/* 최근 피드백 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-gray-800">최근 수업 피드백</span>
            </div>
            {latestFeedback ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{latestFeedback.class_date}</span>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{latestFeedback.subject_name}</span>
                </div>
                {latestFeedback.parent_memo && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-600 mb-1">📌 학부모 메모</p>
                    <p className="text-sm text-gray-800">{latestFeedback.parent_memo}</p>
                  </div>
                )}
                {latestFeedback.learned_content && (
                  <p className="text-sm text-gray-700">
                    <span className="text-xs text-gray-400 font-medium">오늘 배운 내용</span><br />
                    {latestFeedback.learned_content}
                  </p>
                )}
                {latestFeedback.homework && (
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">📝 숙제</p>
                    <p className="text-sm text-gray-800">{latestFeedback.homework}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">아직 피드백이 없습니다.</p>
            )}
          </div>

          {/* 과목별 차시 현황 */}
          {childEnrollments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-bold text-gray-800">과목별 차시 현황</span>
              </div>
              <div className="space-y-3">
                {childEnrollments.map(e => {
                  const paid = e.paid_lessons || 0;
                  const completed = e.completed_lessons || 0;
                  const remaining = e.remaining_lessons ?? (paid - completed);
                  const pct = paid > 0 ? Math.min(100, Math.round((completed / paid) * 100)) : 0;
                  const isAlert = remaining <= 0 && paid > 0;
                  return (
                    <div key={e.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800">{e.subject_name}</span>
                        <div className="flex items-center gap-2">
                          {isAlert && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">재결제</span>
                          )}
                          <span className={`text-xs font-semibold ${isAlert ? "text-red-600" : "text-gray-600"}`}>
                            {completed}/{paid}회
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isAlert ? "bg-red-400" : "bg-indigo-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className={`text-xs mt-0.5 ${isAlert ? "text-red-500" : "text-gray-400"}`}>
                        남은 차시 {remaining}회
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}