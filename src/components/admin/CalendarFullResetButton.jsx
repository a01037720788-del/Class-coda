import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, AlertTriangle, Loader2, RotateCcw, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addMonths, subMonths } from "date-fns";

const RANGE_PRESETS = [
  { key: "this_year", label: "올해 전체" },
  { key: "1_3", label: "최근 1개월 ~ 이후 3개월" },
  { key: "3_12", label: "최근 3개월 ~ 이후 12개월" },
  { key: "custom", label: "직접 기간 설정" },
];

function getRangePreset(preset, refDate = new Date()) {
  switch (preset) {
    case "this_year":
      return { from: `${refDate.getFullYear()}-01-01`, to: `${refDate.getFullYear()}-12-31` };
    case "1_3":
      return { from: format(subMonths(refDate, 1), "yyyy-MM-dd"), to: format(addMonths(refDate, 3), "yyyy-MM-dd") };
    case "3_12":
      return { from: format(subMonths(refDate, 3), "yyyy-MM-dd"), to: format(addMonths(refDate, 12), "yyyy-MM-dd") };
    default:
      return null;
  }
}

export default function CalendarFullResetButton({ onSynced, disabled }) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [resetType, setResetType] = useState(null); // "siteOnly" | "fullReset" | "googleOnly"
  const [step, setStep] = useState(1);
  const [rangePreset, setRangePreset] = useState("this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const getRange = () => {
    if (rangePreset === "custom") {
      if (!customFrom || !customTo) return null;
      return { from: customFrom, to: customTo };
    }
    return getRangePreset(rangePreset);
  };

  const openDialog = (type) => {
    setResetType(type);
    setStep(1);
    setRangePreset("this_year");
    setCustomFrom("");
    setCustomTo("");
    setResult(null);
    setShowDialog(true);
  };

  const handleReset = async () => {
    const isSiteOnly = resetType === "siteOnly";
    const isGoogleOnly = resetType === "googleOnly";
    const needsRange = !isSiteOnly;
    const range = needsRange ? getRange() : null;
    if (needsRange && !range) {
      toast({ title: "범위 선택", description: "가져올 기간을 선택해주세요.", variant: "destructive" });
      return;
    }
    setSyncing(true);
    setResult(null);
    try {
      const payload = isSiteOnly
        ? { mode: "siteOnlyReset" }
        : isGoogleOnly
        ? { mode: "googleOnlyReset", range }
        : { mode: "fullReset", range };
      const res = await base44.functions.invoke("syncGoogleCalendar", payload);
      const d = res.data;
      if (d && d.success) {
        setResult(d);
        if (isSiteOnly) {
          toast({
            title: "사이트 캘린더 초기화 완료",
            description: `일정 ${d.deletedSchedules}개, 출석연결 ${d.deletedCss}개 삭제 · 검증: ${d.remainingSchedules}건 남음`,
          });
        } else if (isGoogleOnly) {
          toast({
            title: "Google 일정 초기화 후 재가져오기 완료",
            description: `Google 일정 삭제 ${d.deletedSchedules} · 가져옴 ${d.totalFetched} · 새 ${d.created} · 학생연결 ${d.studentLinked}`,
          });
        } else {
          toast({
            title: "초기화 후 Google 재가져오기 완료",
            description: `삭제 ${d.deletedSchedules} · 가져옴 ${d.totalFetched} · 새 ${d.created} · 학생연결 ${d.studentLinked}`,
          });
        }
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

  const titleText =
    resetType === "siteOnly" ? "사이트 캘린더 초기화"
    : resetType === "googleOnly" ? "Google 일정 초기화 후 재가져오기"
    : "초기화 후 Google 다시 가져오기";

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => openDialog("siteOnly")} disabled={disabled || syncing}
          className="text-xs gap-1 h-7 text-red-600 border-red-200 hover:bg-red-50">
          <Trash2 className="w-3 h-3" />
          {syncing && resetType === "siteOnly" ? "초기화 중..." : "사이트 캘린더 초기화"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => openDialog("fullReset")} disabled={disabled || syncing}
          className="text-xs gap-1 h-7 text-orange-600 border-orange-200 hover:bg-orange-50">
          <RotateCcw className="w-3 h-3" />
          {syncing && resetType === "fullReset" ? "실행 중..." : "초기화 후 Google 다시 가져오기"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => openDialog("googleOnly")} disabled={disabled || syncing}
          className="text-xs gap-1 h-7 text-blue-600 border-blue-200 hover:bg-blue-50">
          <RefreshCw className="w-3 h-3" />
          {syncing && resetType === "googleOnly" ? "실행 중..." : "Google 일정만 초기화"}
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { if (!syncing) setShowDialog(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {titleText}
            </DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${result.verified !== false ? "bg-green-50" : "bg-red-50"}`}>
                {result.verified !== false ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <p className={`text-sm font-semibold ${result.verified !== false ? "text-green-700" : "text-red-700"}`}>
                  {result.verified !== false ? "초기화 완료 (검증됨)" : "초기화 검증 실패"}
                </p>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between p-2 bg-red-50 rounded">
                  <span className="text-gray-600">기존 일정 삭제</span>
                  <span className="font-semibold text-red-600">{result.deletedSchedules || 0}개</span>
                </div>
                <div className="flex justify-between p-2 bg-red-50 rounded">
                  <span className="text-gray-600">출석 연결 삭제</span>
                  <span className="font-semibold text-red-600">{result.deletedCss || 0}개</span>
                </div>
                {result.remainingSchedules !== undefined && (
                  <div className="flex justify-between p-2 bg-amber-50 rounded">
                    <span className="text-gray-600">남은 일정 (검증)</span>
                    <span className="font-semibold text-amber-600">{result.remainingSchedules}건</span>
                  </div>
                )}
                {result.remainingCss !== undefined && (
                  <div className="flex justify-between p-2 bg-amber-50 rounded">
                    <span className="text-gray-600">남은 출석연결 (검증)</span>
                    <span className="font-semibold text-amber-600">{result.remainingCss}건</span>
                  </div>
                )}
                {result.totalFetched !== undefined && (
                  <>
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span className="text-gray-600">Google 일정 조회</span>
                      <span className="font-semibold text-blue-600">{result.totalFetched}개</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-50 rounded">
                      <span className="text-gray-600">새 일정 생성</span>
                      <span className="font-semibold text-green-600">{result.created}개</span>
                    </div>
                    <div className="flex justify-between p-2 bg-purple-50 rounded">
                      <span className="text-gray-600">학생 자동 연결</span>
                      <span className="font-semibold text-purple-600">{result.studentLinked}개</span>
                    </div>
                    <div className="flex justify-between p-2 bg-red-50 rounded">
                      <span className="text-gray-600">학생 연결 필요</span>
                      <span className="font-semibold text-red-600">{result.studentMatchFailed}개</span>
                    </div>
                    <div className="flex justify-between p-2 bg-teal-50 rounded">
                      <span className="text-gray-600">과목 자동 연결</span>
                      <span className="font-semibold text-teal-600">{result.subjectLinked || 0}개</span>
                    </div>
                    <div className="flex justify-between p-2 bg-cyan-50 rounded">
                      <span className="text-gray-600">출석연결 새로 생성</span>
                      <span className="font-semibold text-cyan-600">{result.cssCreated || 0}개</span>
                    </div>
                  </>
                )}
              </div>
              <Button size="sm" className="w-full" onClick={() => setShowDialog(false)}>
                확인
              </Button>
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-700 mb-1">⚠ 주의</p>
                <p className="text-xs text-red-600">
                  {resetType === "siteOnly"
                    ? "현재 사이트의 모든 수업 일정을 삭제합니다."
                    : resetType === "googleOnly"
                    ? "Google Calendar에서 가져온 일정만 삭제 후 다시 가져옵니다. 사이트에서 수동 생성한 일정은 보존됩니다."
                    : "현재 사이트의 모든 수업 일정을 삭제한 후, Google Calendar에서 일정을 다시 가져옵니다."}
                </p>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>삭제 대상:</p>
                <ul className="list-disc list-inside text-gray-400 ml-2">
                  {resetType === "googleOnly" ? (
                    <>
                      <li>ClassSchedule (calendar_source=google 일정만)</li>
                      <li>ClassScheduleStudent (Google 일정의 출석 연결)</li>
                    </>
                  ) : (
                    <>
                      <li>ClassSchedule (모든 수업 일정)</li>
                      <li>ClassScheduleStudent (출석 연결 데이터)</li>
                      <li>기존 출석 기록도 함께 삭제됩니다</li>
                    </>
                  )}
                </ul>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <p className="text-xs text-green-700 font-medium">
                  ✓ 학생 / 회원 / 과목 / 학습 데이터는 삭제되지 않습니다.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDialog(false)}>
                  취소
                </Button>
                <Button size="sm" className="flex-1 bg-red-500 hover:bg-red-600" onClick={() => setStep(2)}>
                  계속
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {(resetType === "fullReset" || resetType === "googleOnly") && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-2 block">Google Calendar 가져올 기간</label>
                  <div className="space-y-1.5">
                    {RANGE_PRESETS.map(p => (
                      <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fullResetRange"
                          value={p.key}
                          checked={rangePreset === p.key}
                          onChange={(e) => setRangePreset(e.target.value)}
                          className="w-4 h-4 accent-blue-500"
                        />
                        <span className="text-xs text-gray-700">{p.label}</span>
                      </label>
                    ))}
                  </div>
                  {rangePreset === "custom" && (
                    <div className="flex items-center gap-2 mt-2">
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
                </div>
              )}

              {resetType === "siteOnly" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">
                    사이트의 모든 수업 일정과 출석 연결이 삭제됩니다.<br />
                    삭제 후에는 Google Calendar에서 다시 가져오기 전까지 일정이 비어 있습니다.
                  </p>
                </div>
              )}

              {resetType === "googleOnly" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    Google Calendar에서 가져온 일정만 삭제 후 다시 가져옵니다.<br />
                    사이트에서 수동으로 생성한 일정은 보존됩니다.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep(1)} disabled={syncing}>
                  뒤로
                </Button>
                <Button size="sm" className="flex-1 bg-red-500 hover:bg-red-600" onClick={handleReset} disabled={syncing}>
                  {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                  {syncing ? "실행 중..." : titleText}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}