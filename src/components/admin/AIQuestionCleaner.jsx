/**
 * AIQuestionCleaner — 과목별 AI Question 자동 정리 버튼
 * 기존 PythonUnitEditor 내 handleAutoCleanup 로직을 공통 컴포넌트로 분리
 */
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

/** 객관식 AI 정답을 CODA 채점 형식(1부터 시작하는 보기 번호)으로 변환합니다. */
function normalizeChoiceAnswer(question) {
  if (question.type !== "객관식" || !Array.isArray(question.options)) return question;
  const options = question.options;
  const answer = String(question.answer ?? "").trim();
  const count = options.length;
  if (!count || !answer) return question;

  // 1, "2", "2번", "②", "2. 보기 내용" 등 번호 형태
  const circled = "①②③④⑤⑥⑦⑧⑨⑩";
  const circledIndex = circled.indexOf(answer);
  if (circledIndex >= 0 && circledIndex < count) {
    return { ...question, answer: String(circledIndex + 1) };
  }
  const numberMatch = answer.match(/^(?:정답\s*[:：]\s*)?(\d+)(?:\s*번|\s*[.)])?(?:\s+.*)?$/);
  if (numberMatch) {
    const n = Number(numberMatch[1]);
    if (Number.isInteger(n) && n >= 1 && n <= count) {
      return { ...question, answer: String(n) };
    }
  }

  // AI가 정답을 보기 문장으로 반환한 경우: 공백 정규화 후 유일하게 일치하는 보기 찾기
  const normalizeText = (v) => String(v ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  const stripPrefix = (v) => normalizeText(v).replace(/^(?:정답\s*[:：]\s*)?(?:[①②③④⑤⑥⑦⑧⑨⑩]|\d+\s*[.)번])\s*/, "");
  const target = stripPrefix(answer);
  const matches = options.map((option, index) => ({ index, text: stripPrefix(option) }))
    .filter((item) => item.text === target);
  if (matches.length === 1) return { ...question, answer: String(matches[0].index + 1) };

  // 잘못된 정답을 조용히 저장하지 않고 상위 호출자에게 검증 오류로 알림
  throw new Error(`객관식 정답을 보기 번호로 변환할 수 없습니다: ${answer}`);
}

export default function AIQuestionCleaner({ subject = "python", questions = [], onChange }) {
  const [cleaning, setCleaning] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const normalize = (q) => ({
    code_block: "", expected_output: "", code_items: [], options: [],
    pairs: [], answer: "", explanation: "", difficulty: "", ...q,
  });

  const handleCleanup = async () => {
    if (!questions.length) return;
    if (!window.confirm(`${questions.length}개 문제를 AI로 자동 정리합니다.\n기존 데이터가 변경됩니다. 계속하시겠습니까?`)) return;

    setCleaning(true);
    setSummary("");
    setError("");
    const original = questions.map(normalize);

    try {
      const raw = await cleanupQuestions(
        original,
        SUBJECT_CONTEXT[subject] || SUBJECT_CONTEXT.python
      );
      if (!raw || !Array.isArray(raw.cleaned_questions) || raw.cleaned_questions.length !== original.length) {
        // 서버가 원본을 돌려줬더라도 형식 불일치 → 원본 유지
        const errMsg = raw?.error || "AI 응답 형식 오류";
        setError(`AI 자동 정리에 실패했습니다.\n원인: ${errMsg}`);
        toast({ title: "AI 정리 실패", description: errMsg, variant: "destructive" });
        return;
      }

      const cleaned = raw.cleaned_questions;
      const validated = cleaned.map((q, idx) => ({
        ...normalize(q),
        number: idx + 1,
        question: q.question || original[idx]?.question || "",
        type: q.type || original[idx]?.type || "객관식",
        answer: q.answer ?? original[idx]?.answer ?? "",
      }));

      const normalizedAnswers = validated.map(normalizeChoiceAnswer);
      onChange(normalizedAnswers);
      setSummary(raw.summary || `${normalizedAnswers.length}개 문제 정리 완료`);
    } catch (err) {
      // 실패 시 반드시 원본 유지
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "알 수 없는 오류";
      console.error("AIQuestionCleaner 오류:", err);
      setError(`AI 자동 정리에 실패했습니다.\n원인: ${msg}`);
      toast({ title: "AI 정리 실패", description: msg, variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleCleanup}
        disabled={cleaning || !questions.length}
        className="h-7 text-xs bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
      >
        <Wand2 className="w-3 h-3 mr-1" />
        {cleaning ? "AI 정리 중..." : "AI 자동 정리"}
      </Button>
      {summary && (
        <span className="text-xs text-purple-600 bg-purple-50 rounded px-2 py-0.5">✅ {summary}</span>
      )}
      {error && (
        <span className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 whitespace-pre-wrap">{error}</span>
      )}
    </div>
  );
}