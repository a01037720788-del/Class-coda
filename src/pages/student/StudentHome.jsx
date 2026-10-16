import React, { useEffect, useState } from "react";
import { getSessionUser } from "@/lib/auth";
import { loadUnits, loadActiveSubjects, loadAllProgress, loadEnrollments } from "@/lib/dataAccess";
import { Code2, BookOpen, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { SUBJECT_CONFIGS, resolveActiveSubjects } from "@/utils/subjectAccess";

const ACCENT = {
  green:  { bg: "bg-green-50",  border: "border-green-100",  ball: "bg-green-100",  text: "text-green-700",  label: "text-green-600",  icon: "text-green-500"  },
  blue:   { bg: "bg-blue-50",   border: "border-blue-100",   ball: "bg-blue-100",   text: "text-blue-700",   label: "text-blue-600",   icon: "text-blue-500"   },
  cyan:   { bg: "bg-cyan-50",   border: "border-cyan-100",   ball: "bg-cyan-100",   text: "text-cyan-700",   label: "text-cyan-600",   icon: "text-cyan-500"   },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", ball: "bg-indigo-100", text: "text-indigo-700", label: "text-indigo-600", icon: "text-indigo-500" },
  orange: { bg: "bg-orange-50", border: "border-orange-100", ball: "bg-orange-100", text: "text-orange-700", label: "text-orange-600", icon: "text-orange-500" },
  purple: { bg: "bg-purple-50", border: "border-purple-100", ball: "bg-purple-100", text: "text-purple-700", label: "text-purple-600", icon: "text-purple-500" },
  pink:   { bg: "bg-pink-50",   border: "border-pink-100",   ball: "bg-pink-100",   text: "text-pink-700",   label: "text-pink-600",   icon: "text-pink-500"   },
  teal:   { bg: "bg-teal-50",   border: "border-teal-100",   ball: "bg-teal-100",   text: "text-teal-700",   label: "text-teal-600",   icon: "text-teal-500"   },
};

export default function StudentHome() {
  const [pyUnits, setPyUnits] = useState([]);
  const [htmlUnits, setHtmlUnits] = useState([]);
  const [cppUnits, setCppUnits] = useState([]);
  const [pyProgresses, setPyProgresses] = useState([]);
  const [htmlProgresses, setHtmlProgresses] = useState([]);
  const [cppProgresses, setCppProgresses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [loading, setLoading] = useState(true);

  const ctx = useOutletContext() || {};
  const studentData = ctx.studentData || null;

  useEffect(() => {
    const u = getSessionUser();
    const sid = studentData?.id || u?.student_id;

    const loadData = async () => {
      const [pyData, htmlData, cppData, subjData] = await Promise.all([
        loadUnits("python", { metadataOnly: true }),
        loadUnits("html", { metadataOnly: true }),
        loadUnits("cpp", { metadataOnly: true }),
        loadActiveSubjects(),
      ]);
      setPyUnits(pyData);
      setHtmlUnits(htmlData);
      setCppUnits(cppData);
      setSubjectList(subjData);

      if (sid) {
        const [allProg, enrollData] = await Promise.all([
          loadAllProgress(sid),
          loadEnrollments(sid),
        ]);
        // 통합 progress 테이블에서 unit_type별로 분류
        const pyIds = new Set(pyData.map(u => u.id));
        const htmlIds = new Set(htmlData.map(u => u.id));
        const cppIds = new Set(cppData.map(u => u.id));
        setPyProgresses(allProg.filter(p => pyIds.has(p.unit_id) || p.unit_type === "python"));
        setHtmlProgresses(allProg.filter(p => htmlIds.has(p.unit_id) || p.unit_type === "html"));
        setCppProgresses(allProg.filter(p => cppIds.has(p.unit_id) || p.unit_type === "cpp"));
        setEnrollments(enrollData);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  // Python 진행
  const getPyProg = (unitId) => pyProgresses.find(p => p.unit_id === unitId);
  const curPyUnit = pyUnits.find(u => { const p = getPyProg(u.id); return !p?.is_unit_completed && !p?.is_completed; }) || pyUnits[0];
  const nextPyUnit = curPyUnit ? pyUnits.find(u => u.unit_number === curPyUnit.unit_number + 1) : null;

  // HTML 진행
  const getHtmlProg = (unitId) => htmlProgresses.find(p => p.unit_id === unitId);
  const curHtmlUnit = htmlUnits.find(u => !getHtmlProg(u.id)?.is_unit_completed) || htmlUnits[0];
  const nextHtmlUnit = curHtmlUnit ? htmlUnits.find(u => u.unit_number === curHtmlUnit.unit_number + 1) : null;

  // C++ 진행
  const getCppProg = (unitId) => cppProgresses.find(p => p.unit_id === unitId);
  const curCppUnit = cppUnits.find(u => !getCppProg(u.id)?.is_unit_completed) || cppUnits[0];
  const nextCppUnit = curCppUnit ? cppUnits.find(u => u.unit_number === curCppUnit.unit_number + 1) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">수강 과목을 불러오는 중입니다...</span>
      </div>
    );
  }

  if (!studentData) {
    const u = getSessionUser();
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-red-500 text-xl">⚠</span>
        </div>
        <p className="text-red-600 font-semibold mb-2">학생 계정과 학생 정보가 연결되지 않았습니다.</p>
        <div className="text-xs text-gray-500 mt-3 space-y-1 text-left max-w-sm mx-auto bg-gray-50 rounded-lg p-3">
          <p>app_users.student_id: <span className="font-mono">{u?.student_id || "(없음)"}</span></p>
          <p>students.id: <span className="font-mono">{studentData?.id || "(조회 불가)"}</span></p>
          <p className="text-gray-400 mt-2">관리자에게 위 정보를 전달해 주세요.</p>
        </div>
      </div>
    );
  }

  const activeSubjects = resolveActiveSubjects(studentData, subjectList, enrollments);

  if (activeSubjects.size === 0) {
    const u = getSessionUser();
    const isAdmin = u?.role === "admin" || u?.role === "super_admin" || u?.role === "teacher";
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">등록된 과목을 찾지 못했습니다.</p>
        <p className="text-sm text-gray-400 mt-1">선생님이 과목을 열어주면 여기에 표시됩니다.</p>
        {isAdmin && (
          <div className="mt-4 text-xs text-gray-500 space-y-1 text-left max-w-sm mx-auto bg-gray-50 rounded-lg p-3">
            <p className="font-semibold text-gray-700 mb-1">진단 정보 (관리자 전용)</p>
            <p>student_id: <span className="font-mono">{studentData?.id || "(없음)"}</span></p>
            <p>subjects 개수: <span className="font-mono">{studentData?.subjects?.length || 0}</span></p>
            <p>subject_permissions 개수: <span className="font-mono">{Object.keys(studentData?.subject_permissions || {}).length}</span></p>
            <p>enrollments 개수: <span className="font-mono">{enrollments?.length || 0}</span></p>
            <p>subjects 테이블 과목 수: <span className="font-mono">{subjectList?.length || 0}</span></p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {SUBJECT_CONFIGS.filter(cfg => activeSubjects.has(cfg.key)).map(cfg => {
        const a = ACCENT[cfg.accent] || ACCENT.blue;
        return (
          <div key={cfg.key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className={`bg-gradient-to-r ${cfg.gradient} px-5 py-4 text-white flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                <div>
                  <p className="font-bold text-lg">{cfg.label}</p>
                  <p className="text-sm opacity-80">{cfg.desc}</p>
                </div>
              </div>
              <a href={cfg.path}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
                학습 시작 <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            {/* Python 상세 */}
            {cfg.key === "python" && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {curPyUnit && (
                  <a href={cfg.path} className={`flex items-center gap-3 p-3 ${a.bg} rounded-lg border ${a.border} hover:shadow-sm transition-all`}>
                    <div className={`w-10 h-10 ${a.ball} rounded-full flex items-center justify-center font-bold ${a.text} text-sm flex-shrink-0`}>{curPyUnit.unit_number}</div>
                    <div>
                      <p className={`text-xs ${a.label} font-medium`}>현재 Unit</p>
                      <p className="font-semibold text-gray-900 text-sm">{curPyUnit.title}</p>
                      {(() => { const p = getPyProg(curPyUnit.id); return p && (
                        <div className="flex gap-2 mt-1">
                          {p.example_progress_rate > 0 && <span className="text-[10px] text-gray-500">예제 {Math.round(p.example_progress_rate)}%</span>}
                          {p.question_progress_rate > 0 && <span className="text-[10px] text-gray-500">Q {Math.round(p.question_progress_rate)}%</span>}
                        </div>
                      ); })()}
                    </div>
                  </a>
                )}
                {nextPyUnit && (
                  <a href={cfg.path} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-sm transition-all">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500 text-sm flex-shrink-0">{nextPyUnit.unit_number}</div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">다음 Unit</p>
                      <p className="font-semibold text-gray-700 text-sm">{nextPyUnit.title}</p>
                    </div>
                  </a>
                )}
                {pyUnits.length > 0 && (
                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <CheckCircle className={`w-4 h-4 ${a.icon}`} />
                    <span className="text-xs text-gray-500">전체 {pyUnits.length}개 Unit 중{" "}
                      <span className={`font-semibold ${a.label}`}>{pyProgresses.filter(p => p.is_unit_completed || p.is_completed).length}개 완료</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* HTML 상세 */}
            {cfg.key === "html" && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {curHtmlUnit && (
                  <a href={cfg.path} className={`flex items-center gap-3 p-3 ${a.bg} rounded-lg border ${a.border} hover:shadow-sm transition-all`}>
                    <div className={`w-10 h-10 ${a.ball} rounded-full flex items-center justify-center font-bold ${a.text} text-sm flex-shrink-0`}>{curHtmlUnit.unit_number}</div>
                    <div>
                      <p className={`text-xs ${a.label} font-medium`}>현재 Unit</p>
                      <p className="font-semibold text-gray-900 text-sm">{curHtmlUnit.title}</p>
                      {(() => { const p = getHtmlProg(curHtmlUnit.id); return p && (
                        <div className="flex gap-2 mt-1">
                          {p.example_progress_rate > 0 && <span className="text-[10px] text-gray-500">예제 {Math.round(p.example_progress_rate)}%</span>}
                          {p.question_progress_rate > 0 && <span className="text-[10px] text-gray-500">Q {Math.round(p.question_progress_rate)}%</span>}
                          {p.mission_progress_rate > 0 && <span className="text-[10px] text-gray-500">Mission {Math.round(p.mission_progress_rate)}%</span>}
                        </div>
                      ); })()}
                    </div>
                  </a>
                )}
                {nextHtmlUnit && (
                  <a href={cfg.path} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-sm transition-all">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500 text-sm flex-shrink-0">{nextHtmlUnit.unit_number}</div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">다음 Unit</p>
                      <p className="font-semibold text-gray-700 text-sm">{nextHtmlUnit.title}</p>
                    </div>
                  </a>
                )}
                {htmlUnits.length > 0 && (
                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <CheckCircle className={`w-4 h-4 ${a.icon}`} />
                    <span className="text-xs text-gray-500">전체 {htmlUnits.length}개 Unit 중{" "}
                      <span className={`font-semibold ${a.label}`}>{htmlProgresses.filter(p => p.is_unit_completed).length}개 완료</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* C++ 상세 */}
            {cfg.key === "cpp" && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {curCppUnit && (
                  <a href={cfg.path} className={`flex items-center gap-3 p-3 ${a.bg} rounded-lg border ${a.border} hover:shadow-sm transition-all`}>
                    <div className={`w-10 h-10 ${a.ball} rounded-full flex items-center justify-center font-bold ${a.text} text-sm flex-shrink-0`}>{curCppUnit.unit_number}</div>
                    <div>
                      <p className={`text-xs ${a.label} font-medium`}>현재 Unit</p>
                      <p className="font-semibold text-gray-900 text-sm">{curCppUnit.title}</p>
                      {(() => { const p = getCppProg(curCppUnit.id); return p && (
                        <div className="flex gap-2 mt-1">
                          {p.example_progress_rate > 0 && <span className="text-[10px] text-gray-500">예제 {Math.round(p.example_progress_rate)}%</span>}
                          {p.question_progress_rate > 0 && <span className="text-[10px] text-gray-500">Q {Math.round(p.question_progress_rate)}%</span>}
                        </div>
                      ); })()}
                    </div>
                  </a>
                )}
                {nextCppUnit && (
                  <a href={cfg.path} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-sm transition-all">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500 text-sm flex-shrink-0">{nextCppUnit.unit_number}</div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">다음 Unit</p>
                      <p className="font-semibold text-gray-700 text-sm">{nextCppUnit.title}</p>
                    </div>
                  </a>
                )}
                {cppUnits.length > 0 && (
                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <CheckCircle className={`w-4 h-4 ${a.icon}`} />
                    <span className="text-xs text-gray-500">전체 {cppUnits.length}개 Unit 중{" "}
                      <span className={`font-semibold ${a.label}`}>{cppProgresses.filter(p => p.is_unit_completed).length}개 완료</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 나머지 과목 간단 안내 */}
            {!["python", "html", "cpp"].includes(cfg.key) && (
              <div className="p-4">
                <p className="text-sm text-gray-500">학습을 시작하고 실력을 키워보세요.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}