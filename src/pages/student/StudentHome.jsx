import React, { useEffect, useState } from "react";
import { getSessionUser } from "@/lib/auth";
import { loadUnits, loadAllProgress, loadActiveSubjects, loadEnrollments } from "@/lib/dataAccess";
import { Code2, BookOpen, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { useOutletContext, Link } from "react-router-dom";
import { SUBJECT_CONFIGS, resolveActiveSubjects } from "@/utils/subjectAccess";

const ACCENT = {
  green:  { bg: "bg-green-50",  border: "border-green-100",  ball: "bg-green-100",  text: "text-green-700",  label: "text-green-600",  icon: "text-green-500"  },
  blue:   { bg: "bg-blue-50",   border: "border-blue-100",   ball: "bg-blue-100",   text: "text-blue-700",   label: "text-blue-600",   icon: "text-blue-500"   },
  cyan:   { bg: "bg-cyan-50",   border: "border-cyan-100",   ball: "bg-cyan-100",   text: "text-cyan-700",   label: "text-cyan-600",   icon: "text-cyan-500"   },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", ball: "bg-indigo-100", text: "text-indigo-700", label: "text-indigo-600", icon: "text-indigo-500" },
};

export default function StudentHome() {
  const [unitsByKey, setUnitsByKey] = useState({});
  const [progresses, setProgresses] = useState([]);
  const [activeKeys, setActiveKeys] = useState(null);
  const [loading, setLoading] = useState(true);

  const ctx = useOutletContext() || {};
  const studentData = ctx.studentData || null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const u = getSessionUser();
      const sid = studentData?.id || u?.student_id;

      const [subjData, ...unitLists] = await Promise.all([
        loadActiveSubjects(),
        ...SUBJECT_CONFIGS.map(cfg => loadUnits(cfg.key, { metadataOnly: true })),
      ]);
      const map = {};
      SUBJECT_CONFIGS.forEach((cfg, i) => { map[cfg.key] = unitLists[i] || []; });

      let prog = [];
      let enrollData = [];
      if (sid) {
        [prog, enrollData] = await Promise.all([loadAllProgress(sid), loadEnrollments(sid)]);
        prog = prog.filter(p => !p.unit_title?.startsWith("__"));
      }

      if (cancelled) return;
      setUnitsByKey(map);
      setProgresses(prog);
      setActiveKeys(resolveActiveSubjects(studentData, subjData, enrollData));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [studentData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">수강 과목을 불러오는 중입니다...</span>
      </div>
    );
  }

  const active = activeKeys || new Set();

  if (active.size === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">등록된 과목을 찾지 못했습니다.</p>
        <p className="text-sm text-gray-400 mt-1">선생님이 과목을 지정하면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {SUBJECT_CONFIGS.filter(cfg => active.has(cfg.key)).map(cfg => {
        const a = ACCENT[cfg.accent] || ACCENT.blue;
        const units = unitsByKey[cfg.key] || [];
        const ids = new Set(units.map(u => u.id));
        const progs = progresses.filter(p => ids.has(p.unit_id));
        const getProg = (unitId) => progs.find(p => p.unit_id === unitId);
        const cur = units.find(u => { const p = getProg(u.id); return !p?.is_unit_completed && !p?.is_completed; }) || units[0];
        const next = cur ? units.find(u => u.unit_number === cur.unit_number + 1) : null;
        const doneCount = progs.filter(p => p.is_unit_completed || p.is_completed).length;

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
              <Link to={cfg.path}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
                학습 시작 <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* 상세 */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cur && (
                <Link to={cfg.path} className={`flex items-center gap-3 p-3 ${a.bg} rounded-lg border ${a.border} hover:shadow-sm transition-all`}>
                  <div className={`w-10 h-10 ${a.ball} rounded-full flex items-center justify-center font-bold ${a.text} text-sm flex-shrink-0`}>{cur.unit_number}</div>
                  <div>
                    <p className={`text-xs ${a.label} font-medium`}>현재 Unit</p>
                    <p className="font-semibold text-gray-900 text-sm">{cur.title}</p>
                    {(() => { const p = getProg(cur.id); return p && (
                      <div className="flex gap-2 mt-1">
                        {p.example_progress_rate > 0 && <span className="text-[10px] text-gray-500">예제 {Math.round(p.example_progress_rate)}%</span>}
                        {p.question_progress_rate > 0 && <span className="text-[10px] text-gray-500">Q {Math.round(p.question_progress_rate)}%</span>}
                        {p.mission_progress_rate > 0 && <span className="text-[10px] text-gray-500">Mission {Math.round(p.mission_progress_rate)}%</span>}
                      </div>
                    ); })()}
                  </div>
                </Link>
              )}
              {next && (
                <Link to={cfg.path} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500 text-sm flex-shrink-0">{next.unit_number}</div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">다음 Unit</p>
                    <p className="font-semibold text-gray-700 text-sm">{next.title}</p>
                  </div>
                </Link>
              )}
              {units.length > 0 && (
                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <CheckCircle className={`w-4 h-4 ${a.icon}`} />
                  <span className="text-xs text-gray-500">전체 {units.length}개 Unit 중{" "}
                    <span className={`font-semibold ${a.label}`}>{doneCount}개 완료</span>
                  </span>
                </div>
              )}
              {units.length === 0 && (
                <div className="sm:col-span-2 text-sm text-gray-400 py-1">등록된 Unit이 없습니다.</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}