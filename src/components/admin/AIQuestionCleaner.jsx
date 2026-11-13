/** AIQuestionCleaner — AI 문제 정리 및 객관식 보기/정답 복구 */
import React, { useState } from "react";
import { cleanupQuestions } from "@/lib/sheetsApi";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SUBJECT_CONTEXT = {
  python: "Python 3 교육 플랫폼용 문제. print/input/for/while/list/dict 등 Python 특성 반영",
  cpp: "C++17 교육 플랫폼용 문제. cout/cin/for/vector/포인터 등 C++ 특성 반영",
  html: "HTML/CSS/JavaScript 교육 플랫폼용 문제. 태그 역할, CSS 선택자, 화면 결과 예측 등 반영",
  java: "Java 17 교육 플랫폼용 문제. System.out.println/Scanner/class/ArrayList 등 Java 특성 반영",
};

const cleanText = (value) => String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
const stripPrefix = (value) => cleanText(value).replace(/^(?:정답\s*[:：]\s*)?(?:[①②③④⑤⑥⑦⑧⑨⑩]|\d+\s*[.)번])\s*/, "");

function choiceIndex(answer, options) {
  const text = cleanText(answer);
  const circled = "①②③④⑤⑥⑦⑧⑨⑩";
  const ci = circled.indexOf(text);
  if (ci >= 0 && ci < options.length) return ci;
  const numbered = text.match(/^(?:정답\s*[:：]\s*)?(\d+)(?:\s*번|\s*[.)])?$/);
  if (numbered) {
    const n = Number(numbered[1]);
    if (n >= 1 && n <= options.length) return n - 1;
  }
  const target = stripPrefix(answer);
  const matches = options.map((v, i) => stripPrefix(v) === target ? i : -1).filter(i => i >= 0);
  return matches.length === 1 ? matches[0] : -1;
}

function validateQuestion(original, candidate, index) {
  const q = { ...original, ...candidate, number: index + 1 };
  // AI가 문제 유형을 임의로 바꾸지 못하게 합니다.
  q.type = original.type || candidate.type || "객관식";
  if (q.type !== "객관식") {
    q.answer = original.answer ?? "";
    return q;
  }
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(v => typeof v !== "string" || !v.trim())) {
    throw new Error(`${index + 1}번 문제: AI가 유효한 객관식 보기 4개를 만들지 못했습니다.`);
  }
  if (new Set(q.options.map(stripPrefix)).size !== 4) {
    throw new Error(`${index + 1}번 문제: 객관식 보기에 중복이 있습니다.`);
  }
  const idx = choiceIndex(q.answer, q.options);
  if (idx < 0) throw new Error(`${index + 1}번 문제: AI가 올바른 정답 번호를 반환하지 않았습니다.`);
  q.answer = String(idx + 1);
  return q;
}

export default function AIQuestionCleaner({ subject = "python", questions = [], onChange }) {
  const [cleaning, setCleaning] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();
  const normalize = (q) => ({ code_block: "", expected_output: "", code_items: [], options: [], pairs: [], answer: "", explanation: "", difficulty: "", ...q });

  const handleCleanup = async () => {
    if (!questions.length) return;
    if (!window.confirm(`${questions.length}개 문제를 AI로 자동 정리합니다.\n객관식 보기와 정답 번호도 자동 복구될 수 있습니다. 계속하시겠습니까?`)) return;
    setCleaning(true);
    setSummary("");
    setError("");
    const original = questions.map(normalize);
    try {
      const raw = await cleanupQuestions(original, SUBJECT_CONTEXT[subject] || SUBJECT_CONTEXT.python);
      if (!raw || !Array.isArray(raw.cleaned_questions) || raw.cleaned_questions.length !== original.length) {
        throw new Error(raw?.message || raw?.error || "AI 응답 형식 오류");
      }
      const validated = raw.cleaned_questions.map((q, i) => validateQuestion(original[i], q, i));
      // 원본/수정본 확인 후 일괄 적용. 확인을 취소하면 데이터는 바뀌지 않습니다.
      const repaired = validated.filter((q, i) => q.type === "객관식" && (JSON.stringify(q.options) !== JSON.stringify(original[i].options) || String(q.answer) !== String(original[i].answer))).length;
      if (!window.confirm(`AI 정리 완료: ${validated.length}개 문제\n객관식 보기/정답 변경: ${repaired}개\n\n결과를 적용하시겠습니까?`)) return;
      onChange(validated);
      setSummary(raw.summary || `${validated.length}개 문제 정리 완료`);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "알 수 없는 오류";
      console.error("AIQuestionCleaner 오류:", err);
      setError(`AI 자동 정리에 실패했습니다.\n원인: ${msg}`);
      toast({ title: "AI 정리 실패", description: msg, variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <Button type="button" size="sm" variant="outline" onClick={handleCleanup}
        disabled={cleaning || !questions.length}
        className="h-7 text-xs bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100">
        <Wand2 className="w-3 h-3 mr-1" />{cleaning ? "AI 정리 중..." : "AI 자동 정리"}
      </Button>
      {summary && <span className="text-xs text-purple-600 bg-purple-50 rounded px-2 py-0.5">✅ {summary}</span>}
      {error && <span className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 whitespace-pre-wrap">{error}</span>}
    </div>
  );
}
