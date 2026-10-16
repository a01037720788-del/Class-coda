/**
 * AIFillDescription — 기존 Unit 데이터(제목, 예제, Question, Mission)를 참고하여
 * 비어 있는 학습 목표 / 개념 설명 / 핵심 요약만 AI로 생성하는 컴포넌트.
 * 기존 Example/Question/Mission을 덮어쓰지 않는다.
 *
 * props:
 *   subject: "cpp" | "python" | ...
 *   currentForm: 현재 폼 데이터
 *   onApply: (data) => void  — { learning_objectives, concept_sections, summary } 전달
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, Wand2, CheckCircle2, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { computeLearningScope, buildScopePromptSection, validateCode } from "@/lib/learningScope";

export default function AIFillDescription({ subject = "cpp", currentForm, onApply, previousUnits = [], currentUnitNumber = 1 }) {
  const [open, setOpen] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [scopeWarnings, setScopeWarnings] = useState(null);
  const { toast } = useToast();

  // 학습 범위 계산
  const scope = computeLearningScope(previousUnits, currentUnitNumber, currentForm?.title || "", subject, []);
  const scopeSection = buildScopePromptSection(scope);

  const handleOpen = () => {
    setOpen(true);
    setResult(null);
    setError(null);
    setScopeWarnings(null);
    setExtraPrompt("");
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setError(null);
    setScopeWarnings(null);
    setExtraPrompt("");
  };

  // 기존 데이터 요약 — AI에게 참고 자료로 제공
  const buildContextSummary = (form) => {
    const parts = [];
    parts.push(`Unit 제목: ${form.title || "(없음)"}`);
    if (form.subtitle) parts.push(`부제목: ${form.subtitle}`);

    const examples = form.example_codes || [];
    if (examples.length > 0) {
      parts.push(`\n예제 코드 (${examples.length}개):`);
      examples.slice(0, 5).forEach((ex, i) => {
        parts.push(`  예제 ${i + 1}: ${ex.description || ex.filename || ""}`);
        if (ex.code) parts.push(`    코드:\n${ex.code.slice(0, 300)}`);
      });
    }

    const questions = form.questions || [];
    if (questions.length > 0) {
      parts.push(`\nQuestion (${questions.length}개):`);
      questions.slice(0, 5).forEach((q, i) => {
        parts.push(`  Q${i + 1}: ${q.question || ""}`);
        if (q.answer) parts.push(`    정답: ${q.answer}`);
      });
    }

    const missions = form.missions || [];
    if (missions.length > 0) {
      parts.push(`\nMission (${missions.length}개):`);
      missions.slice(0, 5).forEach((m, i) => {
        parts.push(`  M${i + 1}: ${m.title || m.description || ""}`);
      });
    }

    return parts.join("\n");
  };

  const handleGenerate = async () => {
    if (!currentForm?.title?.trim()) {
      toast({ title: "오류", description: "Unit 제목이 있어야 설명을 생성할 수 있습니다.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    setScopeWarnings(null);
    try {
      const contextSummary = buildContextSummary(currentForm);
      const prompt = `다음은 ${subject === "cpp" ? "C++" : subject} 학습 Unit의 기존 데이터입니다. 이 데이터를 참고하여 비어 있는 "학습 목표", "개념 설명", "핵심 요약"만 생성해주세요.

[기존 Unit 데이터]
${contextSummary}

${scopeSection}

[추가 요청사항]
${extraPrompt || "(없음)"}

[생성 규칙]
1. 학습 목표(learning_objectives): 이 Unit에서 학생이 배워야 할 핵심 목표 3~5개 (문자열 배열)
2. 개념 설명(concept_sections): 이 Unit의 핵심 개념을 설명하는 섹션들. 각 섹션은 {title, lines[], code_example} 구조. 기존 예제 코드의 내용을 참고하되, 허용된 학습 범위 내의 문법만 사용.
3. 핵심 요약(summary): 이 Unit의 핵심 요약 3~5개 (문자열 배열)

[중요] 기존 예제 코드, Question, Mission은 생성하지 마세요. 설명 부분만 생성하세요.
[중요] code_example 코드는 위 "학습 범위"에 명시된 허용 개념만 사용하고, 금지된 문법은 절대 사용하지 마세요.

다음 JSON 형식으로 응답해주세요:
{
  "learning_objectives": ["목표1", "목표2", ...],
  "concept_sections": [
    { "title": "섹션 제목", "lines": ["설명 줄 1", "설명 줄 2", ...], "code_example": "코드 예시" }
  ],
  "summary": ["요약1", "요약2", ...]
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            learning_objectives: { type: "array", items: { type: "string" } },
            concept_sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  lines: { type: "array", items: { type: "string" } },
                  code_example: { type: "string" },
                },
              },
            },
            summary: { type: "array", items: { type: "string" } },
          },
        },
      });

      // InvokeLLM with response_json_schema returns a dict directly
      const data = res || {};
      if (!data.learning_objectives && !data.concept_sections && !data.summary) {
        throw new Error("AI 응답에서 설명 데이터를 찾을 수 없습니다.");
      }
      // 학습 범위 검증 — concept_sections의 code_example 검사
      const warnings = [];
      (data.concept_sections || []).forEach((s, i) => {
        const v = validateCode(s.code_example, scope, subject);
        v.forEach(vi => warnings.push(`개념 ${i + 1} (code_example): 아직 배우지 않은 ${vi.label} 사용 («${vi.snippet}»)»`));
      });

      setResult({
        learning_objectives: data.learning_objectives || [],
        concept_sections: data.concept_sections || [],
        summary: data.summary || [],
      });
      setScopeWarnings(warnings.length > 0 ? warnings : null);
    } catch (err) {
      const msg = err?.message || "AI 설명 생성에 실패했습니다.";
      setError(msg);
      toast({ title: "AI 설명 생성 실패", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    if (scopeWarnings && scopeWarnings.length > 0) {
      toast({ title: "학습 범위 위반", description: "금지된 문법이 code_example에 포함되어 적용할 수 없습니다. 다시 생성해주세요.", variant: "destructive" });
      return;
    }
    onApply(result);
    toast({ title: "✅ 설명 채우기 완료", description: "학습 목표, 개념 설명, 핵심 요약이 적용되었습니다." });
    handleClose();
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={handleOpen}
        className="h-8 text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white gap-1.5"
      >
        <Wand2 className="w-3.5 h-3.5" />AI로 설명 채우기
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-600" />
              AI로 설명 채우기
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-xs text-cyan-800">
              <p className="font-bold mb-1">💡 이 기능은 비어 있는 설명만 채웁니다.</p>
              <p>기존 Unit 제목, 예제 코드, Question, Mission을 참고하여 다음만 생성합니다:</p>
              <ul className="mt-1 ml-3 list-disc">
                <li>학습 목표 (learning_objectives)</li>
                <li>개념 설명 (concept_sections)</li>
                <li>핵심 요약 (summary)</li>
              </ul>
              <p className="mt-1 font-semibold text-cyan-900">기존 예제/문제/미션은 덮어쓰지 않습니다.</p>
            </div>

            {!result && (
              <>
                <div>
                  <Label className="text-xs">추가 요청사항 (선택)</Label>
                  <Textarea
                    value={extraPrompt}
                    onChange={e => setExtraPrompt(e.target.value)}
                    placeholder="예: 초등학생도 이해할 수 있도록 쉽게 설명해주세요."
                    className="h-16 text-sm mt-1"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-red-800">
                      <p className="font-bold mb-0.5">AI 설명 생성에 실패했습니다.</p>
                      <p>원인: {error}</p>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />AI가 설명을 생성하고 있습니다... (5~15초)</>
                  ) : (
                    <><Wand2 className="w-4 h-4" />설명 생성</>
                  )}
                </Button>
              </>
            )}

            {result && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-cyan-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />생성 완료! 미리보기
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setResult(null); }}>
                    다시 생성
                  </Button>
                </div>

                <div className="space-y-3 text-sm max-h-[50vh] overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {result.learning_objectives?.length > 0 && (
                    <div>
                      <p className="font-bold text-gray-800 mb-1">📋 학습 목표 ({result.learning_objectives.length}개)</p>
                      <ul className="text-xs text-gray-600 ml-3 list-disc">
                        {result.learning_objectives.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.concept_sections?.length > 0 && (
                    <div>
                      <p className="font-bold text-gray-800 mb-1">📖 개념 설명 ({result.concept_sections.length}개)</p>
                      {result.concept_sections.map((s, i) => (
                        <div key={i} className="mb-1.5">
                          <p className="text-xs font-semibold text-gray-700">{i + 1}. {s.title}</p>
                          <p className="text-xs text-gray-500 ml-3">{(s.lines || []).join(" ").slice(0, 100)}...</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.summary?.length > 0 && (
                    <div>
                      <p className="font-bold text-gray-800 mb-1">✨ 핵심 요약 ({result.summary.length}개)</p>
                      <ul className="text-xs text-gray-600 ml-3 list-disc">
                        {result.summary.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs text-yellow-800">
                  <p>⚠ 기존 학습 목표/개념 설명/요약이 있으면 <b>교체</b>됩니다. 기존 예제/문제/미션은 유지됩니다.</p>
                </div>

                {scopeWarnings && scopeWarnings.length > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 space-y-0.5">
                    <p className="font-bold flex items-center gap-1"><ShieldX className="w-3 h-3" /> 학습 범위 검사 경고</p>
                    {scopeWarnings.map((w, i) => <p key={i}>• {w}</p>)}
                    <p className="font-semibold mt-1">금지된 문법이 포함되어 적용이 차단됩니다. 다시 생성해주세요.</p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> 학습 범위 검사: 통과
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleClose} className="flex-1">취소</Button>
                  <Button type="button" onClick={handleApply} disabled={scopeWarnings && scopeWarnings.length > 0} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />적용하기
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}