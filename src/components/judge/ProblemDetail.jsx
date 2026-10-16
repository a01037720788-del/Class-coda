import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { runPython } from "@/lib/codeRunner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Send } from "lucide-react";
import JudgeResult from "@/components/judge/JudgeResult";
import StdinInput from "@/components/student/StdinInput";

const difficultyColors = {
  Bronze: "bg-amber-100 text-amber-700 border-amber-200",
  Silver: "bg-gray-100 text-gray-600 border-gray-200",
  Gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Platinum: "bg-teal-100 text-teal-700 border-teal-200",
};

export default function ProblemDetail({ problem, onBack }) {
  const [code, setCode] = useState("# 코드를 작성하세요\n");
  const [judging, setJudging] = useState(false);
  const [judgeResult, setJudgeResult] = useState(null);
  const [simpleOutput, setSimpleOutput] = useState(null);
  const [simpleRunning, setSimpleRunning] = useState(false);
  const [stdin, setStdin] = useState("");
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = code.substring(0, start) + "    " + code.substring(end);
      setCode(newVal);
      setTimeout(() => { el.selectionStart = el.selectionEnd = start + 4; }, 0);
    }
  };

  const handleSimpleRun = async () => {
    setSimpleRunning(true);
    setSimpleOutput(null);
    setJudgeResult(null);
    const data = await runPython({ code, mode: "simple", stdin });
    setSimpleOutput(data);
    setSimpleRunning(false);
  };

  const handleSubmit = async () => {
    let test_cases = [];
    if (problem.test_cases) {
      try { test_cases = JSON.parse(problem.test_cases); } catch { test_cases = []; }
    }
    // If no test cases, fall back to sample
    if (!test_cases.length && problem.sample_input) {
      test_cases = [{ input: problem.sample_input, output: problem.sample_output || "" }];
    }

    setJudging(true);
    setJudgeResult({ total: test_cases.length, passed: 0, results: [] });
    setSimpleOutput(null);

    const data = await runPython({ code, mode: "judge", test_cases });
    setJudgeResult(data);
    setJudging(false);
  };

  const lineCount = Math.max(code.split("\n").length, 10);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" />목록
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-blue-600">#{problem.problem_number}</span>
            <h1 className="font-bold text-gray-900">{problem.title}</h1>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {problem.algorithm_type && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{problem.algorithm_type}</span>
            )}
            {problem.difficulty && (
              <Badge className={`text-xs border ${difficultyColors[problem.difficulty] || ""}`}>{problem.difficulty}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Problem sections */}
        {problem.description && (
          <Section title="문제">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{problem.description}</pre>
          </Section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {problem.input_description && (
            <Section title="입력">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{problem.input_description}</pre>
            </Section>
          )}
          {problem.output_description && (
            <Section title="출력">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{problem.output_description}</pre>
            </Section>
          )}
        </div>

        {(problem.sample_input || problem.sample_output) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {problem.sample_input && (
              <Section title="예제 입력">
                <pre className="text-sm text-gray-800 font-mono bg-gray-50 p-3 rounded-lg border border-gray-200">{problem.sample_input}</pre>
              </Section>
            )}
            {problem.sample_output && (
              <Section title="예제 출력">
                <pre className="text-sm text-gray-800 font-mono bg-gray-50 p-3 rounded-lg border border-gray-200">{problem.sample_output}</pre>
              </Section>
            )}
          </div>
        )}

        {problem.constraints && Array.isArray(problem.constraints) && problem.constraints.length > 0 && (
          <Section title="제한 조건">
            <ul className="list-disc list-inside space-y-1">
              {problem.constraints.map((c, i) => (
                <li key={i} className="text-sm text-gray-700">{c}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Code Editor */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-[#181825]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <span className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span className="text-xs text-gray-400 ml-2 font-mono">Python 3</span>
            </div>
          </div>

          {/* Editor area */}
          <div className="flex bg-[#1e1e2e]">
            <div className="select-none bg-[#181825] text-[#6c7086] text-right text-xs leading-6 px-3 py-3 font-mono border-r border-[#313244] min-w-[2.5rem]">
              {lineNumbers.map(n => <div key={n}>{n}</div>)}
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="flex-1 bg-transparent text-[#cdd6f4] text-sm font-mono leading-6 p-3 resize-none focus:outline-none min-h-[240px]"
              style={{ tabSize: 4 }}
            />
          </div>

          <div className="px-4 py-2 bg-[#1e1e2e] border-t border-[#313244]">
            <StdinInput value={stdin} onChange={setStdin} code={code} />
          </div>

          {/* Action bar */}
          <div className="px-4 py-3 bg-[#181825] border-t border-[#313244] flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimpleRun}
              disabled={simpleRunning || judging}
              className="gap-1.5 bg-transparent border-[#313244] text-gray-300 hover:bg-[#313244] hover:text-white"
            >
              {simpleRunning
                ? <><span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />실행 중...</>
                : <><Play className="w-3.5 h-3.5" />코드 실행</>}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={judging || simpleRunning}
              className="gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
            >
              {judging
                ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />채점 중...</>
                : <><Send className="w-3.5 h-3.5" />제출하기</>}
            </Button>
          </div>
        </div>

        {/* Simple run output */}
        {simpleOutput && !judgeResult && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">실행 결과</div>
            {simpleOutput.error ? (
              <pre className="px-4 py-3 text-sm font-mono text-red-600 whitespace-pre-wrap">{simpleOutput.error}</pre>
            ) : (
              <pre className="px-4 py-3 text-sm font-mono text-gray-800 whitespace-pre-wrap">{simpleOutput.output || "(출력 없음)"}</pre>
            )}
          </div>
        )}

        {/* Judge result */}
        {(judgeResult || judging) && (
          <JudgeResult result={judgeResult} judging={judging} />
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">{title}</h3>
      {children}
    </div>
  );
}