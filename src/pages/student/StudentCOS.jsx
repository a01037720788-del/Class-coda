import React, { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Upload, File, CheckCircle, Send, BookOpen, X, Download, ArrowLeft, Layers, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const LEVEL_COLOR = {
  기초: "bg-gray-100 text-gray-600", 초급: "bg-blue-100 text-blue-700",
  중급: "bg-orange-100 text-orange-700", 고급: "bg-red-100 text-red-700",
};

export default function StudentCOS() {
  const { studentData } = useOutletContext();
  const [units, setUnits] = useState([]);
  const [allProblems, setAllProblems] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);

  // 문제별 파일 선택 상태 (업로드 전)
  const [submitData, setSubmitData] = useState({});
  // 문제별 채점 중 여부 (독립 관리)
  const [submittingMap, setSubmittingMap] = useState({});

  const fileInputRefs = useRef({});

  const { toast } = useToast();

  const studentId = studentData?.id;
  const studentName = studentData?.name;

  useEffect(() => { loadAll(); }, [studentId]);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [us, ps, subs] = await Promise.all([
        base44.entities.COSUnit.list("order"),
        base44.entities.COSProblem.list("problem_number"),
        studentId ? base44.entities.COSSubmission.filter({ student_id: studentId }) : Promise.resolve([]),
      ]);
      setUnits(us.filter(u => u.is_published !== false));
      setAllProblems(ps.filter(p => p.is_active !== false && p.is_published !== false));
      const sortedSubs = [...subs].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
      setSubmissions(sortedSubs);
    } catch (err) {
      setLoadError("COS 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
      console.warn("COS loadAll 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const getProblemsForUnit = (unitId) =>
    unitId === "unclassified"
      ? allProblems.filter(p => !p.unit_id)
      : allProblems.filter(p => p.unit_id === unitId);

  const getSubmission = (problemId) =>
    submissions
      .filter(s => s.problem_id === problemId)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];

  // 파일 선택 시 파일 정보만 저장 (업로드/읽기/fetch 없음)
  const handleFileSelect = (problemId, file) => {
    if (!file) return;
    setSubmitData(d => ({ ...d, [problemId]: { fileName: file.name, file } }));
  };

  // 제출 버튼: 파일 업로드 → AI 채점 시도 → 결과와 함께 저장
  const handleSubmit = async (problem) => {
    if (!studentId) {
      toast({ title: "학생 정보를 찾을 수 없습니다.", variant: "destructive" });
      return;
    }
    const data = submitData[problem.id] || {};
    if (!data.file) {
      toast({ title: "파일을 먼저 선택해주세요.", variant: "destructive" });
      return;
    }
    if (submittingMap[problem.id]) return;

    setSubmittingMap(prev => ({ ...prev, [problem.id]: true }));

    try {
      // 1. 파일 업로드
      const { file_url } = await base44.integrations.Core.UploadFile({ file: data.file });

      // 2. AI 채점 시도 (실패해도 제출은 저장)
      let gradeResult;
      try {
        const res = await base44.functions.invoke("gradeCosSb3", {
          student_file_url: file_url,
          answer_file_url: problem.answer_file_url || null,
          problem_description: problem.description || problem.title,
          grading_mode: problem.grading_mode || "ai",
        });
        const aiData = res.data;
        gradeResult = {
          is_correct: aiData.correct ?? false,
          reviewed_by_admin: false,
          grading_result: {
            status: aiData.correct ? "correct" : "incorrect",
            message: aiData.correct ? "맞았습니다!" : "조건을 더 확인해보세요.",
            grading_mode: aiData.grading_mode || "ai",
            score: aiData.score ?? 0,
            score_breakdown: aiData.score_breakdown ?? {},
            feedback: aiData.feedback ?? [],
            pending: aiData.pending_manual_review ?? false,
            differences: aiData.differences ?? [],
            ignored_differences: aiData.ignored_differences ?? [],
          },
        };
      } catch (aiError) {
        console.error("COS AI 채점 실패:", aiError);
        gradeResult = {
          is_correct: false,
          reviewed_by_admin: false,
          grading_result: {
            status: "pending",
            message: "AI 채점에 실패하여 선생님 확인이 필요합니다.",
            grading_mode: "manual",
            pending: true,
            feedback: [
              aiError?.response?.data?.error || aiError?.message || "AI 채점 중 오류가 발생했습니다.",
              "제출은 완료되었습니다. 선생님 확인 후 결과가 표시됩니다.",
            ],
          },
        };
      }

      // 3. 제출 저장
      const payload = {
        student_id: studentId,
        student_name: studentName,
        problem_id: problem.id,
        problem_title: problem.title,
        submitted_file_url: file_url,
        submitted_file_name: data.fileName,
        is_checked: false,
        submitted_at: new Date().toISOString(),
        ...gradeResult,
      };

      const existing = getSubmission(problem.id);
      let savedSubmission;
      if (existing) {
        await base44.entities.COSSubmission.update(existing.id, payload);
        savedSubmission = { ...existing, ...payload, id: existing.id };
      } else {
        const created = await base44.entities.COSSubmission.create(payload);
        savedSubmission = { ...payload, ...created };
      }

      setSubmissions(prev => [savedSubmission, ...prev.filter(s => s.problem_id !== problem.id)]);
      setSubmitData(d => ({ ...d, [problem.id]: {} }));

      const isPending = gradeResult.grading_result?.pending;
      toast({
        title: isPending ? "📤 제출 완료" : gradeResult.is_correct ? "✅ 정답입니다!" : "❌ 오답입니다",
        description: isPending ? "AI 채점에 실패하여 선생님 확인이 필요합니다." : undefined,
      });
    } catch (error) {
      console.error(error);
      toast({ title: "오류가 발생했습니다.", description: error?.message || "제출에 실패했습니다.", variant: "destructive" });
    } finally {
      setSubmittingMap(prev => ({ ...prev, [problem.id]: false }));
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>;

  const unclassifiedProblems = allProblems.filter(p => !p.unit_id);

  // ── 문제 목록 뷰 ──
  if (selectedUnit) {
    const isUnclassified = selectedUnit === "unclassified";
    const unitObj = isUnclassified ? null : units.find(u => u.id === selectedUnit);
    const problems = getProblemsForUnit(selectedUnit);

    return (
      <div className="max-w-2xl mx-auto py-4 px-1 space-y-4">
        <button onClick={() => setSelectedUnit(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />Unit 목록으로
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{isUnclassified ? "미분류 문제" : unitObj?.title}</h2>
          {!isUnclassified && unitObj?.description && <p className="text-sm text-gray-500 mt-0.5">{unitObj.description}</p>}
        </div>

        {problems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">이 Unit에 등록된 문제가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {problems.map(problem => {
              const sub = getSubmission(problem.id);
              const data = submitData[problem.id] || {};
              const isSubmitting = !!submittingMap[problem.id];
              const gradingResult = sub?.grading_result || {};
              const isCorrect = gradingResult.status === "correct" || sub?.is_correct === true;
              const isReviewed = sub?.reviewed_by_admin || sub?.is_checked;

              return (
                <div key={problem.id} className={`bg-white rounded-2xl border-2 p-4 transition-all ${sub ? (isCorrect ? "border-green-300" : "border-orange-300") : "border-gray-200"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${isCorrect ? "bg-green-500 text-white" : sub ? "bg-orange-400 text-white" : "bg-blue-100 text-blue-600"}`}>
                      {isCorrect ? <CheckCircle className="w-5 h-5" /> : (problem.problem_number || "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">{problem.title}</p>
                        {problem.level && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${LEVEL_COLOR[problem.level] || "bg-gray-100 text-gray-600"}`}>{problem.level}</span>}
                        {problem.category && <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{problem.category}</span>}
                        {problem.round && <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{problem.round}</span>}
                      </div>
                      {problem.description && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{problem.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {problem.problem_file_url && (
                          <a href={problem.problem_file_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                            <Download className="w-3 h-3" />문제 파일 다운로드
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {sub && (
                    <div className={`mb-3 p-3 rounded-xl border ${isCorrect ? "bg-green-50 border-green-200" : gradingResult.pending ? "bg-gray-50 border-gray-200" : "bg-orange-50 border-orange-200"}`}>
                      <p className={`text-sm font-bold mb-2 ${isCorrect ? "text-green-700" : gradingResult.pending ? "text-gray-600" : "text-orange-700"}`}>
                        {gradingResult.pending ? "⏳ 제출 완료 · 선생님 확인 대기 중" : isCorrect ? "✅ 맞았습니다" : "❌ 틀렸습니다"}
                      </p>
                      {gradingResult.pending && (
                        <p className="text-xs text-gray-500 mb-2">제출이 완료되었습니다. 선생님 확인 후 결과가 표시됩니다.</p>
                      )}
                      {gradingResult.admin_comment && (
                        <p className="text-xs text-gray-600 bg-white rounded px-2 py-1 mb-2">💬 {gradingResult.admin_comment}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={sub.submitted_file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <File className="w-3 h-3" />{sub.submitted_file_name || "제출 파일"}
                        </a>
                        {isReviewed && <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">👨‍🏫 선생님 확인 완료</span>}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(sub.submitted_at).toLocaleString("ko-KR")}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600">{sub ? "📝 다시 제출하기" : "📤 풀이 파일 업로드"}</p>
                    <input type="file" ref={el => fileInputRefs.current[problem.id] = el} className="hidden"
                      onChange={e => handleFileSelect(problem.id, e.target.files[0])} />
                    {data.fileName ? (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <File className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-xs text-blue-700 flex-1 truncate">{data.fileName}</span>
                        <button onClick={() => setSubmitData(d => ({ ...d, [problem.id]: {} }))} className="text-gray-400 hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => fileInputRefs.current[problem.id]?.click()}
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm disabled:opacity-50">
                        <Upload className="w-4 h-4" />풀이 파일 선택
                      </button>
                    )}
                    <Button
                      onClick={() => handleSubmit(problem)}
                      disabled={isSubmitting || !data.file}
                      className="w-full bg-blue-600 hover:bg-blue-700 gap-2 text-sm"
                    >
                      <Send className="w-4 h-4" />
                      {isSubmitting ? "제출 중..." : "제출하기"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Unit 목록 뷰 ──
  return (
    <div className="max-w-2xl mx-auto py-4 px-1">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">📋</span> COS 자격증
        </h2>
        <p className="text-gray-500 text-sm mt-1">Unit을 선택하면 해당 문제 목록을 확인할 수 있습니다.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
          <p className="text-gray-600 font-medium mb-1">{loadError}</p>
          <p className="text-xs text-gray-400 mb-4">COS는 Base44 서비스를 사용합니다. 잠시 후 다시 시도해 주세요.</p>
          <Button variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />다시 시도
          </Button>
        </div>
      ) : units.length === 0 && unclassifiedProblems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">등록된 Unit이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map(u => {
            const problems = getProblemsForUnit(u.id);
            const solved = problems.filter(p => getSubmission(p.id)).length;
            return (
              <button key={u.id} onClick={() => setSelectedUnit(u.id)}
                className="w-full flex items-center justify-between px-4 py-4 bg-white border border-gray-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50/30 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {u.order}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{u.title}</p>
                    {u.description && <p className="text-xs text-gray-400 mt-0.5">{u.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">문제 {problems.length}개 · 완료 {solved}개</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {problems.length > 0 && solved === problems.length && (
                    <span className="text-xs text-green-600 font-semibold bg-green-100 px-2 py-0.5 rounded-full">완료 ✅</span>
                  )}
                  <span className="text-gray-300">›</span>
                </div>
              </button>
            );
          })}

          {unclassifiedProblems.length > 0 && (
            <button onClick={() => setSelectedUnit("unclassified")}
              className="w-full flex items-center justify-between px-4 py-4 bg-orange-50 border border-orange-200 rounded-2xl hover:border-orange-300 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-orange-800">기타 문제</p>
                  <p className="text-xs text-orange-500 mt-0.5">문제 {unclassifiedProblems.length}개</p>
                </div>
              </div>
              <span className="text-orange-300">›</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}