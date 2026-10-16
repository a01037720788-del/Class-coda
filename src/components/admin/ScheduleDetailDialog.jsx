import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon, User, School, BookOpen, Clock,
  CheckCircle2, AlertTriangle, Link2, Loader2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { parseGoogleEventTitle } from "@/lib/googleEventParser";

const ATTENDANCE_OPTIONS = ["출석", "결석", "지각", "보강 예정", "취소", "미정"];

const ATTENDANCE_STYLES = {
  "출석": "bg-green-600 text-white border-green-600",
  "결석": "bg-black text-white border-black",
  "지각": "bg-yellow-500 text-white border-yellow-500",
  "보강 예정": "bg-blue-500 text-white border-blue-500",
  "취소": "bg-gray-500 text-white border-gray-500",
  "미정": "bg-gray-200 text-gray-600 border-gray-300",
};

export default function ScheduleDetailDialog({
  schedule,
  attendanceMap,
  onClose,
  onUpdated,
  students,
}) {
  const { toast } = useToast();
  const [cssRecords, setCssRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingStudent, setSavingStudent] = useState(null);
  const [showStudentLinker, setShowStudentLinker] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [linkingStudent, setLinkingStudent] = useState(false);

  useEffect(() => {
    if (schedule?.id) loadCssRecords();
  }, [schedule?.id]);

  const loadCssRecords = async () => {
    if (!schedule?.id) return;
    setLoading(true);
    try {
      const records = await base44.entities.ClassScheduleStudent.filter({ schedule_id: schedule.id });
      setCssRecords(records.filter(r => !r.is_deleted));
    } catch (e) {
      // 에러 무시
    } finally {
      setLoading(false);
    }
  };

  if (!schedule) return null;

  const parsed = schedule.parsed_info || parseGoogleEventTitle(schedule.google_original_title || schedule.title || "");
  const isGoogle = schedule.calendar_source === "google";
  const hasStudentLink = (schedule.student_ids || []).length > 0;

  // ClassScheduleStudent 기준 출석 상태
  const getAttendanceStatus = (studentId) => {
    const css = cssRecords.find(c => c.student_id === studentId);
    if (css) return css.attendance_status || "미정";
    // fallback: attendanceMap
    return attendanceMap?.[schedule.id]?.[studentId] || "미정";
  };

  const handleAttendanceChange = async (studentId, studentName, newStatus) => {
    setSavingStudent(studentId);
    try {
      const existing = cssRecords.find(c => c.student_id === studentId);
      if (existing) {
        // 기존 출석 상태 업데이트 (피드백/차시 정보는 유지)
        await base44.entities.ClassScheduleStudent.update(existing.id, {
          attendance_status: newStatus,
        });
      } else {
        // 새 ClassScheduleStudent 생성
        await base44.entities.ClassScheduleStudent.create({
          schedule_id: schedule.id,
          student_id: studentId,
          student_name: studentName,
          attendance_status: newStatus,
          feedback_completed: false,
          lesson_count_applied: false,
          is_deleted: false,
        });
      }
      toast({ title: "출석 상태 변경", description: `${studentName}: ${newStatus}`, duration: 1500 });
      await loadCssRecords();
      if (onUpdated) onUpdated();
    } catch (e) {
      toast({ title: "저장 실패", description: e?.message || "오류", variant: "destructive" });
    } finally {
      setSavingStudent(null);
    }
  };

  const handleManualLinkStudent = async (student) => {
    setLinkingStudent(true);
    try {
      const newStudentIds = [...(schedule.student_ids || []), student.id];
      const newStudentNames = [...(schedule.student_names || []), student.name];
      await base44.entities.ClassSchedule.update(schedule.id, {
        student_ids: newStudentIds,
        student_names: newStudentNames,
        student_link_source: "manual",
      });
      // ClassScheduleStudent도 생성
      const existing = cssRecords.find(c => c.student_id === student.id);
      if (!existing) {
        await base44.entities.ClassScheduleStudent.create({
          schedule_id: schedule.id,
          student_id: student.id,
          student_name: student.name,
          attendance_status: "미정",
          feedback_completed: false,
          lesson_count_applied: false,
          is_deleted: false,
        });
      }
      toast({ title: "학생 연결 완료", description: `${student.name} (수동 연결)`, duration: 1500 });
      setShowStudentLinker(false);
      setStudentSearch("");
      await loadCssRecords();
      if (onUpdated) onUpdated();
    } catch (e) {
      toast({ title: "연결 실패", description: e?.message || "오류", variant: "destructive" });
    } finally {
      setLinkingStudent(false);
    }
  };

  const handleUnlinkStudent = async (studentId, studentName) => {
    if (!confirm(`${studentName} 학생을 이 수업에서 제거하시겠습니까?`)) return;
    try {
      const newStudentIds = (schedule.student_ids || []).filter(id => id !== studentId);
      const newStudentNames = (schedule.student_names || []).filter((_, i) => schedule.student_ids?.[i] !== studentId);
      await base44.entities.ClassSchedule.update(schedule.id, {
        student_ids: newStudentIds,
        student_names: newStudentNames,
      });
      // ClassScheduleStudent는 is_deleted 처리 (출석 기록 보존)
      const existing = cssRecords.find(c => c.student_id === studentId);
      if (existing) {
        await base44.entities.ClassScheduleStudent.update(existing.id, {
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        });
      }
      toast({ title: "학생 제거", description: `${studentName} 제거됨`, duration: 1500 });
      await loadCssRecords();
      if (onUpdated) onUpdated();
    } catch (e) {
      toast({ title: "제거 실패", description: e?.message || "오류", variant: "destructive" });
    }
  };

  // 학생 검색 결과
  const filteredStudents = (students || []).filter(s => {
    if (!studentSearch.trim()) return false;
    const q = studentSearch.toLowerCase().trim();
    return s.name?.toLowerCase().includes(q) || s.school_name?.toLowerCase().includes(q);
  }).slice(0, 10);

  return (
    <Dialog open={!!schedule} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            수업 상세
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {isGoogle && (
                <Badge className="bg-blue-50 text-blue-600 border-0 text-[10px] gap-0.5">
                  <CalendarIcon className="w-2.5 h-2.5" />Google
                </Badge>
              )}
              {schedule.start_time && (
                <Badge className="bg-blue-50 text-blue-600 border-0 text-[10px] font-mono">
                  <Clock className="w-2.5 h-2.5 mr-0.5" />{schedule.start_time}{schedule.end_time ? `~${schedule.end_time}` : ""}
                </Badge>
              )}
              <Badge className="bg-gray-100 text-gray-600 border-0 text-[10px]">{schedule.class_date}</Badge>
              <Badge className="bg-purple-50 text-purple-600 border-0 text-[10px]">{schedule.subject_name || "미지정"}</Badge>
              {schedule.teacher_name && (
                <Badge className="bg-gray-100 text-gray-500 border-0 text-[10px]">{schedule.teacher_name}</Badge>
              )}
            </div>

            {/* Google 원본 제목 */}
            {isGoogle && (schedule.google_original_title || schedule.title) && (
              <div>
                <p className="text-[10px] text-gray-400 font-medium">Google 원본 제목</p>
                <p className="text-xs font-mono text-gray-600 bg-white px-2 py-1 rounded border border-gray-100">
                  {schedule.google_original_title || schedule.title}
                </p>
              </div>
            )}

            {/* 파싱 결과 */}
            {isGoogle && parsed && (parsed.student_name || parsed.school || parsed.subject_code) && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {parsed.student_name && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400">학생:</span>
                    <span className="text-gray-700 font-medium">{parsed.student_name}</span>
                  </div>
                )}
                {parsed.school && (
                  <div className="flex items-center gap-1">
                    <School className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400">학교:</span>
                    <span className="text-gray-700">{parsed.school}</span>
                  </div>
                )}
                {parsed.grade && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">학년:</span>
                    <span className="text-gray-700">{parsed.grade}</span>
                  </div>
                )}
                {parsed.week_or_level && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">주차:</span>
                    <span className="text-gray-700">{parsed.week_or_level}</span>
                  </div>
                )}
                {parsed.subject_code && (
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-400">과목코드:</span>
                    <span className="text-gray-700">{parsed.subject_code} → {parsed.subject_name || schedule.subject_name}</span>
                  </div>
                )}
              </div>
            )}

            {schedule.description && (
              <div>
                <p className="text-[10px] text-gray-400 font-medium">설명</p>
                <p className="text-xs text-gray-600">{schedule.description}</p>
              </div>
            )}
            {schedule.location && (
              <div>
                <p className="text-[10px] text-gray-400 font-medium">장소</p>
                <p className="text-xs text-gray-600">{schedule.location}</p>
              </div>
            )}
          </div>

          {/* 출석 관리 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-800">학생 출석 관리</h4>
              {isGoogle && (
                <Button size="sm" variant="outline" onClick={() => setShowStudentLinker(!showStudentLinker)}
                  className="text-xs h-7 gap-1">
                  <Link2 className="w-3 h-3" />
                  {showStudentLinker ? "취소" : "학생 수동 연결"}
                </Button>
              )}
            </div>

            {/* 학생 수동 연결 UI */}
            {showStudentLinker && (
              <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="학생 이름 또는 학교로 검색..."
                  className="w-full text-sm px-3 py-2 rounded-md border border-amber-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  autoFocus
                />
                {filteredStudents.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {filteredStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleManualLinkStudent(s)}
                        disabled={linkingStudent}
                        className="w-full flex items-center justify-between p-2 bg-white rounded-md border border-gray-100 hover:border-amber-300 text-left text-xs"
                      >
                        <div>
                          <span className="font-medium text-gray-800">{s.name}</span>
                          <span className="text-gray-400 ml-2">{s.school_name || ""} {s.grade || ""}</span>
                        </div>
                        {linkingStudent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3 text-amber-500" />}
                      </button>
                    ))}
                  </div>
                )}
                {studentSearch.trim() && filteredStudents.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2">검색 결과 없음</p>
                )}
              </div>
            )}

            {/* 학생별 출석 관리 */}
            {loading ? (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />불러오는 중...
              </div>
            ) : hasStudentLink ? (
              <div className="space-y-2">
                {(schedule.student_ids || []).map((studentId, i) => {
                  const studentName = schedule.student_names?.[i] || "";
                  const status = getAttendanceStatus(studentId);
                  return (
                    <div key={studentId} className="p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm">{studentName}</span>
                          <Badge className={`text-[10px] border-0 ${status === "결석" ? "bg-black text-white" : status === "출석" ? "bg-green-100 text-green-700" : status === "지각" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                            {status}
                          </Badge>
                        </div>
                        {isGoogle && (
                          <button
                            onClick={() => handleUnlinkStudent(studentId, studentName)}
                            className="text-xs text-gray-400 hover:text-red-500"
                          >
                            제거
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {ATTENDANCE_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            onClick={() => handleAttendanceChange(studentId, studentName, opt)}
                            disabled={savingStudent === studentId}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              status === opt
                                ? ATTENDANCE_STYLES[opt]
                                : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                            }`}
                          >
                            {savingStudent === studentId && <Loader2 className="w-2.5 h-2.5 animate-spin inline mr-1" />}
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-sm text-amber-700 font-medium">학생 연결 필요</p>
                <p className="text-xs text-amber-600 mt-1">
                  {isGoogle
                    ? "Google 일정에서 학생을 자동 연결하지 못했습니다. 위 '학생 수동 연결' 버튼으로 학생을 연결해주세요."
                    : "이 수업에 연결된 학생이 없습니다."}
                </p>
              </div>
            )}
          </div>

          {/* 연결 상태 표시 */}
          <div className="flex items-center gap-2 text-xs">
            {schedule.student_link_source === "manual" ? (
              <Badge className="bg-indigo-50 text-indigo-600 border-0 text-[10px] gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />수동 연결 (재동기화 시 유지)
              </Badge>
            ) : isGoogle && hasStudentLink ? (
              <Badge className="bg-green-50 text-green-600 border-0 text-[10px] gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />자동 연결
              </Badge>
            ) : isGoogle ? (
              <Badge className="bg-amber-50 text-amber-600 border-0 text-[10px] gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />연결 확인 필요
              </Badge>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}