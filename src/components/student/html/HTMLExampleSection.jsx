import React from "react";
import { CheckCircle, Code2, ChevronUp, ChevronDown } from "lucide-react";
import ExamplePractice from "@/components/html/ExamplePractice";

export default function HTMLExampleSection({
  unit, prog, exTotal,
  openExampleIdx, setOpenExampleIdx,
  exampleStates,
  onSubmit,
}) {
  if (exTotal === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">예제 코드가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">완료 {(prog.completed_example_ids || []).length}/{exTotal}개</p>
      {unit.example_codes.map((example, i) => {
        const isCompleted = (prog.completed_example_ids || []).includes(i);
        const isOpen = openExampleIdx === i;
        const exState = exampleStates[i] || {};
        const curResult = exState.result || null;

        return (
          <div key={i} className={`border rounded-xl overflow-hidden transition-all ${isCompleted ? "border-green-300" : "border-gray-200"}`}>
            <div
              className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${isOpen ? (isCompleted ? "bg-green-50" : "bg-orange-50") : "bg-gray-50 hover:bg-gray-100"}`}
              onClick={() => setOpenExampleIdx(isOpen ? null : i)}
            >
              <div className="flex items-center gap-2">
                {isCompleted
                  ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <Code2 className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                <span className={`font-bold text-sm ${isCompleted ? "text-green-700" : "text-gray-800"}`}>
                  예제 {String(i + 1).padStart(2, "0")}.
                </span>
                {example.description && (
                  <span className="text-sm text-gray-600 truncate max-w-[200px] sm:max-w-xs">
                    {example.description.slice(0, 40)}{example.description.length > 40 ? "…" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isCompleted && <span className="text-xs text-green-600 font-semibold hidden sm:inline">✅ 완료</span>}
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>
            {isOpen && (
              <div className="p-5 border-t border-gray-100">
                <ExamplePractice
                  key={`${unit.id}_${i}`}
                  example={example}
                  exampleIdx={i}
                  exTotal={exTotal}
                  completedIds={prog.completed_example_ids || []}
                  onSubmit={(result) => onSubmit(result, i)}
                  onNext={() => {
                    setOpenExampleIdx(null);
                    const nextOpen = i + 1 < exTotal ? i + 1 : null;
                    setTimeout(() => setOpenExampleIdx(nextOpen), 100);
                  }}
                  result={curResult}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}