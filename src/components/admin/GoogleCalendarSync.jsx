import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  RefreshCw, Calendar as CalendarIcon, Loader2, AlertCircle,
  CheckCircle2, ChevronDown, Stethoscope, AlertTriangle, Eye, Zap, RotateCcw
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import CalendarFullResetButton from "@/components/admin/CalendarFullResetButton";

const RANGE_PRESETS = [
  { key: "this_month", label: "이번 달" },
  { key: "1_3", label: "이전 1개월 ~ 이후 3개월" },
  { key: "3_12", label: "이전 3개월 ~ 이후 12개월" },
  { key: "custom", label: "직접 기간 선택" },
];

function getRangePreset(preset, refDate = new Date()) {
  switch (preset) {
    case "this_month":
      return { from: format(startOfMonth(refDate), "yyyy-MM-dd"), to: format(endOfMonth(refDate), "yyyy-MM-dd") };
    case "1_3":
      return { from: format(subMonths(refDate, 1), "yyyy-MM-dd"), to: format(addMonths(refDate, 3), "yyyy-MM-dd") };
    case "3_12":
      return { from: format(subMonths(refDate, 3), "yyyy-MM-dd"), to: format(addMonths(refDate, 12), "yyyy-MM-dd") };
    default:
      return null;
  }
}

