import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp, Keyboard } from "lucide-react";
import { countInputCalls } from "@/lib/stdinUtils";

/**
 * Python 코드의 input()에 전달할 표준 입력값 입력란
 * - code에 input()이 있으면 자동으로 표시
 * - defaultStdin이 있으면 초기값으로 채움
 * - description이 있으면 안내 문구 표시
 */
export default function StdinInput({
  value,
  onChange,
  code = "",
  defaultStdin = "",
  description = "",
  forceShow = false,
  autoOpen = true,
}) {
  const inputCount = useMemo(() => countInputCalls(code), [code]);
  const hasInput = inputCount > 0 || forceShow || !!defaultStdin;
  const [open, setOpen] = useState(hasInput && autoOpen);
  const [touched, setTouched] = useState(false);

  // defaultStdin이 제공되고 아직 학생이 수정하지 않았으면 미리 채움
  useEffect(() => {
    if (!touched && defaultStdin && (value === undefined || value === "")) {
      onChange(defaultStdin);
    }
  }, [defaultStdin, touched, value, onChange]);

  if (!hasInput) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5" />
          입력값
          {inputCount > 0 && (
            <span className="text-blue-500 font-normal">({inputCount}개의 input() 필요)</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {description && (
            <p className="text-[11px] text-blue-600">{description}</p>
          )}
          <p className="text-[11px] text-blue-500">input()에서 사용할 값을 한 줄에 하나씩 입력하세요.</p>
          <textarea
            value={value || ""}
            onChange={e => { setTouched(true); onChange(e.target.value); }}
            placeholder={"예) Tom\n15"}
            className="w-full text-xs font-mono border border-blue-200 rounded-lg p-2 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows={Math.max(2, Math.min(6, (String(value || "").match(/\n/g) || []).length + 2))}
          />
        </div>
      )}
    </div>
  );
}