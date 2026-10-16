import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

// 코드 결과 예측 - 테스트케이스 기반 관리자 에디터
// 데이터 구조: { code_block: string, test_cases: [{input: string, expected_output: string, description: string}] }
export default function CodeOutputEditor({ codeBlock, testCases = [], onCodeChange, onTestCasesChange }) {
  const addCase = () => onTestCasesChange([...testCases, { input: "", expected_output: "", description: "" }]);
  const removeCase = (i) => onTestCasesChange(testCases.filter((_, idx) => idx !== i));
  const updateCase = (i, field, val) => {
    const next = [...testCases];
    next[i] = { ...next[i], [field]: val };
    onTestCasesChange(next);
  };

  return (
    <div className="space-y-3 border border-orange-200 rounded-lg p-3 bg-orange-50">
      <p className="text-xs font-bold text-orange-700">📋 코드 결과 예측 설정</p>

      {/* 코드 블록 */}
      <div>
        <Label className="text-xs text-orange-700 font-bold">코드 블록 *</Label>
        <textarea
          value={codeBlock}
          onChange={e => onCodeChange(e.target.value)}
          placeholder={"x = int(input())\nprint(x * 2)"}
          rows={6}
          className="w-full text-xs font-mono border border-orange-200 rounded-md p-2 bg-white resize-y focus:outline-none focus:ring-1 focus:ring-orange-400 mt-1"
          spellCheck={false}
          style={{ tabSize: 4, whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto" }}
        />
        <p className="text-xs text-gray-400 mt-0.5">학생에게 보여줄 코드를 입력하세요.</p>
      </div>

      {/* 테스트 케이스 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-orange-700 font-bold">테스트 케이스 (예시)</Label>
          <Button type="button" size="sm" variant="outline" onClick={addCase} className="h-6 text-xs border-orange-300 text-orange-700 hover:bg-orange-100">
            <Plus className="w-3 h-3 mr-1" />추가
          </Button>
        </div>
        <p className="text-xs text-gray-400">입력값이 없는 문제는 입력 칸을 비워두세요. 학생은 각 테스트 케이스의 출력 결과를 입력해야 합니다.</p>

        {testCases.length === 0 && (
          <p className="text-xs text-orange-400 italic py-2 text-center">테스트 케이스를 추가하세요.</p>
        )}

        {testCases.map((tc, i) => (
          <div key={i} className="border border-orange-100 rounded-lg p-2.5 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-600">예시 {i + 1}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeCase(i)} className="h-6 w-6 p-0 text-red-400">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-500">입력값 (input)</Label>
                <textarea
                  value={tc.input || ""}
                  onChange={e => updateCase(i, "input", e.target.value)}
                  placeholder={"입력 없으면 비워두세요\n여러 줄 입력 가능"}
                  rows={2}
                  className="w-full text-xs font-mono border border-gray-200 rounded p-1.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-orange-300 mt-0.5"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">예상 출력 (정답) *</Label>
                <textarea
                  value={tc.expected_output || ""}
                  onChange={e => updateCase(i, "expected_output", e.target.value)}
                  placeholder={"출력 결과\n여러 줄 가능"}
                  rows={2}
                  className="w-full text-xs font-mono border border-gray-200 rounded p-1.5 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-orange-300 mt-0.5"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">설명 (선택 — 오답 시 힌트로 표시)</Label>
              <Input
                value={tc.description || ""}
                onChange={e => updateCase(i, "description", e.target.value)}
                placeholder="예: x에 3을 입력하면 6이 출력됩니다"
                className="h-7 text-xs mt-0.5"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}