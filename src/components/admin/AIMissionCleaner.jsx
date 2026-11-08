import React, { useState } from "react";
import { cleanupMissions } from "@/lib/sheetsApi";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AIMissionCleaner({ missions = [], subject = "python", onChange }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const run = async () => {
    if (!missions.length) return;
    if (!window.confirm(`${missions.length}개 미션의 설명, 학생용 시작 코드, 관리자용 정답 코드를 AI로 생성합니다.\n결과를 확인한 후 단원 저장을 눌러야 반영됩니다. 계속하시겠습니까?`)) return;
    setBusy(true); setMessage("");
    try {
      const result = await cleanupMissions(missions, subject);
      if (!result || !Array.isArray(result.cleaned_missions) || result.cleaned_missions.length !== missions.length) throw new Error(result?.error || "AI 응답 형식이 올바르지 않습니다.");
      const merged = missions.map((m, i) => {
        const a = result.cleaned_missions[i];
        if (!a || typeof a !== "object" || !String(a.description || "").trim() || !String(a.default_code || "").trim() || !String(a.answer_code || "").trim()) throw new Error(`${i+1}번 미션의 생성 내용이 불완전합니다.`);
        return { ...m, title: String(a.title || m.title || ""), description: String(a.description), default_code: String(a.default_code), answer_code: String(a.answer_code) };
      });
      onChange(merged);
      setMessage(`${merged.length}개 미션 정리 완료 · 단원 저장 필요`);
    } catch (err) {
      setMessage(`AI 정리 실패: ${err?.message || "알 수 없는 오류"}`);
      toast({ title: "미션 AI 정리 실패", description: err?.message || "다시 시도해주세요.", variant: "destructive" });
    } finally { setBusy(false); }
  };
  return <div className="flex flex-col gap-1"><Button type="button" size="sm" variant="outline" onClick={run} disabled={busy || !missions.length} className="h-7 text-xs bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"><Wand2 className="w-3 h-3 mr-1" />{busy ? "AI 정리 중..." : "Mission AI 자동 정리"}</Button>{message && <span className="text-xs whitespace-pre-wrap text-purple-700">{message}</span>}</div>;
}
