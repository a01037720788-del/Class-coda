import React, { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ExternalLink, ChevronRight, CheckCircle, BookOpen, Target,
  Send, ArrowLeft, Link, Upload, File, X, AlertTriangle, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function StudentEntryUnits() {
  const { studentData } = useOutletContext();
  const [units, setUnits] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [mode, setMode] = useState("list"); // "list" | "unit"
  // submitData[missionNumber] = { url, desc, file, fileUrl, fileName }
  const [submitData, setSubmitData] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const fileInputRefs = useRef({});
  const { toast } = useToast();

  const studentId = studentData?.id;
  const studentName = studentData?.name;

  useEffect(() => { loadAll(); }, [studentId]);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [us, subs] = await Promise.all([
        base44.entities.EntryUnit.list("unit_number"),
        studentId ? base44.entities.EntrySubmission.filter({ student_id: studentId }) : Promise.resolve([]),
      ]);
      setUnits(us.filter(u => u.is_active !== false));
      setSubmissions(subs);
    } catch (err) {
      setLoadError("엔트리 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
      console.warn("Entry loadAll 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const getSubmission = (unitId, mNum) =>
    submissions.find(s => s.unit_id === unitId && s.mission_number === mNum);

  const setField = (key, field, value) =>
    setSubmitData(d => ({ ...d, [key]: { ...d[key], [field]: value } }));

  const handleFileSelect = async (key, file) => {
    if (!file) return;
    setField(key, "file", file);
    setField(key, "fileName", file.name);
    // 즉시 업로드
    setField(key, "uploading", true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setField(key, "fileUrl", file_url);
    } catch (err) {
      toast({ title: "파일 업로드 실패", description: "잠시 후 다시 시도해 주세요.", variant: "destructive" });
    } finally {
      setField(key, "uploading", false);
    }
  };

  const handleSubmit = async (unit, mission) => {
    if (!studentId) {
      toast({ title: "학생 정보를 찾을 수 없습니다.", variant: "destructive" });
      return;
    }

    const key = mission.number;
    const data = submitData[key] || {};
    const url = (data.url || "").trim();
    const fileUrl = data.fileUrl;

    if (!fileUrl && !url) {
      toast({ title: "파일을 업로드하거나 작품 링크를 입력해주세요.", variant: "destructive" });
      return;
    }
    if (url && !url.startsWith("http")) {
      toast({ title: "올바른 URL을 입력해주세요.", variant: "destructive" });
      return;
    }

    setSubmitting(key);
    try {
      const existing = getSubmission(unit.id, mission.number);
      const payload = {
        student_id: studentId, student_name: studentName,
        unit_id: unit.id, unit_title: unit.title,
        mission_number: mission.number, mission_title: mission.title,
        project_url: url || "", file_url: fileUrl || "",
        file_name: data.fileName || "", description: data.desc || "",
        is_checked: false, submitted_at: new Date().toISOString(),
      };
      if (existing) {
        await base44.entities.EntrySubmission.update(existing.id, payload);
      } else {
        await base44.entities.EntrySubmission.create(payload);
      }
      toast({ title: "✅ 제출 완료!", description: "선생님이 확인 후 체크해 드립니다." });
      setSubmitData(d => ({ ...d, [key]: {} }));
      await loadAll();
    } catch (error) {
      console.error(error);
      toast({ title: "DB 저장 중 오류가 발생했습니다.", description: error?.message || "제출에 실패했습니다.", variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
    </div>
  );

  if (loadError) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
      <p className="text-gray-600 font-medium mb-1">{loadError}</p>
      <p className="text-xs text-gray-400 mb-4">엔트리는 Base44 서비스를 사용합니다. 잠시 후 다시 시도해 주세요.</p>
      <Button variant="outline" size="sm" onClick={loadAll}>
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />다시 시도
      </Button>
    </div>
  );

  // ── Unit 상세 화면 ──
  if (mode === "unit" && selectedUnit) {
    const unit = selectedUnit;
    const mTotal = (unit.missions || []).length;
    const mDone = (unit.missions || []).filter(m => getSubmission(unit.id, m.number)).length;

    return (
      <div className="max-w-2xl mx-auto py-4">
        <button
          onClick={() => { setSelectedUnit(null); setMode("list"); }}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Unit 목록으로
        </button>

        {/* 헤더 */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-400 rounded-2xl p-5 text-white mb-5 shadow-md">
          <p className="text-sm font-medium opacity-80 mb-1">Unit {unit.unit_number}</p>
          <h1 className="text-2xl font-bold mb-2">{unit.title}</h1>
          {unit.description && <p className="text-sm opacity-90 whitespace-pre-wrap">{unit.description}</p>}
          {mTotal > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-white/20 rounded-full h-2">
                <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${(mDone / mTotal) * 100}%` }} />
              </div>
              <span className="text-sm font-bold">{mDone}/{mTotal} 완료</span>
            </div>
          )}
        </div>

        {/* 엔트리 예제 작품 열기 */}
        {unit.entry_project_url && (
          <div className="bg-white rounded-2xl border-2 border-green-200 p-4 mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-gray-800 text-sm">📂 엔트리 예제 작품</p>
              <p className="text-xs text-gray-500 mt-0.5">선생님이 등록한 예제 작품을 확인해보세요</p>
            </div>
            <a href={unit.entry_project_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
              <Button className="bg-green-600 hover:bg-green-700 gap-2 text-sm">
                <ExternalLink className="w-4 h-4" />작품 열기
              </Button>
            </a>
          </div>
        )}

        {/* Mission 목록 */}
        {mTotal > 0 ? (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 text-sm px-1">🎯 Mission</h3>
            {unit.missions.map((mission, i) => {
              const sub = getSubmission(unit.id, mission.number);
              const key = mission.number;
              const inputData = submitData[key] || {};

              return (
                <div key={i} className={`bg-white rounded-2xl border-2 p-4 transition-all ${sub ? "border-green-300" : "border-gray-200"}`}>
                  {/* Mission 헤더 */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 text-sm ${sub ? "bg-green-500" : "bg-orange-400"}`}>
                      {sub ? <CheckCircle className="w-5 h-5" /> : mission.number}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">Mission {mission.number}. {mission.title}</p>
                      {mission.description && (
                        <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{mission.description}</p>
                      )}
                    </div>
                  </div>

                  {/* 기존 제출 현황 */}
                  {sub && (
                    <div className="mb-3 p-3 bg-green-50 rounded-xl border border-green-200 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-700 font-bold">✅ 제출 완료</span>
                        {sub.is_checked && <span className="text-xs text-blue-700 font-medium">👨‍🏫 선생님 확인 완료</span>}
                      </div>
                      {sub.file_url && (
                        <a href={sub.file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline">
                          <File className="w-3 h-3" />{sub.file_name || "제출 파일"}
                        </a>
                      )}
                      {sub.project_url && (
                        <a href={sub.project_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline">
                          <Link className="w-3 h-3" />{sub.project_url}
                        </a>
                      )}
                      {sub.description && <p className="text-xs text-gray-500">{sub.description}</p>}
                    </div>
                  )}

                  {/* 제출 폼 */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600">{sub ? "📝 다시 제출하기" : "📤 작품 제출"}</p>

                    {/* 파일 업로드 */}
                    <div>
                      <input
                        type="file"
                        ref={el => fileInputRefs.current[key] = el}
                        className="hidden"
                        onChange={e => handleFileSelect(key, e.target.files[0])}
                      />
                      {inputData.fileName ? (
                        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                          <File className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="text-xs text-green-700 flex-1 truncate">{inputData.fileName}</span>
                          {inputData.uploading && <span className="text-[10px] text-gray-400">업로드 중...</span>}
                          {!inputData.uploading && inputData.fileUrl && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                          <button onClick={() => { setField(key, "file", null); setField(key, "fileName", ""); setField(key, "fileUrl", ""); }}
                            className="text-gray-400 hover:text-red-400 flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRefs.current[key]?.click()}
                          className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors text-sm"
                        >
                          <Upload className="w-4 h-4" />파일 업로드 (엔트리 파일, 이미지, 압축파일 등)
                        </button>
                      )}
                    </div>

                    {/* 작품 링크 (선택) */}
                    <Input
                      placeholder="작품 링크 (선택) — https://playentry.org/project/..."
                      value={inputData.url || ""}
                      onChange={e => setField(key, "url", e.target.value)}
                      className="text-sm"
                    />

                    {/* 설명 */}
                    <textarea
                      placeholder="설명 (선택) — 예: 방향키로 캐릭터가 움직이도록 만들었습니다."
                      value={inputData.desc || ""}
                      onChange={e => setField(key, "desc", e.target.value)}
                      className="w-full border border-gray-200 rounded-md p-2 text-xs resize-none h-14 focus:outline-none focus:ring-1 focus:ring-green-400"
                    />

                    <Button
                      onClick={() => handleSubmit(unit, mission)}
                      disabled={submitting === key || inputData.uploading}
                      className="w-full bg-green-600 hover:bg-green-700 gap-2 text-sm"
                    >
                      <Send className="w-4 h-4" />
                      {submitting === key ? "제출 중..." : inputData.uploading ? "파일 업로드 중..." : "제출하기"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-sm">
            등록된 Mission이 없습니다.
          </div>
        )}
      </div>
    );
  }

  // ── Unit 목록 ──
  return (
    <div className="max-w-2xl mx-auto py-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-3xl">🟩</span> 엔트리
        </h2>
        <p className="text-gray-500 text-sm mt-1">Unit을 선택하여 엔트리 작품을 확인하고 제출하세요!</p>
      </div>

      {units.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">등록된 Unit이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map(u => {
            const mTotal = (u.missions || []).length;
            const mDone = (u.missions || []).filter(m => getSubmission(u.id, m.number)).length;
            const allDone = mTotal > 0 && mDone >= mTotal;
            return (
              <div key={u.id} onClick={() => { setSelectedUnit(u); setMode("unit"); }}
                className="bg-white rounded-2xl border-2 border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-green-300 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${allDone ? "bg-green-500 text-white" : "bg-green-100 text-green-600"}`}>
                    {allDone ? <CheckCircle className="w-6 h-6" /> : u.unit_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-gray-400 font-medium">Unit {u.unit_number}</p>
                      {allDone && <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">완료</Badge>}
                      {u.entry_project_url && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">🔗 예제</span>}
                    </div>
                    <p className="font-bold text-gray-900">{u.title}</p>
                    {u.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{u.description}</p>}
                    {mTotal > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-green-400 rounded-full h-1.5 transition-all" style={{ width: `${(mDone / mTotal) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Target className="w-3 h-3" />{mDone}/{mTotal}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-green-500 transition-colors flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}