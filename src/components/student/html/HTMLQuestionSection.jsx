import React from "react";
import { CheckCircle, ChevronUp, ChevronDown, Check, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HTMLQuestionSection({
  unit, prog, qTotal,
  openQuestionIdx, setOpenQuestionIdx,
  questionIdx, setQuestionIdx,
  selectedAnswer, setSelectedAnswer,
  questionResult, setQuestionResult,
  onSubmit, onNext,
}) {
  if (qTotal === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Question이 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">정답 {(prog.completed_question_ids || []).length}/{qTotal}개 완료</p>
      {unit.questions.map((q, i) => {
        const isCompleted = (prog.completed_question_ids || []).includes(i);
        const isOpen = openQuestionIdx === i;
        const qNum = q.number || i + 1;
        const thisAnswer = (isOpen && questionIdx === i) ? selectedAnswer : null;
        const thisResult = (isOpen && questionIdx === i) ? questionResult : null;

        return (
          <div key={i} className={`border rounded-xl overflow-hidden transition-all ${isCompleted ? "border-green-300" : "border-gray-200"}`}>
            <div
              className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${isOpen ? (isCompleted ? "bg-green-50" : "bg-orange-50") : "bg-gray-50 hover:bg-gray-100"}`}
              onClick={() => {
                if (isOpen) {
                  setOpenQuestionIdx(null);
                } else {
                  setOpenQuestionIdx(i);
                  setQuestionIdx(i);
                  setSelectedAnswer(null);
                  setQuestionResult(null);
                }
              }}
            >
              <div className="flex items-center gap-2">
                {isCompleted
                  ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <span className="w-4 h-4 flex-shrink-0" />}
                <span className={`font-bold text-sm ${isCompleted ? "text-green-700" : "text-gray-800"}`}>
                  Question {String(qNum).padStart(2, "0")}.
                </span>
                <span className="text-sm text-gray-600 truncate max-w-[200px] sm:max-w-xs">
                  {q.question?.slice(0, 40)}{(q.question?.length || 0) > 40 ? "…" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isCompleted && <span className="text-xs text-green-600 font-semibold hidden sm:inline">✅ 완료</span>}
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            {isOpen && (
              <div className="p-5 border-t border-gray-100 space-y-4">
                <p className="text-gray-900 font-semibold text-base">{q.question}</p>

                {(q.type === "multiple" || !q.type) && (
                  <div className="space-y-2">
                    {(q.options || []).filter(Boolean).map((opt, oi) => (
                      <button key={oi} onClick={() => { setSelectedAnswer(opt); setQuestionResult(null); }}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${thisAnswer === opt ? "border-orange-500 bg-orange-50 text-orange-700 font-medium" : "border-gray-200 hover:border-gray-300"}`}>
                        {oi + 1}. {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === "ox" && (
                  <div className="flex gap-3">
                    {["O", "X"].map(v => (
                      <button key={v} onClick={() => { setSelectedAnswer(v); setQuestionResult(null); }}
                        className={`flex-1 py-4 rounded-xl text-2xl font-bold border-2 transition-colors ${thisAnswer === v ? (v === "O" ? "border-green-500 bg-green-50 text-green-600" : "border-red-500 bg-red-50 text-red-600") : "border-gray-200"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                )}

                {(q.type === "fill" || q.type === "predict") && (
                  <input
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="정답을 입력하세요..." value={thisAnswer || ""}
                    onChange={e => { setSelectedAnswer(e.target.value); setQuestionResult(null); }}
                  />
                )}

                {thisResult !== null && (
                  <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${thisResult ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                    {thisResult ? <Check className="w-4 h-4 mt-0.5" /> : <X className="w-4 h-4 mt-0.5" />}
                    <div>
                      {thisResult ? "정답입니다! 🎉" : `오답입니다. 정답: ${q.answer}`}
                      {q.explanation && <p className="text-xs mt-1 opacity-80">{q.explanation}</p>}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={onSubmit} disabled={!thisAnswer} className="bg-orange-500 hover:bg-orange-600">제출</Button>
                  {thisResult === true && (
                    <Button onClick={() => { setOpenQuestionIdx(null); onNext(); }} variant="outline" className="gap-2">
                      {i + 1 < qTotal ? "다음 문제" : "Mission으로"} <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}