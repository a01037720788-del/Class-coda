import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp, Keyboard, Plus } from "lucide-react";
import { hasCppInput } from "@/lib/stdinUtils";

/**
 * C++ 코드의 cin/getline에 전달할 표준 입력(stdin) 입력란
 * - code에 cin >> 또는 getline(cin, 이 있으면 자동으로 표시
 * - defaultStdin이 있으면 "예시 입력 사용" 버튼으로 채울 수 있음
 * - cin이 없어도 "입력값 추가" 버튼으로 수동 열기 가능
 */
export default function CppStdinInput({
  value,
  onChange,
  code = "",
  defaultStdin = "",
  description = "",
  forceShow = false,
  autoOpen = true,
}) {
  const hasInput = useMemo(() => hasCppInput(code) || forceShow, [code, forceShow]);
  const [open, setOpen] = useState(hasInput && autoOpen);
  const [touched, setTouched] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (hasInput && autoOpen) setOpen(true);
  }, [hasInput, autoOpen]);

  useEffect(() => {
    if (!touched && defaultStdin && (value === undefined || value === "")) {
      onChange(defaultStdin);
    }
  }, [defaultStdin, touched, value, onChange]);

  // cin이 없고 수동으로 열지 않았으면 "입력값 추가" 버튼 표시
  if (!hasInput && !manualOpen) {
    return (
      <button
        type="button"
        onClick={() => { setManualOpen(true); setOpen(true); }}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mt-1"
      >
        <Plus className="w-3 h-3" />
        입력값 추가
      </button>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5" />
          프로그램 입력 (stdin)
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {description && <p className="text-[11px] text-blue-600">{description}</p>}
          <p className="text-[11px] text-blue-500">cin/getline에서 사용할 값을 입력하세요. (줄바꿈 또는 공백으로 구분)</p>
          <textarea
            value={value || ""}
            onChange={e => { setTouched(true); onChange(e.target.value); }}
            placeholder={defaultStdin ? `예) ${defaultStdin}` : "예) 10 20"}
            className="w-full text-xs font-mono border border-blue-200 rounded-lg p-2 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows={Math.max(2, Math.min(6, (String(value || "").match(/\n/g) || []).length + 2))}
          />
          {defaultStdin && value !== defaultStdin && (
            <button
              type="button"
              onClick={() => { setTouched(true); onChange(defaultStdin); }}
              className="text-[11px] text-blue-600 hover:text-blue-800 underline"
            >
              예시 입력 사용
            </button>
          )}
        </div>
      )}
    </div>
  );
}