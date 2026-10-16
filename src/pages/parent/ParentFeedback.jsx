import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { MessageSquare, ChevronDown, ChevronUp, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AttendanceBadge from "@/components/common/AttendanceBadge";

export default function ParentFeedback() {
  const { session } = useOutletContext();
  const [feedbacks, setFeedbacks] = useState([]);
  const [children, setChildren] = useState([]);
  const [expanded, setExpanded] = useState(null);
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
    const students = await base44.entities.Student.list();
    const allFeedbacks = await base44.entities.LessonFeedback.list("-class_date", 300);
    setChildren(students.filter(s => studentIds.includes(s.id)));
    setFeedbacks(allFeedbacks.filter(f => studentIds.includes(f.student_id) && !f.is_deleted));
    setLoading(false);
  };

  const filtered = feedbacks.filter(f => filterChild === "all" || f.student_id === filterChild);

  if (loading) return <div className="p-6 text-center text-gray-400">불러오는 중...</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">자녀 피드백</h2>
        <p className="text-gray-500 text-sm mt-1">선생님이 작성한 수업 피드백입니다. (최신순)</p>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setFilterChild("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterChild === "all" ? "bg-pink-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >전체</button>
          {children.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterChild(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterChild === c.id ? "bg-pink-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}
            >{c.name}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">아직 작성된 피드백이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => {
            const isOpen = expanded === fb.id;
            return (
              <div key={fb.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div
                  onClick={() => setExpanded(isOpen ? null : fb.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{fb.student_name}</span>
                      <Badge variant="outline" className="text-xs">{fb.subject_name}</Badge>
                      {fb.attendance_status && <AttendanceBadge status={fb.attendance_status} />}
                      {fb.parent_memo && (
                        <Badge className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 gap-1">
                          <Pin className="w-2.5 h-2.5" />학부모 메모
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {fb.class_date}{fb.teacher_name ? ` · ${fb.teacher_name} 선생님` : ""}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {fb.parent_memo && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Pin className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700">학부모 전달 메모</span>
                        </div>
                        <p className="text-sm text-gray-800">{fb.parent_memo}</p>
                      </div>
                    )}
                    {[
                      { key: "learned_content", label: "오늘 배운 내용" },
                      { key: "attitude", label: "학생 수업 태도" },
                      { key: "difficult_part", label: "어려워한 부분" },
                      { key: "homework", label: "숙제" },
                      { key: "next_plan", label: "다음 수업 계획" },
                    ].map(({ key, label }) => fb[key] && (
                      <div key={key} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                        <p className="text-sm text-gray-800">{fb[key]}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}