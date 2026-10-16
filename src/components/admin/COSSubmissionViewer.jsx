import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ChevronDown, ChevronUp, RefreshCw, CheckCircle, X, Users, User, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "pending", label: "⏳ 검토 대기" },
  { value: "correct", label: "✅ 맞음" },
  { value: "incorrect", label: "❌ 틀림" },
];

const VIEW_MODES = [
  { value: "list", label: "전체 목록" },
  { value: "by_student", label: "학생별" },
  { value: "by_teacher", label: "선생님별" },
];

export default function COSSubmissionViewer({ units, problems }) {
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStudent, setFilterStudent] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterProblem, setFilterProblem] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [manualComment, setManualComment] = useState({});
  const [saving, setSaving] = useState(null);
  const [regrading, setRegrading] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [subs, studs] = await Promise.all([
      base44.entities.COSSubmission.list("-submitted_at", 1000),
      base44.entities.Student.filter({ is_active: true }, "name"),
    ]);
    const problemIds = new Set(problems.map(p => p.id));
    setSubmissions(subs.filter(s => problemIds.has(s.problem_id)));
    setStudents(studs);
    setLoading(false);
  };

  const loadSubmissions = loadAll;

  // 선생님 목록 (학생 데이터 기반)
  const allTeachers = useMemo(() => {
    const names = new Set();
    students.forEach(s => (s.teacher_names || []).forEach(n => names.add(n)));
    return [...names].sort();
  }, [students]);

  // studentId → teacher_names 맵
  const studentTeacherMap = useMemo(() => {
    const map = {};
    students.forEach(s => { map[s.id] = s.teacher_names || []; });
    return map;
  }, [students]);

  const getStatus = (sub) => {
    if (sub?.grading_result?.pending && !sub?.reviewed_by_admin) return "pending";
    const s = sub?.grading_result?.status;
    if (s === "correct") return "correct";
    if (s === "incorrect") return "incorrect";
    if (sub?.is_correct === true) return "correct";
    if (sub?.is_correct === false) return "incorrect";
    return "pending";
  };

  const getProblemUnitId = (problemId) => problems.find(p => p.id === problemId)?.unit_id || null;

  const filtered = submissions.filter(sub => {
    if (filterStudent && !sub.student_name?.includes(filterStudent)) return false;
    if (filterTeacher !== "all") {
      const teacherNames = studentTeacherMap[sub.student_id] || [];
      if (!teacherNames.includes(filterTeacher)) return false;
    }
    if (filterUnit !== "all") {
      const unitId = getProblemUnitId(sub.problem_id);
      if (unitId !== filterUnit) return false;
    }
    if (filterProblem !== "all" && sub.problem_id !== filterProblem) return false;
    if (filterStatus !== "all" && getStatus(sub) !== filterStatus) return false;
    return true;
  });

  // 학생별 그룹
  const groupedByStudent = useMemo(() => {
    const map = {};
    filtered.forEach(sub => {
      const key = sub.student_id;
      if (!map[key]) map[key] = { student_id: sub.student_id, student_name: sub.student_name, subs: [] };
      map[key].subs.push(sub);
    });
    return Object.values(map).sort((a, b) => a.student_name?.localeCompare(b.student_name, "ko"));
  }, [filtered]);

  // 선생님별 그룹
  const groupedByTeacher = useMemo(() => {
    const map = {};
    filtered.forEach(sub => {
      const teacherNames = studentTeacherMap[sub.student_id] || ["미배정"];
      teacherNames.forEach(t => {
        if (!map[t]) map[t] = { teacher_name: t, subs: [] };
        if (!map[t].subs.find(s => s.id === sub.id)) map[t].subs.push(sub);
      });
    });
    return Object.values(map).sort((a, b) => a.teacher_name?.localeCompare(b.teacher_name, "ko"));
  }, [filtered, studentTeacherMap]);

  // 학생 상세 뷰
  const studentSubs = selectedStudent
    ? submissions.filter(s => s.student_id === selectedStudent.student_id)
    : [];

  const correct = studentSubs.filter(s => getStatus(s) === "correct").length;
  const incorrect = studentSubs.filter(s => getStatus(s) === "incorrect").length;

  const handleManualGrade = async (sub, isCorrect) => {
    setSaving(sub.id);
    const comment = manualComment[sub.id] || "";
    await base44.entities.COSSubmission.update(sub.id, {
      is_correct: isCorrect,
      reviewed_by_admin: true,
      is_checked: true,
      grading_result: {
        ...(sub.grading_result || {}),
        status: isCorrect ? "correct" : "incorrect",
        admin_comment: comment,
        admin_reviewed: true,
      },
    });
    toast({ title: isCorrect ? "✅ 맞음 처리 완료" : "❌ 틀림 처리 완료" });
    setSaving(null);
    loadSubmissions();
  };

  const handleAiRegrade = async (sub) => {
    const problem = problems.find(p => p.id === sub.problem_id);
    setRegrading(sub.id);
    try {
      const response = await base44.functions.invoke("gradeCosSb3", {
        submission_file_url: sub.submitted_file_url,
        answer_file_url: problem?.answer_file_url,
        grading_mode: problem?.grading_mode || "ai",
        problem_title: sub.problem_title,
        problem_description: problem?.description,
      });
      const result = response.data;
      await base44.entities.COSSubmission.update(sub.id, {
        is_correct: result.is_correct,
        reviewed_by_admin: true,
        is_checked: true,
        grading_result: {
          ...(result.grading_result || {}),
          admin_reviewed: true,
        },
      });
      toast({ title: result.is_correct ? "✅ AI 채점: 맞음" : "❌ AI 채점: 틀림" });
      loadSubmissions();
    } catch (err) {
      toast({ title: "AI 채점 실패", description: err?.message, variant: "destructive" });
    } finally {
      setRegrading(null);
    }
  };

  const statusBadge = (sub) => {
    if (sub?.grading_result?.pending && !sub?.reviewed_by_admin) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">검토 대기</span>;
    }
    const s = getStatus(sub);
    if (s === "correct") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">맞음</span>;
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">틀림</span>;
  };

  const SubmissionRow = ({ sub }) => {
    const expanded = expandedId === sub.id;
    const problem = problems.find(p => p.id === sub.problem_id);
    const unit = units.find(u => u.id === problem?.unit_id);
    const isReviewed = sub.reviewed_by_admin || sub.is_checked;

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer gap-3"
          onClick={() => setExpandedId(expanded ? null : sub.id)}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              className="text-blue-600 hover:underline text-sm font-bold flex-shrink-0"
              onClick={e => { e.stopPropagation(); setSelectedStudent({ student_id: sub.student_id, student_name: sub.student_name }); }}
            >
              {sub.student_name}
            </button>
            <span className="text-xs text-gray-400 hidden sm:block">{unit?.title || "미분류"}</span>
            <span className="text-xs text-gray-600 truncate">{sub.problem_title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {statusBadge(sub)}
            {isReviewed && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">확인됨</span>}
            <span className="text-[10px] text-gray-400 hidden sm:block">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString("ko-KR") : ""}</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>

        {expanded && (
          <div className="p-4 border-t border-gray-100 space-y-4 bg-gray-50">
            {/* 파일 링크 + 채점 모드 */}
            <div className="flex flex-wrap gap-2 items-center">
              {sub.submitted_file_url && (
                <a href={sub.submitted_file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                  <Download className="w-3 h-3" />제출 파일
                </a>
              )}
              {problem?.answer_file_url && (
                <a href={problem.answer_file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100">
                  <Download className="w-3 h-3" />정답 파일
                </a>
              )}
              {sub.grading_result?.grading_mode && (
                <span className="text-[10px] text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded">
                  {sub.grading_result.grading_mode === "ai" ? "🤖 AI 채점" : sub.grading_result.grading_mode === "structure" ? "📊 구조 비교" : "👨‍🏫 수동 채점"}
                </span>
              )}
              {sub.grading_result?.score !== undefined && (
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded">
                  {sub.grading_result.score}점
                </span>
              )}
              <span className="text-xs text-gray-400 self-center">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleString("ko-KR") : ""}</span>
            </div>

            {/* AI 점수 세부 */}
            {sub.grading_result?.score_breakdown && Object.keys(sub.grading_result.score_breakdown).length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">AI 채점 세부 점수</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: "events", label: "이벤트" },
                    { key: "motion", label: "동작" },
                    { key: "loops", label: "반복문" },
                    { key: "variables", label: "변수" },
                    { key: "goal", label: "목표 달성" },
                  ].map(({ key, label }) => {
                    const val = sub.grading_result.score_breakdown[key] ?? 0;
                    return (
                      <div key={key} className="text-center">
                        <p className={`text-base font-bold ${val >= 20 ? "text-green-600" : val >= 10 ? "text-orange-500" : "text-red-400"}`}>{val}</p>
                        <p className="text-[10px] text-gray-400">{label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 구조 비교 diff */}
            {sub.grading_result?.grading_mode === "structure" && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600">📊 구조 비교 결과</p>
                {sub.grading_result.differences && sub.grading_result.differences.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[10px] text-red-500 font-semibold">다른 부분 ({sub.grading_result.differences.length}건)</p>
                    {sub.grading_result.differences.map((d, i) => (
                      <p key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 flex items-start gap-1.5">
                        <span className="mt-0.5">✗</span>{d}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-green-600">구조 완전 일치 ✅</p>
                )}
                {sub.grading_result.ignored_differences && sub.grading_result.ignored_differences.length > 0 && (
                  <details className="cursor-pointer">
                    <summary className="text-[10px] text-gray-400 select-none">무시된 차이 ({sub.grading_result.ignored_differences.length}건)</summary>
                    <div className="mt-1 space-y-1">
                      {sub.grading_result.ignored_differences.map((d, i) => (
                        <p key={i} className="text-[10px] text-gray-400 bg-gray-50 rounded px-2 py-0.5">{d}</p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* AI/일반 피드백 */}
            {sub.grading_result?.feedback && sub.grading_result.feedback.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">채점 피드백</p>
                <div className="space-y-1">
                  {sub.grading_result.feedback.map((fb, i) => (
                    <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="text-blue-400 mt-0.5">•</span>{fb}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* AI 재채점 버튼 */}
            {sub.submitted_file_url && (
              <Button size="sm" variant="outline" onClick={() => handleAiRegrade(sub)}
                disabled={regrading === sub.id}
                className="gap-1.5 text-xs h-8 border-purple-300 text-purple-600 hover:bg-purple-50">
                <Zap className="w-3.5 h-3.5" />
                {regrading === sub.id ? "AI 재채점 중..." : "🤖 AI 재채점"}
              </Button>
            )}

            {/* 관리자 수동 확인 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">관리자 수동 처리</p>
              <Input
                placeholder="코멘트 입력 (선택)"
                value={manualComment[sub.id] || ""}
                onChange={e => setManualComment(m => ({ ...m, [sub.id]: e.target.value }))}
                className="text-xs h-8"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleManualGrade(sub, true)} disabled={saving === sub.id}
                  className="bg-green-600 hover:bg-green-700 text-xs gap-1 h-8">
                  <CheckCircle className="w-3.5 h-3.5" />맞음 처리
                </Button>
                <Button size="sm" onClick={() => handleManualGrade(sub, false)} disabled={saving === sub.id}
                  variant="destructive" className="text-xs gap-1 h-8">
                  <X className="w-3.5 h-3.5" />틀림 처리
                </Button>
                {saving === sub.id && <span className="text-xs text-gray-400 self-center">저장 중...</span>}
              </div>
              {sub.grading_result?.admin_comment && (
                <p className="text-[11px] text-gray-500">이전 코멘트: {sub.grading_result.admin_comment}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 학생 상세 뷰
  if (selectedStudent) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedStudent(null)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          ← 목록으로
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="font-bold text-gray-900 text-lg mb-3">{selectedStudent.student_name} 제출 기록</h4>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "총 제출", val: studentSubs.length, cls: "bg-gray-50 text-gray-700" },
              { label: "맞은 문제", val: correct, cls: "bg-green-50 text-green-700" },
              { label: "틀린 문제", val: incorrect, cls: "bg-red-50 text-red-700" },
            ].map(({ label, val, cls }) => (
              <div key={label} className={`rounded-lg p-3 text-center ${cls}`}>
                <p className="text-2xl font-bold">{val}</p>
                <p className="text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {studentSubs.map(sub => <SubmissionRow key={sub.id} sub={sub} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-bold text-gray-800">제출 관리 ({filtered.length}건)</h4>
        <Button size="sm" variant="outline" onClick={loadSubmissions} className="gap-1.5 text-xs h-8">
          <RefreshCw className="w-3.5 h-3.5" />새로고침
        </Button>
      </div>

      {/* 뷰 모드 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {VIEW_MODES.map(m => (
          <button key={m.value} onClick={() => setViewMode(m.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === m.value ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="학생 이름 검색"
          value={filterStudent}
          onChange={e => setFilterStudent(e.target.value)}
          className="h-8 text-xs w-36"
        />
        <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">선생님 전체</option>
          {allTeachers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setFilterProblem("all"); }}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">전체 Unit</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
        </select>
        <select value={filterProblem} onChange={e => setFilterProblem(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="all">전체 문제</option>
          {problems
            .filter(p => filterUnit === "all" || p.unit_id === filterUnit)
            .map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
          해당하는 제출이 없습니다.
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {filtered.map(sub => <SubmissionRow key={sub.id} sub={sub} />)}
        </div>
      ) : viewMode === "by_student" ? (
        <div className="space-y-3">
          {groupedByStudent.map(group => {
            const correctCnt = group.subs.filter(s => getStatus(s) === "correct").length;
            return (
              <StudentGroupCard
                key={group.student_id}
                title={group.student_name}
                icon={<User className="w-4 h-4" />}
                subs={group.subs}
                correctCnt={correctCnt}
                onStudentClick={() => setSelectedStudent({ student_id: group.student_id, student_name: group.student_name })}
                SubmissionRow={SubmissionRow}
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByTeacher.map(group => {
            const correctCnt = group.subs.filter(s => getStatus(s) === "correct").length;
            const studentNames = [...new Set(group.subs.map(s => s.student_name))];
            return (
              <StudentGroupCard
                key={group.teacher_name}
                title={`${group.teacher_name} 선생님`}
                subtitle={`담당 학생 ${studentNames.length}명`}
                icon={<Users className="w-4 h-4" />}
                subs={group.subs}
                correctCnt={correctCnt}
                onStudentClick={null}
                SubmissionRow={SubmissionRow}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentGroupCard({ title, subtitle, icon, subs, correctCnt, onStudentClick, SubmissionRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <span className="font-semibold text-gray-900">{title}</span>
          {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
          <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{subs.length}건</span>
          <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">맞음 {correctCnt}</span>
          <span className="text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">틀림 {subs.length - correctCnt}</span>
        </div>
        <div className="flex items-center gap-2">
          {onStudentClick && (
            <button className="text-xs text-blue-600 hover:underline px-2 py-1 rounded"
              onClick={e => { e.stopPropagation(); onStudentClick(); }}>
              상세보기
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      {open && (
        <div className="divide-y divide-gray-100">
          {subs.map(sub => <SubmissionRow key={sub.id} sub={sub} />)}
        </div>
      )}
    </div>
  );
}