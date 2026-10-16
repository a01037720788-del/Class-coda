import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Calendar as CalendarIcon, Loader2, AlertCircle, CheckCircle2, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function GoogleCalendarSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
        setPendingId(d.selected?.id || null);
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
  useEffect(() => { if (status?.connected) loadCalendars(); }, [status?.connected, loadCalendars]);

  const handleSave = async () => {
    if (!pendingId) {
      toast({ title: "캘린더를 선택해주세요.", variant: "destructive" });
      return;
    }
    const cal = calendars.find(c => c.id === pendingId);
    if (!cal) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke("googleCalendars", {
        action: "select",
        calendar_id: pendingId,
        calendar_title: cal.title,
      });
      const d = res.data;
      if (d && d.selected) {
        setSelected(d.selected);
        toast({ title: "캘린더 선택 저장 완료", description: `"${cal.title}"(이)가 수업 일정 캘린더로 설정되었습니다.` });
      } else if (d?.error) {
        toast({ title: "저장 실패", description: d.error, variant: "destructive" });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "저장에 실패했습니다.";
      toast({ title: "저장 실패", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncGoogleCalendar", { mode: "import" });
      const d = res.data;
      if (d && d.success) {
        toast({
          title: "Google 일정 불러오기 완료",
          description: `새 일정 ${d.created}건 · 업데이트 ${d.updated}건 · 취소 ${d.cancelled}건`,
        });
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

  const connected = status?.connected;
  const hasChange = pendingId && pendingId !== (selected?.id || null);

  return (
    <div className="space-y-5">
      {/* 연결 상태 */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarIcon className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">연결 상태:</span>
        {checking ? (
          <span className="flex items-center gap-1 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" />확인 중...</span>
        ) : connected ? (
          <Badge className="bg-green-100 text-green-700 border-0 gap-1">
            <CheckCircle2 className="w-3 h-3" />연결됨{status?.calendar ? ` (${status.calendar})` : ""}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-gray-500 border-gray-300">
            <AlertCircle className="w-3 h-3" />미연결
          </Badge>
        )}
        <Button size="sm" variant="ghost" onClick={checkStatus} disabled={checking} className="text-xs h-7 gap-1">
          <RefreshCw className="w-3 h-3" />새로고침
        </Button>
      </div>

      {!connected && !checking && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
          Google Calendar 연결이 없습니다. 학원 관리자가 Base44 설정에서 Google Calendar 연동을 먼저 진행해야 합니다.
        </div>
      )}

      {/* 캘린더 선택 */}
      {connected && (
        <>
          <div>
            <h4 className="text-sm font-bold text-gray-800 mb-1">수업 일정으로 사용할 캘린더 선택</h4>
            <p className="text-xs text-gray-500 mb-3">
              연결된 Google 계정의 캘린더 목록 중 수업 일정을 불러올 캘린더 하나를 선택하세요. 선택한 캘린더의 일정이 수업 캘린더에 동기화됩니다.
            </p>

            {loadingCalendars ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
                <Loader2 className="w-4 h-4 animate-spin" />캘린더 목록을 불러오는 중...
              </div>
            ) : calendars.length === 0 ? (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-400 text-center">
                사용 가능한 캘린더가 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {calendars.map(c => {
                  const isSelected = pendingId === c.id;
                  const isCurrent = selected?.id === c.id;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="googleCalendar"
                        checked={isSelected}
                        onChange={() => setPendingId(c.id)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800 truncate">{c.title}</span>
                          {c.primary && (
                            <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] gap-0.5">
                              <Star className="w-2.5 h-2.5" />기본
                            </Badge>
                          )}
                          {isCurrent && (
                            <Badge className="bg-green-100 text-green-700 border-0 text-[10px] gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />현재 사용 중
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">{c.id}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 액션 */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button onClick={handleSave} disabled={saving || !pendingId || !hasChange}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? "저장 중..." : "선택한 캘린더 저장"}
            </Button>
            <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
              <Download className="w-4 h-4" />
              {syncing ? "불러오는 중..." : "선택한 캘린더에서 일정 불러오기"}
            </Button>
            {hasChange && (
              <span className="text-xs text-amber-600">변경사항이 저장되지 않았습니다.</span>
            )}
          </div>

          {selected && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <span className="font-semibold">현재 수업 일정 캘린더:</span> {selected.title || selected.id}
            </div>
          )}
        </>
      )}
    </div>
  );
}