export default function GoogleCalendarSync({ onSynced }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [showDiagDialog, setShowDiagDialog] = useState(false);

  // forceSync / reset 관련
  const [showForceDialog, setShowForceDialog] = useState(false);
  const [forceMode, setForceMode] = useState("forceSync"); // forceSync | reset
  const [rangePreset, setRangePreset] = useState("1_3");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await base44.functions.invoke("googleCalendarStatus", {});
      setStatus(res.data);
    } catch (e) {
      setStatus({ connected: false, error: "연결 상태를 확인할 수 없습니다." });
    } finally {
      setChecking(false);
    }
  }, []);

  const loadCalendars = useCallback(async () => {
    setLoadingCalendars(true);
    try {
      const res = await base44.functions.invoke("googleCalendars", {});
      const d = res.data;
      if (d && d.calendars) {
        setCalendars(d.calendars);
        setSelected(d.selected);
      } else if (d?.error) {
        toast({ title: "캘린더 목록 조회 실패", description: d.error, variant: "destructive" });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "캘린더 목록을 불러올 수 없습니다.";
      toast({ title: "캘린더 목록 조회 실패", description: msg, variant: "destructive" });
    } finally {
      setLoadingCalendars(false);
    }
  }, [toast]);

  useEffect(() => { checkStatus(); }, [checkStatus]);
  useEffect(() => {
    if (status?.connected) loadCalendars();
  }, [status?.connected, loadCalendars]);

  const handleSelectCalendar = async (calendarId) => {
    const cal = calendars.find(c => c.id === calendarId);
    if (!cal) return;
    setSavingCalendar(true);
    try {
      const res = await base44.functions.invoke("googleCalendars", {
        action: "select",
        calendar_id: calendarId,
        calendar_title: cal.title,
      });
      const d = res.data;
      if (d && d.selected) {
        setSelected(d.selected);
        toast({ title: "캘린더 선택 완료", description: cal.title });
      } else if (d?.error) {
        toast({ title: "캘린더 선택 실패", description: d.error, variant: "destructive" });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "캘린더 선택에 실패했습니다.";
      toast({ title: "캘린더 선택 실패", description: msg, variant: "destructive" });
    } finally {
      setSavingCalendar(false);
    }
  };

  const getRange = () => {
    if (rangePreset === "custom") {
      if (!customFrom || !customTo) return null;
      return { from: customFrom, to: customTo };
    }
    return getRangePreset(rangePreset);
  };

  const handleSync = async (mode) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("syncGoogleCalendar", { mode });
      const d = res.data;
      if (d && d.success) {
        setSyncResult(d);
        toast({
          title: mode === "import" ? "Google 일정 불러오기 완료" : "지금 동기화 완료",
          description: `가져옴 ${d.totalFetched} · 새 ${d.created} · 변경 ${d.updated} · 학생연결 ${d.studentLinked} · 과목연결 ${d.subjectLinked || 0} · CSS생성 ${d.cssCreated || 0}`,
        });
        if (onSynced) onSynced();
      } else {
        const errMap = {
          NO_CONNECTION: "Google Calendar 연결이 없습니다.",
          AUTH_EXPIRED: "Google 인증이 만료되었습니다.",
          AUTH_FAILED: "Google 인증 실패 또는 캘린더 권한 부족",
          FETCH_FAILED: "Google 일정 조회 실패",
        };
        const code = d?.code;
        const msg = (code && errMap[code]) ? errMap[code] : (d?.error || "동기화 실패");
        toast({ title: "동기화 실패", description: msg, variant: "destructive" });
      }
    } catch (e) {
      const d = e?.response?.data;
      const errMap = {
        NO_CONNECTION: "Google Calendar 연결이 없습니다.",
        AUTH_EXPIRED: "Google 인증이 만료되었습니다.",
        AUTH_FAILED: "Google 인증 실패 또는 캘린더 권한 부족",
        FETCH_FAILED: "Google 일정 조회 실패",
      };
      const code = d?.code;
      const msg = (code && errMap[code]) ? errMap[code] : (d?.error || e?.message || "동기화 중 오류");
      toast({ title: "동기화 실패", description: msg, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handlePreview = async () => {
    const range = getRange();
    if (!range) {
      toast({ title: "범위 선택", description: "동기화 범위를 선택해주세요.", variant: "destructive" });
      return;
    }
    setPreviewing(true);
    setShowPreviewDialog(true);
    setPreviewData(null);
    try {
      const res = await base44.functions.invoke("syncGoogleCalendar", { mode: "preview", range });
      const d = res.data;
      if (d && d.success) {
        setPreviewData(d);
      } else {
        toast({ title: "미리보기 실패", description: d?.error || "미리보기 중 오류", variant: "destructive" });
        setShowPreviewDialog(false);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "미리보기 중 오류";
      toast({ title: "미리보기 실패", description: msg, variant: "destructive" });
      setShowPreviewDialog(false);
    } finally {
      setPreviewing(false);
    }
  };

  const handleForceSync = async () => {
    const range = getRange();
    if (!range) {
      toast({ title: "범위 선택", description: "동기화 범위를 선택해주세요.", variant: "destructive" });
      return;
    }
    setShowForceDialog(false);
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("syncGoogleCalendar", { mode: forceMode, range });
      const d = res.data;
      if (d && d.success) {
        setSyncResult(d);
        const title = forceMode === "reset" ? "캘린더 다시 설정 완료" : "Google 일정 다시 가져오기 완료";
        toast({
          title,
          description: `가져옴 ${d.totalFetched} · 새 ${d.created} · 변경 ${d.updated} · 학생연결 ${d.studentLinked} · 과목연결 ${d.subjectLinked || 0} · CSS생성 ${d.cssCreated || 0} · 출석유지 ${d.attendancePreserved || 0}`,
        });
        if (onSynced) onSynced();
      } else {
        const msg = d?.error || "실패";
        toast({ title: "실패", description: msg, variant: "destructive" });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "오류";
      toast({ title: "실패", description: msg, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDiagnose = async () => {
    setDiagnosing(true);
    setShowDiagDialog(true);
    setDiagnostics(null);
    try {
      const res = await base44.functions.invoke("syncGoogleCalendar", { mode: "diagnose" });
      const d = res.data;
      if (d && d.success) {
        setDiagnostics(d.diagnostics || []);
      } else {
        toast({ title: "진단 실패", description: d?.error || "진단 중 오류", variant: "destructive" });
        setShowDiagDialog(false);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "진단 중 오류";
      toast({ title: "진단 실패", description: msg, variant: "destructive" });
      setShowDiagDialog(false);
    } finally {
      setDiagnosing(false);
    }
  };

  const openForceDialog = (mode) => {
    setForceMode(mode);
    setRangePreset("1_3");
    setCustomFrom("");
    setCustomTo("");
    setShowForceDialog(true);
  };

  const connected = status?.connected;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-medium text-gray-600">Google Calendar</span>
        {checking ? (
          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
        ) : connected ? (
          <Badge className="bg-green-100 text-green-700 border-0 text-[10px] gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />연결됨
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] gap-1 text-gray-500 border-gray-300">
            <AlertCircle className="w-2.5 h-2.5" />미연결
          </Badge>
        )}
      </div>

      {connected && (
        <>
          {/* 캘린더 선택 */}
          <div className="relative inline-flex items-center">
            <select
              value={selected?.id || ""}
              onChange={(e) => handleSelectCalendar(e.target.value)}
              disabled={loadingCalendars || savingCalendar}
              className="text-xs h-7 pl-2 pr-7 rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:opacity-50 cursor-pointer appearance-none"
            >
              {loadingCalendars && <option value="">불러오는 중...</option>}
              {!loadingCalendars && calendars.length === 0 && <option value="">캘린더 없음</option>}
              {!loadingCalendars && calendars.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title}{c.primary ? " (기본)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
            {savingCalendar && <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-1" />}
          </div>

          <Button size="sm" variant="outline" onClick={() => handleSync("sync")} disabled={syncing}
            className="text-xs gap-1 h-7">
            <RefreshCw className="w-3 h-3" />
            {syncing ? "동기화 중..." : "지금 동기화"}
          </Button>

          {/* Google 일정 다시 가져오기 (forceSync) */}
          <Button size="sm" variant="outline" onClick={() => openForceDialog("forceSync")} disabled={syncing}
            className="text-xs gap-1 h-7 text-orange-600 border-orange-200 hover:bg-orange-50">
            <Zap className="w-3 h-3" />
            Google 일정 다시 가져오기
          </Button>

          {/* 캘린더 다시 설정 (reset) */}
          <Button size="sm" variant="outline" onClick={() => openForceDialog("reset")} disabled={syncing}
            className="text-xs gap-1 h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
            <RotateCcw className="w-3 h-3" />
            캘린더 다시 설정
          </Button>

          {/* 캘린더 전체 초기화 후 다시 가져오기 (fullReset) */}
          <CalendarFullResetButton onSynced={onSynced} disabled={syncing} />

          {/* 동기화 진단 */}
          <Button size="sm" variant="outline" onClick={handleDiagnose} disabled={diagnosing}
            className="text-xs gap-1 h-7 text-purple-600 border-purple-200 hover:bg-purple-50">
            <Stethoscope className="w-3 h-3" />
            {diagnosing ? "진단 중..." : "동기화 진단"}
          </Button>

          {syncResult && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap w-full mt-1">
              <Badge className="bg-blue-50 text-blue-600 border-0 text-[10px]">가져옴 {syncResult.totalFetched}</Badge>
              <Badge className="bg-green-50 text-green-600 border-0 text-[10px]">새 일정 {syncResult.created}</Badge>
              <Badge className="bg-yellow-50 text-yellow-600 border-0 text-[10px]">변경 {syncResult.updated}</Badge>
              <Badge className="bg-purple-50 text-purple-600 border-0 text-[10px]">학생연결 {syncResult.studentLinked}</Badge>
              <Badge className="bg-teal-50 text-teal-600 border-0 text-[10px]">과목연결 {syncResult.subjectLinked || 0}</Badge>
              <Badge className="bg-cyan-50 text-cyan-600 border-0 text-[10px]">CSS생성 {syncResult.cssCreated || 0}</Badge>
              {syncResult.attendancePreserved > 0 && (
                <Badge className="bg-green-50 text-green-700 border-0 text-[10px]">출석유지 {syncResult.attendancePreserved}</Badge>
              )}
              {syncResult.studentMatchFailed > 0 && (
                <Badge className="bg-red-50 text-red-600 border-0 text-[10px]">연결필요 {syncResult.studentMatchFailed}</Badge>
              )}
              <Badge className="bg-gray-50 text-gray-500 border-0 text-[10px]">취소 {syncResult.cancelled}</Badge>
              {syncResult.skipped > 0 && (
                <Badge className="bg-gray-50 text-gray-400 border-0 text-[10px]">스킵 {syncResult.skipped}</Badge>
              )}
            </div>
          )}
        </>
      )}
      {!connected && !checking && (
        <span className="text-[10px] text-gray-400">학원 관리자가 Google Calendar를 연결해야 사용할 수 있습니다.</span>
      )}

      {/* forceSync / reset 범위 선택 다이얼로그 */}
      <Dialog open={showForceDialog} onOpenChange={setShowForceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {forceMode === "reset" ? <RotateCcw className="w-5 h-5 text-indigo-600" /> : <Zap className="w-5 h-5 text-orange-600" />}
              {forceMode === "reset" ? "캘린더 다시 설정" : "Google 일정 다시 가져오기"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              {forceMode === "reset"
                ? "Google 원본 기준으로 안전하게 재구성/보정합니다. 기존 출석/피드백/수동 연결은 유지됩니다."
                : "google_updated가 같더라도 선택한 기간의 데이터를 다시 읽어서 사이트 데이터를 보정합니다. 기존 출석/피드백/수동 연결은 유지됩니다."}
            </p>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-2 block">동기화 범위</label>
              <div className="space-y-1.5">
                {RANGE_PRESETS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rangePreset"
                      value={p.key}
                      checked={rangePreset === p.key}
                      onChange={(e) => setRangePreset(e.target.value)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-xs text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {rangePreset === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-xs h-8 px-2 rounded-md border border-gray-200"
                />
                <span className="text-gray-400">~</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-xs h-8 px-2 rounded-md border border-gray-200"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewing}
                className="text-xs gap-1 flex-1">
                {previewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                {previewing ? "미리보는 중..." : "동기화 미리보기"}
              </Button>
              <Button size="sm" onClick={handleForceSync} disabled={syncing || previewing}
                className={`text-xs gap-1 flex-1 ${forceMode === "reset" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-orange-500 hover:bg-orange-600"}`}>
                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {syncing ? "실행 중..." : forceMode === "reset" ? "다시 설정" : "다시 가져오기"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 미리보기 다이얼로그 */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              동기화 미리보기
            </DialogTitle>
          </DialogHeader>
          {previewing ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Google 일정을 분석하는 중...
            </div>
          ) : previewData ? (
            <div className="space-y-3">
              {/* 요약 */}
              <div className="flex items-center gap-1.5 flex-wrap p-3 bg-blue-50 rounded-lg">
                <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">가져옴 {previewData.summary?.totalFetched ?? previewData.totalFetched}</Badge>
                <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">새 {previewData.summary?.created ?? 0}</Badge>
                <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]">변경 {previewData.summary?.updated ?? 0}</Badge>
                <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px]">학생연결 {previewData.summary?.studentLinked ?? 0}</Badge>
                <Badge className="bg-teal-100 text-teal-700 border-0 text-[10px]">과목연결 {previewData.summary?.subjectLinked ?? 0}</Badge>
                <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">연결필요 {previewData.summary?.studentMatchFailed ?? 0}</Badge>
              </div>

              {/* 개별 일정 미리보기 */}
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {(previewData.previews || []).map((p, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${p.status.includes("⚠") ? "border-amber-200 bg-amber-50/50" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-gray-500 mb-1">{p.googleTitle}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-gray-400">날짜/시간</p>
                            <p className="text-gray-700">{p.classDate} {p.startTime}{p.endTime ? `~${p.endTime}` : ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">학생</p>
                            <p className="text-gray-700">
                              {p.studentMatch.matched_names?.length > 0 ? (
                                <span className="text-green-600">{p.studentMatch.matched_names.join(", ")} ✓</span>
                              ) : (
                                <span className="text-amber-600">{p.parsed.student_name || "이름 없음"} {p.studentMatch.ambiguous ? "(동명이인)" : "(연결 필요)"}</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">학교/학년</p>
                            <p className="text-gray-700">{p.parsed.school || "-"} / {p.parsed.grade || "-"}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">과목</p>
                            <p className="text-gray-700">
                              {p.subjectMatch?.subject_name ? (
                                <span className="text-green-600">{p.subjectMatch.subject_name} {p.subjectMatch.subject_id ? "✓" : ""}</span>
                              ) : "-"}
                            </p>
                          </div>
                        </div>
                        {p.studentMatch.reason && p.studentMatch.reason !== "정상 연결" && (
                          <p className="text-[10px] text-amber-600 mt-1">{p.studentMatch.reason}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Badge className={`text-[10px] border-0 ${p.status.includes("✓") ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {p.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                {(!previewData.previews || previewData.previews.length === 0) && (
                  <p className="text-center text-gray-400 py-8">미리볼 일정이 없습니다.</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 동기화 진단 다이얼로그 */}
      <Dialog open={showDiagDialog} onOpenChange={setShowDiagDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-purple-600" />
              Google Calendar 동기화 진단
            </DialogTitle>
          </DialogHeader>
          {diagnosing ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Google Calendar 일정을 비교하는 중...
            </div>
          ) : diagnostics ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">최근 Google 일정 {diagnostics.length}개와 사이트 일정을 비교한 결과입니다.</p>
              {diagnostics.map((d, i) => (
                <div key={i} className={`border rounded-lg p-3 ${d.issues.length > 0 ? "border-red-200 bg-red-50/50" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{d.googleTitle || "(제목 없음)"}</p>
                      {d.parsed && d.parsed.student_name && (
                        <p className="text-[10px] text-gray-500 mt-0.5">파싱: {d.parsed.student_name} / {d.parsed.school || "-"} / {d.parsed.grade || "-"} / {d.parsed.subject_code || "-"}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-1.5 text-xs">
                        <div>
                          <p className="text-gray-400 font-medium">Google</p>
                          <p className="text-gray-600">{d.googleDate} {d.googleStart}{d.googleEnd ? `~${d.googleEnd}` : ""}</p>
                          {d.isAllDay && <p className="text-gray-400">종일</p>}
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium">사이트</p>
                          {d.siteExists ? (
                            <>
                              <p className="text-gray-600">{d.siteDate} {d.siteStart}{d.siteEnd ? `~${d.siteEnd}` : ""}</p>
                              <p className="text-gray-500 truncate">{d.siteStudentNames.join(", ") || "학생 없음"} / {d.siteSubjectName || "과목 없음"}</p>
                            </>
                          ) : (
                            <p className="text-red-500">사이트에 없음</p>
                          )}
                        </div>
                      </div>
                      {d.studentMatch && (
                        <p className="text-xs mt-1">
                          <span className="text-gray-400">학생매칭: </span>
                          <span className={d.studentMatch.ambiguous ? "text-amber-600" : d.studentMatch.matched_names?.length > 0 ? "text-green-600" : "text-red-500"}>
                            {d.studentMatch.matched_names?.length > 0 ? d.studentMatch.matched_names.join(", ") : d.studentMatch.reason}
                          </span>
                        </p>
                      )}
                      {d.subjectMatch && (
                        <p className="text-xs">
                          <span className="text-gray-400">과목매칭: </span>
                          <span className="text-green-600">{d.subjectMatch.subject_name}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {d.issues.length === 0 ? (
                        <Badge className="bg-green-100 text-green-700 border-0 text-[10px] gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />정상
                        </Badge>
                      ) : (
                        <div className="space-y-1">
                          {d.issues.map((iss, j) => (
                            <Badge key={j} className="bg-red-100 text-red-600 border-0 text-[10px] gap-1 block">
                              <AlertTriangle className="w-2.5 h-2.5 inline mr-1" />{iss}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {diagnostics.length === 0 && (
                <p className="text-center text-gray-400 py-8">진단할 일정이 없습니다.</p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}