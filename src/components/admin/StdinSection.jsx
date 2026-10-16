import React, { useMemo, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { analyzeInputCalls, generateDefaultStdin } from "@/lib/stdinUtils";

/**
 * 관리자용 표준 입력(stdin) 설정 섹션
 * - code에서 input() 자동 감지
 * - input 개수 표시
 * - input이 있으면 섹션 자동 표시, 없으면 숨김 (데이터는 유지)
 * - "기본값 자동 생성" 버튼으로 코드 분석 기반 제안값 생성
 * - input 감지 시 uses_input 자동 true 설정
 *
 * Props:
 * - code: 분석할 Python 코드 (example은 ec.code, mission은 m.default_code)
 * - defaultStdin, stdinDescription, usesInput, gradingMode: 현재 값
 * - showGradingMode: mission용 채점 모드 셀렉터 표시 여부
 * - onUpdate(field, value): 필드 변경 콜백
 */
export default function StdinSection({
  code = "",
  defaultStdin = "",
  stdinDescription = "",
  usesInput = false,
  gradingMode = "normalize",
  showGradingMode = false,
  onUpdate,
}) {
  const analysis = useMemo(() => analyzeInputCalls(code), [code]);
  const inputCount = analysis.count;
  const hasInput = inputCount > 0;
  const showSection = hasInput || usesInput === true || !!defaultStdin;

  // input()이 감지되면 uses_input 자동 true (최초 1회만)
  useEffect(() => {
    if (hasInput && usesInput === false) {
      onUpdate("uses_input", true);
    }
  }, [hasInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoGenerate = () => {
    const generated = generateDefaultStdin(code);
    onUpdate("default_stdin", generated);
  };

  return (
    <div className="border border-blue-200 rounded-lg p-2 space-y-1.5 bg-blue-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-blue-700">표준 입력 (input()) 설정</p>
        {hasInput ? (
          <span className="text-[11px] text-blue-600">이 코드에서는 {inputCount}개의 입력을 사용합니다.</span>
        ) : (
          <span className="text-[11px] text-gray-400">input()이 없습니다.</span>
        )}
      </div>
      {showSection && (
        <>
          <div className="flex items-center gap-1.5">
            <input type="checkbox" checked={usesInput === true}
              onChange={e => onUpdate("uses_input", e.target.checked)} className="w-3.5 h-3.5" />
            <label className="text-xs text-blue-700">입력값 사용 (학생 화면에 입력란 표시)</label>
            {hasInput && (
              <Button type="button" size="sm" variant="outline" onClick={handleAutoGenerate} className="h-6 text-xs ml-auto gap-1">
                <Sparkles className="w-3 h-3" />기본값 자동 생성
              </Button>
            )}
          </div>
          <div>
            <Label className="text-xs text-blue-600">기본 입력값 (학생 화면에 미리 채움, 줄바꿈으로 구분)</Label>
            <textarea
              value={defaultStdin || ""}
              onChange={e => onUpdate("default_stdin", e.target.value)}
              placeholder={"Tom\n15"}
              rows={2}
              className="w-full text-xs font-mono border border-gray-200 rounded-md p-2 bg-white resize-y focus:outline-none focus:ring-1 focus:ring-gray-400 mt-1"
              spellCheck={false}
              style={{ tabSize: 4, whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto" }}
            />
          </div>
          <div>
            <Label className="text-xs text-blue-600">입력값 설명 (학생 화면 안내 문구)</Label>
            <Input value={stdinDescription || ""} onChange={e => onUpdate("stdin_description", e.target.value)} placeholder="첫째 줄에 이름, 둘째 줄에 나이" className="h-7 text-xs mt-1" />
          </div>
          {showGradingMode && (
            <div>
              <Label className="text-xs text-blue-600">채점 모드</Label>
              <select value={gradingMode || "normalize"} onChange={e => onUpdate("grading_mode", e.target.value)}
                className="w-full h-7 text-xs border border-gray-200 rounded px-2 mt-1 bg-white">
                <option value="exact">전체 출력 정확히 비교</option>
                <option value="normalize">공백과 줄바꿈을 정리하여 비교 (기본)</option>
                <option value="exclude_prompts">input 안내 문구 제외하고 결과만 비교</option>
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}