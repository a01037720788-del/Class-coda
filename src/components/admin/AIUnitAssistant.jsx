/**
 * AIUnitAssistant — 과목별 AI 콘텐츠 생성 공통 컴포넌트
 * props:
 *   subject: "python" | "cpp" | "html" | "java"
 *   languageLabel: "Python" | "C++" | "HTML" | "Java"
 *   unitTitle: string
 *   onApplyConcepts: (sections[]) => void
 *   onApplyTables: (tables[]) => void
 *   onApplyExamples: (codes[]) => void
 *   onApplyQuestions: (questions[]) => void
 *   onApplyMissions: (missions[]) => void
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, BookOpen, Table, Code2, HelpCircle, Target, X, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { computeLearningScope, buildScopePromptSection, validateCode } from "@/lib/learningScope";

// 과목별 언어 지침
const LANG_GUIDE = {
  python: {
    label: "Python",
    codeHint: "Python 3 문법 기준. print(), input(), for, while, list, dict 등을 활용하세요.",
    defaultCode: 'print("Hello CODA")',
    defaultFile: "example.py",
    missionHint: "Python: input()으로 값을 입력받고 print()로 출력하는 과제",
  },
  cpp: {
    label: "C++",
    codeHint: "C++17 문법 기준. 기본 구조: #include <iostream> using namespace std; int main() { return 0; }. 필요 시 <vector>, <algorithm>, <string> 등 헤더 추가.",
    defaultCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}`,
    defaultFile: "example.cpp",
    missionHint: "C++: cin으로 입력받고 cout으로 출력하는 과제",
  },
  html: {
    label: "HTML/CSS/JS",
    codeHint: `HTML/CSS/JavaScript 기준. HTML 기본 템플릿: <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><link rel="stylesheet" href="style.css"></head><body></body></html>. CSS와 JS는 필요한 경우에만 생성.`,
    defaultCode: `<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8">\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n</body>\n</html>`,
    defaultFile: "index.html",
    missionHint: "HTML: 주어진 구조의 웹페이지를 HTML/CSS로 만드는 과제",
  },
  java: {
    label: "Java",
    codeHint: `Java 17 문법 기준. 기본 구조: public class Main { public static void main(String[] args) { } }. 입력 필요 시 import java.util.Scanner; Scanner sc = new Scanner(System.in); 사용.`,
    defaultCode: `public class Main {\n    public static void main(String[] args) {\n        \n    }\n}`,
    defaultFile: "Main.java",
    missionHint: "Java: Scanner로 입력받아 조건문/반복문으로 처리하는 과제",
  },
};

const ACTIONS = [
  { key: "concepts", icon: BookOpen, label: "개념 생성", color: "text-blue-600 border-blue-200 hover:bg-blue-50", loadingLabel: "개념 생성 중..." },
  { key: "tables", icon: Table, label: "표 생성", color: "text-green-600 border-green-200 hover:bg-green-50", loadingLabel: "표 생성 중..." },
  { key: "examples", icon: Code2, label: "예제 생성", color: "text-purple-600 border-purple-200 hover:bg-purple-50", loadingLabel: "예제 생성 중..." },
  { key: "questions", icon: HelpCircle, label: "Question 생성", color: "text-orange-600 border-orange-200 hover:bg-orange-50", loadingLabel: "Question 생성 중..." },
  { key: "missions", icon: Target, label: "Mission 생성", color: "text-red-600 border-red-200 hover:bg-red-50", loadingLabel: "Mission 생성 중..." },
];

export default function AIUnitAssistant({
  subject = "python",
  unitTitle = "",
  unitContent = null,
  previousUnits = [],
  currentUnitNumber = 1,
  onApplyConcepts,
  onApplyTables,
  onApplyExamples,
  onApplyQuestions,
  onApplyMissions,
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(null); // key of action
  const [result, setResult] = useState(null);
  const [resultKey, setResultKey] = useState(null);
  const [scopeWarnings, setScopeWarnings] = useState(null);
  const { toast } = useToast();

  const lang = LANG_GUIDE[subject] || LANG_GUIDE.python;

  // 학습 범위 계산
  const scope = computeLearningScope(previousUnits, currentUnitNumber, unitTitle, subject, []);
  const scopeSection = buildScopePromptSection(scope);

  const buildPrompt = (action) => {
    const base = `[과목: ${lang.label}] [단원: ${unitTitle || "미지정"}]\n${lang.codeHint}\n\n${scopeSection}\n\n`;
    const userHint = prompt ? `추가 요청: ${prompt}\n\n` : "";

    if (action === "concepts") {
      return base + userHint + `위 과목·단원에 맞는 개념 설명 섹션 3~5개를 생성하세요. 각 섹션은 제목(title), 설명 줄 목록(lines: string[]), 코드 예시(code_example: string)로 구성하세요. 코드 예시는 ${lang.label} 코드여야 합니다.`;
    }
    if (action === "tables") {
      return base + userHint + `위 과목·단원에 맞는 정리 표 2~3개를 생성하세요. 각 표는 제목(title), 헤더(headers: string[]), 행(rows: string[][])으로 구성하세요.`;
    }
    if (action === "examples") {
      return base + userHint + `위 과목·단원에 맞는 예제 코드 3~5개를 생성하세요. 각 예제는 filename, code(${lang.label} 코드), description, expected_output으로 구성하세요. ${subject === "html" ? "HTML 예제는 html, css, javascript 필드로 분리하세요." : ""}`;
    }
    if (action === "questions") {
      return base + userHint + `위 과목·단원에 맞는 학습 문제 5~8개를 생성하세요. 각 문제는 type("객관식"|"OX"|"빈칸채우기"|"코드결과예측"), question, options(객관식 시 string[]), answer, explanation으로 구성하세요. ${lang.label} 특성을 반영하여 코드 결과 예측 문제도 포함하세요.`;
    }
    if (action === "missions") {
      return base + userHint + `위 과목·단원에 맞는 실습 미션 3~5개를 생성하세요. 각 미션은 title, description, default_code(${lang.label}), expected_output, input_condition, output_condition, example으로 구성하세요. ${lang.missionHint}`;
    }
    return base;
  };

  const SCHEMAS = {
    concepts: {
      type: "object",
      properties: {
        items: {
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
      },
    },
    tables: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              headers: { type: "array", items: { type: "string" } },
              rows: { type: "array", items: { type: "array", items: { type: "string" } } },
            },
          },
        },
      },
    },
    examples: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              code: { type: "string" },
              html: { type: "string" },
              css: { type: "string" },
              javascript: { type: "string" },
              description: { type: "string" },
              expected_output: { type: "string" },
            },
          },
        },
      },
    },
    questions: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              answer: { type: "string" },
              explanation: { type: "string" },
            },
          },
        },
      },
    },
    missions: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              default_code: { type: "string" },
              expected_output: { type: "string" },
              input_condition: { type: "string" },
              output_condition: { type: "string" },
              example: { type: "string" },
            },
          },
        },
      },
    },
  };

  const handleGenerate = async (action) => {
    setLoading(action);
    setResult(null);
    setResultKey(null);
    setScopeWarnings(null);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: buildPrompt(action),
        response_json_schema: SCHEMAS[action],
      });
      const items = res?.items;
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("AI가 빈 결과를 반환했습니다.");
      }

      // 학습 범위 검증
      const warnings = [];
      items.forEach((item, i) => {
        const codeFields = [];
        if (action === "examples") {
          codeFields.push({ code: item.code || item.html, label: `예제 ${i + 1}` });
        } else if (action === "concepts") {
          codeFields.push({ code: item.code_example, label: `개념 ${i + 1} (code_example)` });
        } else if (action === "questions") {
          codeFields.push({ code: item.code_block, label: `Question ${i + 1} (code_block)` });
          if (Array.isArray(item.code_items)) {
            item.code_items.forEach((ci, j) => {
              codeFields.push({ code: ci.code, label: `Question ${i + 1} (code_items ${j + 1})` });
            });
          }
        } else if (action === "missions") {
          codeFields.push({ code: item.default_code, label: `Mission ${i + 1} (default_code)` });
          codeFields.push({ code: item.answer_code, label: `Mission ${i + 1} (answer_code)` });
        }
        for (const { code, label } of codeFields) {
          const v = validateCode(code, scope, subject);
          v.forEach(vi => warnings.push(`${label}: 아직 배우지 않은 ${vi.label} 사용 («${vi.snippet}»)»`));
        }
      });

      setResult(items);
      setResultKey(action);
      setScopeWarnings(warnings.length > 0 ? warnings : null);
    } catch (err) {
      const msg = err?.message || "AI 생성에 실패했습니다.";
      toast({ title: "AI 생성 실패", description: msg, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleApply = () => {
    if (!result || !resultKey) return;
    if (scopeWarnings && scopeWarnings.length > 0) {
      toast({ title: "학습 범위 위반", description: "금지된 문법이 포함되어 적용할 수 없습니다. 다시 생성해주세요.", variant: "destructive" });
      return;
    }
    const callbacks = {
      concepts: onApplyConcepts,
      tables: onApplyTables,
      examples: onApplyExamples,
      questions: onApplyQuestions,
      missions: onApplyMissions,
    };

    let processed = result;

    if (resultKey === "questions") {
      processed = result.map((q, i) => ({
        number: i + 1,
        type: q.type || "객관식",
        question: q.question || "",
        options: q.options || [],
        pairs: [],
        answer: q.answer || "",
        explanation: q.explanation || "",
        difficulty: "",
        code_block: "",
        expected_output: "",
        code_items: [],
      }));
    }
    if (resultKey === "missions") {
      processed = result.map((m, i) => ({
        number: i + 1,
        title: m.title || "",
        description: m.description || "",
        default_code: m.default_code || lang.defaultCode,
        expected_output: m.expected_output || "",
        input_condition: m.input_condition || "",
        output_condition: m.output_condition || "",
        example: m.example || "",
      }));
    }
    if (resultKey === "examples" && subject !== "html") {
      processed = result.map((ex, i) => ({
        filename: ex.filename || `${lang.defaultFile.replace(/\.[^.]+$/, "")}${i + 1}${lang.defaultFile.match(/\.[^.]+$/)?.[0] || ""}`,
        code: ex.code || ex.html || "",
        description: ex.description || "",
        expected_output: ex.expected_output || "",
      }));
    }
    if (resultKey === "examples" && subject === "html") {
      processed = result.map((ex, i) => ({
        filename: ex.filename || `example${i + 1}.html`,
        html: ex.html || ex.code || lang.defaultCode,
        css: ex.css || "",
        javascript: ex.javascript || "",
        description: ex.description || "",
        judge_mode: "structure",
      }));
    }

    const fn = callbacks[resultKey];
    if (fn) fn(processed);
    toast({ title: "✅ 적용 완료", description: `${result.length}개 항목이 추가되었습니다.` });
    setResult(null);
    setResultKey(null);
    setOpen(false);
  };

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-7 text-xs bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 gap-1"
      >
        <Wand2 className="w-3 h-3" />AI 생성
      </Button>
    );
  }

  return (
    <div className="border border-purple-200 rounded-xl bg-purple-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-bold text-purple-800">AI 콘텐츠 생성 — {lang.label}</span>
          <span className="text-xs text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full">{unitTitle || "단원명 없음"}</span>
        </div>
        <button onClick={() => { setOpen(false); setResult(null); }} className="text-purple-400 hover:text-purple-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder={`추가 요청 (선택) — 예: ${lang.label === "Python" ? "반복문 중심으로" : lang.label === "C++" ? "포인터와 배열 관련" : lang.label === "HTML" ? "CSS flexbox 중심으로" : "ArrayList와 반복문 중심으로"}`}
        className="h-16 text-sm bg-white"
      />

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(({ key, icon: Icon, label, color, loadingLabel }) => (
          <button
            key={key}
            type="button"
            disabled={!!loading}
            onClick={() => handleGenerate(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${color} bg-white`}
          >
            {loading === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
            {loading === key ? loadingLabel : label}
          </button>
        ))}
      </div>

      {/* 결과 미리보기 */}
      {result && resultKey && (
        <div className="bg-white border border-purple-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700">
              ✨ 생성 결과 — {ACTIONS.find(a => a.key === resultKey)?.label} ({result.length}개)
            </span>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={scopeWarnings && scopeWarnings.length > 0}
              className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
            >
              현재 탭에 추가
            </Button>
          </div>

          {/* 학습 범위 검증 결과 */}
          {scopeWarnings && scopeWarnings.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 space-y-0.5">
              <p className="font-bold flex items-center gap-1"><ShieldX className="w-3 h-3" /> 학습 범위 검사 경고</p>
              {scopeWarnings.map((w, i) => <p key={i}>• {w}</p>)}
              <p className="font-semibold mt-1">금지된 문법이 포함되어 적용이 차단됩니다. 다시 생성해주세요.</p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded p-1.5 text-xs text-green-700 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 학습 범위 검사: 통과
            </div>
          )}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {result.slice(0, 5).map((item, i) => (
              <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 truncate">
                {i + 1}. {item.title || item.question || item.filename || item.description || JSON.stringify(item).slice(0, 60)}
              </div>
            ))}
            {result.length > 5 && <p className="text-xs text-gray-400 px-2">... 외 {result.length - 5}개</p>}
          </div>
        </div>
      )}
    </div>
  );
}