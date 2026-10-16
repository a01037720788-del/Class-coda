import React, { useRef } from "react";
import { CheckCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import MultiFileEditor from "@/components/html/MultiFileEditor";
import { storageSave } from "@/lib/storageService";
import { useToast } from "@/components/ui/use-toast";

export default function HTMLMissionSection({
  unit, prog, mTotal,
  studentId, studentData,
  openMissionIdx, setOpenMissionIdx,
  missionStates, setMissionStates,
  loadMissionFiles,
  checkConditions,
  saveProgress,
  getProgress,
  storageKeyFn,
}) {
  const { toast } = useToast();
  const autoSaveTimer = useRef(null);

  if (mTotal === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Mission이 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">완료 {(prog.completed_mission_ids || []).length}/{mTotal}개</p>
      {unit.missions.map((mission, i) => {
        const isCompleted = (prog.completed_mission_ids || []).includes(i);
        const isOpen = openMissionIdx === i;
        const mNum = mission.number || i + 1;
        const mState = missionStates[i] || {};
        const curFiles = mState.files || null;
        const curCondResults = mState.condResults || [];
        const curSubmitted = mState.submitted || false;

        const openMission = () => {
          if (!missionStates[i]?.files) {
            const files = loadMissionFiles(unit.id, i, mission);
            setMissionStates(s => ({ ...s, [i]: { files, condResults: [], submitted: false } }));
          }
          setOpenMissionIdx(i);
        };

        const updateMissionState = (patch) => {
          setMissionStates(s => ({ ...s, [i]: { ...(s[i] || {}), ...patch } }));
        };

        const submitMission = async () => {
          if (!studentId) {
            toast({ title: "학생 정보를 찾을 수 없습니다.", variant: "destructive" });
            return;
          }
          const files = curFiles || loadMissionFiles(unit.id, i, mission);
          const mHtml = files.find(f => f.language === "html")?.code || "";
          const mCss  = files.find(f => f.language === "css")?.code  || "";
          const mJs   = files.find(f => f.language === "js")?.code   || "";
          const results = checkConditions(mHtml, mCss, mJs, mission.conditions || []);
          updateMissionState({ condResults: results, submitted: true });
          const allPassed = results.every(r => r.passed);
          storageSave(storageKeyFn(studentId, unit.id, i, "html"), mHtml);
          storageSave(storageKeyFn(studentId, unit.id, i, "css"), mCss);
          storageSave(storageKeyFn(studentId, unit.id, i, "js"), mJs);
          if (allPassed) {
            const p = getProgress(unit.id);
            const completed = [...new Set([...(p.completed_mission_ids || []), i])];
            const rate = Math.round((completed.length / mTotal) * 100);
            await saveProgress(unit.id, {
              completed_mission_ids: completed, mission_progress_rate: rate,
              is_unit_completed: rate === 100, last_studied_at: new Date().toISOString(),
            });
            try {
              const { base44 } = await import("@/api/base44Client");
              await base44.entities.HTMLMissionSubmission.create({
                student_id: studentId, student_name: studentData?.name || "",
                unit_id: unit.id, unit_title: unit.title,
                mission_number: mNum, mission_title: mission.title,
                submitted_html: mHtml, submitted_css: mCss, submitted_javascript: mJs,
                condition_results: results, is_completed: allPassed,
                submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              });
              toast({ title: "✅ 제출 완료!", description: "모든 조건을 만족했습니다." });
            } catch (dbError) {
              console.error(dbError);
              toast({ title: "DB 저장 중 오류가 발생했습니다.", description: dbError?.message || "제출에 실패했습니다.", variant: "destructive" });
            }
          } else {
            toast({ title: "조건을 확인해주세요.", description: "일부 조건을 아직 만족하지 않았습니다.", variant: "destructive" });
          }
        };

        return (
          <div key={i} className={`border rounded-xl overflow-hidden transition-all ${isCompleted ? "border-green-300" : "border-gray-200"}`}>
            <div
              className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${isOpen ? (isCompleted ? "bg-green-50" : "bg-orange-50") : "bg-gray-50 hover:bg-gray-100"}`}
              onClick={() => isOpen ? setOpenMissionIdx(null) : openMission()}
            >
              <div className="flex items-center gap-2">
                {isCompleted
                  ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <span className="text-orange-500 flex-shrink-0">🎯</span>}
                <span className={`font-bold text-sm ${isCompleted ? "text-green-700" : "text-orange-700"}`}>
                  Mission {String(mNum).padStart(2, "0")}.
                </span>
                {mission.title && (
                  <span className="text-sm text-gray-700 font-semibold truncate max-w-[160px] sm:max-w-xs">{mission.title}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isCompleted && <span className="text-xs text-green-600 font-semibold hidden sm:inline">✅ 완료</span>}
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            {isOpen && (
              <div className="p-5 border-t border-gray-100 space-y-4">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{mission.description}</p>
                  {mission.preview_image && (
                    <img src={mission.preview_image} alt="예시" className="mt-3 rounded-lg max-h-40 border border-orange-200" />
                  )}
                  {(mission.conditions || []).length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-semibold text-gray-500">조건:</p>
                      {mission.conditions.map((c, ci) => {
                        const result = curCondResults[ci];
                        const colorClass = c.type === "css" ? "text-blue-600" : c.type === "js" ? "text-yellow-600" : "text-gray-600";
                        return (
                          <div key={ci} className={`flex items-center gap-2 text-sm ${result ? (result.passed ? "text-green-600" : "text-red-500") : colorClass}`}>
                            {result ? (result.passed ? "✅" : "❌") : "▸"}
                            <span className={`text-[10px] font-bold px-1 rounded ${c.type === "css" ? "bg-blue-100 text-blue-700" : c.type === "js" ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700"}`}>
                              {(c.type || "html").toUpperCase()}
                            </span>
                            {c.label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {curFiles && (
                  <MultiFileEditor
                    files={curFiles}
                    onFilesChange={files => {
                      updateMissionState({ files, condResults: [], submitted: false });
                      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
                      autoSaveTimer.current = setTimeout(() => {
                        files.forEach(f => {
                          const field = f.language === "html" ? "html" : f.language === "css" ? "css" : "js";
                          storageSave(storageKeyFn(studentId, unit.id, i, field), f.code);
                        });
                      }, 3000);
                    }}
                    height="700px"
                  />
                )}

                {curSubmitted && curCondResults.length > 0 && (
                  <div className={`p-4 rounded-xl border ${curCondResults.every(r => r.passed) ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
                    <p className={`font-semibold text-sm mb-2 ${curCondResults.every(r => r.passed) ? "text-green-700" : "text-yellow-700"}`}>
                      {curCondResults.every(r => r.passed) ? "🎉 모든 조건을 만족했습니다!" : "일부 조건을 아직 만족하지 않았습니다."}
                    </p>
                    <div className="space-y-1">
                      {curCondResults.map((r, ri) => (
                        <div key={ri} className={`text-sm flex items-center gap-2 ${r.passed ? "text-green-600" : "text-red-500"}`}>
                          {r.passed ? "✅" : "❌"} {r.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={submitMission} className="bg-orange-500 hover:bg-orange-600">제출하기</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}