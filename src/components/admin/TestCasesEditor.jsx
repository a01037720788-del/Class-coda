import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

function CodeTextarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-xs font-mono border border-gray-200 rounded-md p-2 bg-white resize-y focus:outline-none focus:ring-1 focus:ring-gray-400"
      spellCheck={false}
      style={{ tabSize: 4, whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto" }}
    />
  );
}

export default function TestCasesEditor({ cases = [], onChange }) {
  const add = () => onChange([...cases, { input: "", expected_output: "", hidden: false }]);
  const remove = (i) => onChange(cases.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const c = [...cases]; c[i] = { ...c[i], [field]: val }; onChange(c);
  };

  return (
    <div className="border border-green-200 rounded-lg p-2 space-y-2 bg-green-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-green-700">테스트케이스 (제출 시 자동 채점)</p>
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-6 text-xs"><Plus className="w-3 h-3 mr-1" />추가</Button>
      </div>
      {cases.length === 0 && (
        <p className="text-xs text-green-600 text-center py-1">테스트케이스가 없으면 학생 입력값으로 실행한 결과를 예상 출력과 비교합니다.</p>
      )}
      {cases.map((tc, i) => (
        <div key={i} className="border border-green-200 rounded-lg p-2 bg-white space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-green-600">테스트 {i + 1}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input type="checkbox" checked={tc.hidden === true} onChange={e => update(i, "hidden", e.target.checked)} className="w-3 h-3" />
                숨김
              </label>
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">입력값 (stdin, 줄바꿈으로 구분)</Label>
            <CodeTextarea value={tc.input || ""} onChange={val => update(i, "input", val)} placeholder={"5\n10"} rows={2} />
          </div>
          <div>
            <Label className="text-xs text-gray-500">기대 출력</Label>
            <CodeTextarea value={tc.expected_output || tc.output || ""} onChange={val => update(i, "expected_output", val)} placeholder={"15"} rows={2} />
          </div>
        </div>
      ))}
    </div>
  );
}