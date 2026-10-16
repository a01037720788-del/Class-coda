import React, { useState, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ChevronDown, ChevronUp, Table, Code2, HelpCircle, Target, BookOpen, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AIQuestionCleaner from "./AIQuestionCleaner";
import TestCasesEditor from "./TestCasesEditor";
import RandomTestGenerator from "./RandomTestGenerator";
import StdinSection from "./StdinSection";

// 순서 이동 버튼 공통 컴포넌트
function ReorderButtons({ index, total, onMove }) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 disabled:cursor-not-allowed text-[10px] font-bold"
        title="위로"
      >▲</button>
      <button
        type="button"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 disabled:cursor-not-allowed text-[10px] font-bold"
        title="아래로"
      >▼</button>
    </div>
  );
}

// 배열에서 두 인덱스 위치를 교환
function moveItem(arr, from, to) {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// 코드 입력용 textarea (controlled)
// - Tab 키: 직접 state를 통한 처리 (selection 복원은 ref로)
// - value/onChange는 완전한 React controlled 방식으로 동작
function CodeTextarea({ value, onChange, placeholder, className = "", rows = 6 }) {
  const ref = useRef(null);
  const pendingCursor = useRef(null);

  // Tab 삽입 후 커서 위치 복원 (controlled textarea는 re-render 후에 커서가 끝으로 이동하므로 복원 필요)
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target;
      const s = el.selectionStart;
      const end = el.selectionEnd;
      const cur = value ?? "";
      const newVal = cur.substring(0, s) + "    " + cur.substring(end);
      pendingCursor.current = s + 4;
      onChange(newVal);
    }
  }, [value, onChange]);

  // Tab 삽입 후 re-render가 끝나면 커서 위치 복원
  const prevPending = useRef(null);
  if (pendingCursor.current !== null && pendingCursor.current !== prevPending.current) {
    prevPending.current = pendingCursor.current;
    Promise.resolve().then(() => {
      if (ref.current && pendingCursor.current !== null) {
        ref.current.selectionStart = pendingCursor.current;
        ref.current.selectionEnd = pendingCursor.current;
        pendingCursor.current = null;
        prevPending.current = null;
      }
    });
  }

  return (
    <textarea
      ref={ref}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={rows}
      className={`w-full text-xs font-mono border border-gray-200 rounded-md p-2 bg-white resize-y focus:outline-none focus:ring-1 focus:ring-gray-400 ${className}`}
      spellCheck={false}
      style={{ tabSize: 4, whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto" }}
    />
  );
}

// ─── Concept Sections Editor ───────────────────────────────────────────────
export function ConceptSectionsEditor({ sections = [], onChange }) {
  const add = () => onChange([...sections, { title: "", lines: [""], code_example: "", interactive_code: { enabled: false, code: "", expected_output: "", allow_edit: true, compare_result: true } }]);
  const remove = (i) => onChange(sections.filter((_, idx) => idx !== i));
  const move = (from, to) => onChange(moveItem(sections, from, to));
  const update = (i, field, val) => {
    const s = [...sections];
    s[i] = { ...s[i], [field]: val };
    onChange(s);
  };
  const updateInteractive = (i, field, val) => {
    const s = [...sections];
    s[i] = { ...s[i], interactive_code: { ...(s[i].interactive_code || {}), [field]: val } };
    onChange(s);
  };
  const addLine = (i) => {
    const s = [...sections];
    s[i] = { ...s[i], lines: [...(s[i].lines || []), ""] };
    onChange(s);
  };
  const removeLine = (i, j) => {
    const s = [...sections];
    s[i] = { ...s[i], lines: s[i].lines.filter((_, li) => li !== j) };
    onChange(s);
  };
  const updateLine = (i, j, val) => {
    const s = [...sections];
    const lines = [...(s[i].lines || [])];
    lines[j] = val;
    s[i] = { ...s[i], lines };
    onChange(s);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />개념 섹션</Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />섹션 추가</Button>
      </div>
      {sections.map((sec, i) => {
        const ic = sec.interactive_code || {};
        return (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex gap-2 items-center">
              <ReorderButtons index={i} total={sections.length} onMove={move} />
              <span className="text-xs text-gray-400 font-bold flex-shrink-0">#{i+1}</span>
              <Input value={sec.title} onChange={e => update(i, "title", e.target.value)} placeholder="▶ 섹션 제목 (예: 출력 : print())" className="flex-1 h-8 text-sm" />
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            {(sec.lines || []).map((line, j) => (
              <div key={j} className="flex gap-1">
                <span className="text-gray-400 text-xs mt-2 w-4">-</span>
                <Input value={line} onChange={e => updateLine(i, j, e.target.value)} placeholder="설명 줄" className="flex-1 h-7 text-xs" />
                <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i, j)} className="h-7 w-7 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => addLine(i)} className="h-6 text-xs"><Plus className="w-3 h-3 mr-1" />줄 추가</Button>
            <div>
              <Label className="text-xs text-gray-500">읽기 전용 코드 예시 (선택)</Label>
              <CodeTextarea value={sec.code_example} onChange={val => update(i, "code_example", val)} placeholder={"# 코드 예시"} rows={4} className="mt-1" />
            </div>
            {/* 인터랙티브 코드 블록 */}
            <div className="border border-purple-200 rounded-lg p-2 space-y-2 bg-purple-50">
              <div className="flex items-center gap-2">
                <input type="checkbox" id={`ic_en_${i}`} checked={!!ic.enabled}
                  onChange={e => updateInteractive(i, "enabled", e.target.checked)} className="w-3.5 h-3.5" />
                <label htmlFor={`ic_en_${i}`} className="text-xs font-bold text-purple-700">인터랙티브 코드 블록 사용</label>
              </div>
              {ic.enabled && (<>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-purple-600">제목 (선택)</Label>
                    <Input value={ic.title || ""} onChange={e => updateInteractive(i, "title", e.target.value)}
                      placeholder="실행 가능 코드" className="h-7 text-xs mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-purple-600">언어</Label>
                    <select value={ic.language || "python"} onChange={e => updateInteractive(i, "language", e.target.value)}
                      className="w-full h-7 text-xs border border-gray-200 rounded px-2 mt-1 bg-white">
                      <option value="python">Python</option>
                      <option value="cpp">C++</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-purple-600">설명 (선택)</Label>
                  <Input value={ic.description || ""} onChange={e => updateInteractive(i, "description", e.target.value)}
                    placeholder="코드 설명" className="h-7 text-xs mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-purple-600">원본 코드 *</Label>
                  <CodeTextarea value={ic.code} onChange={val => updateInteractive(i, "code", val)} placeholder={"print('Hello!')"} rows={5} className="mt-1 border-purple-200 focus:ring-purple-400" />
                </div>
                <div>
                  <Label className="text-xs text-purple-600">예상 출력 결과 (결과 비교용)</Label>
                  <CodeTextarea value={ic.expected_output} onChange={val => updateInteractive(i, "expected_output", val)} placeholder={"Hello!"} rows={2} className="mt-1 border-purple-200 focus:ring-purple-400" />
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" id={`ic_ae_${i}`} checked={ic.allow_edit !== false}
                      onChange={e => updateInteractive(i, "allow_edit", e.target.checked)} className="w-3.5 h-3.5" />
                    <label htmlFor={`ic_ae_${i}`} className="text-xs text-purple-700">학생 코드 수정 허용</label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" id={`ic_cr_${i}`} checked={ic.compare_result !== false}
                      onChange={e => updateInteractive(i, "compare_result", e.target.checked)} className="w-3.5 h-3.5" />
                    <label htmlFor={`ic_cr_${i}`} className="text-xs text-purple-700">결과 비교 사용</label>
                  </div>
                </div>
              </>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tables Editor ──────────────────────────────────────────────────────────
export function TablesEditor({ tables = [], onChange }) {
  const addTable = () => onChange([...tables, { title: "", headers: [""], rows: [[""]] }]);
  const removeTable = (i) => onChange(tables.filter((_, idx) => idx !== i));
  const moveTable = (from, to) => onChange(moveItem(tables, from, to));
  const updateTable = (i, field, val) => {
    const t = [...tables];
    t[i] = { ...t[i], [field]: val };
    onChange(t);
  };
  const addHeader = (i) => {
    const t = [...tables];
    t[i] = { ...t[i], headers: [...(t[i].headers || []), ""], rows: (t[i].rows || []).map(r => [...r, ""]) };
    onChange(t);
  };
  const removeHeader = (i, j) => {
    const t = [...tables];
    t[i] = { ...t[i], headers: t[i].headers.filter((_, hi) => hi !== j), rows: (t[i].rows || []).map(r => r.filter((_, ri) => ri !== j)) };
    onChange(t);
  };
  const updateHeader = (i, j, val) => {
    const t = [...tables];
    const h = [...t[i].headers]; h[j] = val;
    t[i] = { ...t[i], headers: h };
    onChange(t);
  };
  const addRow = (i) => {
    const t = [...tables];
    const cols = (t[i].headers || []).length || 1;
    t[i] = { ...t[i], rows: [...(t[i].rows || []), Array(cols).fill("")] };
    onChange(t);
  };
  const removeRow = (i, j) => {
    const t = [...tables];
    t[i] = { ...t[i], rows: t[i].rows.filter((_, ri) => ri !== j) };
    onChange(t);
  };
  const updateCell = (i, r, c, val) => {
    const t = [...tables];
    const rows = t[i].rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? val : cell) : row);
    t[i] = { ...t[i], rows };
    onChange(t);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1"><Table className="w-3.5 h-3.5" />표</Label>
        <Button type="button" size="sm" variant="outline" onClick={addTable} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />표 추가</Button>
      </div>
      {tables.map((tbl, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex gap-2 items-center">
            <ReorderButtons index={i} total={tables.length} onMove={moveTable} />
            <span className="text-xs text-gray-400 font-bold flex-shrink-0">#{i+1}</span>
            <Input value={tbl.title} onChange={e => updateTable(i, "title", e.target.value)} placeholder="표 제목" className="flex-1 h-8 text-sm" />
            <Button type="button" size="sm" variant="ghost" onClick={() => removeTable(i)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {(tbl.headers || []).map((h, j) => (
                    <th key={j} className="p-1">
                      <div className="flex gap-1">
                        <Input value={h} onChange={e => updateHeader(i, j, e.target.value)} placeholder={`열 ${j+1}`} className="h-6 text-xs font-bold" />
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeHeader(i, j)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-2.5 h-2.5" /></Button>
                      </div>
                    </th>
                  ))}
                  <th><Button type="button" size="sm" variant="outline" onClick={() => addHeader(i)} className="h-6 text-xs"><Plus className="w-3 h-3" /></Button></th>
                </tr>
              </thead>
              <tbody>
                {(tbl.rows || []).map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="p-1"><Input value={cell} onChange={e => updateCell(i, r, c, e.target.value)} className="h-6 text-xs" /></td>
                    ))}
                    <td className="p-1"><Button type="button" size="sm" variant="ghost" onClick={() => removeRow(i, r)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-2.5 h-2.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => addRow(i)} className="h-6 text-xs"><Plus className="w-3 h-3 mr-1" />행 추가</Button>
        </div>
      ))}
    </div>
  );
}

// ─── Example Codes Editor ───────────────────────────────────────────────────
export function ExampleCodesEditor({ codes = [], onChange, defaultCode = 'print("Hello CODA")', defaultFilename = "example.py", language = "python" }) {
  const isCpp = language === "cpp";
  const add = () => onChange([...codes, isCpp
    ? { filename: defaultFilename, reference_code: defaultCode, starter_code: "", description: "", expected_output: "" }
    : { filename: defaultFilename, code: defaultCode, description: "", expected_output: "" }
  ]);
  const remove = (i) => onChange(codes.filter((_, idx) => idx !== i));
  const move = (from, to) => onChange(moveItem(codes, from, to));
  const update = (i, field, val) => {
    const c = [...codes]; c[i] = { ...c[i], [field]: val }; onChange(c);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1"><Code2 className="w-3.5 h-3.5" />예제 코드</Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />코드 추가</Button>
      </div>
      {codes.map((c, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex gap-2 items-center">
            <ReorderButtons index={i} total={codes.length} onMove={move} />
            <span className="text-xs text-gray-400 font-bold flex-shrink-0">Example {i+1}</span>
            <Input value={c.filename} onChange={e => update(i, "filename", e.target.value)} placeholder="파일명 (예: #unit1_01.py)" className="flex-1 h-8 text-sm font-mono" />
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
          {isCpp ? (
            <>
              <Label className="text-xs text-gray-600 font-semibold">완성 코드 (학생이 따라쓸 참고 코드)</Label>
              <CodeTextarea value={c.reference_code || c.code || ""} onChange={val => update(i, "reference_code", val)} placeholder={"#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << \"Hello\";\n    return 0;\n}"} rows={5} />
              <Label className="text-xs text-gray-600 font-semibold mt-1">시작 코드 (선택 — 학생 에디터 초기값)</Label>
              <CodeTextarea value={c.starter_code || ""} onChange={val => update(i, "starter_code", val)} placeholder={"#include <iostream>\nusing namespace std;\n\nint main() {\n\n    return 0;\n}"} rows={3} />
            </>
          ) : (
            <CodeTextarea value={c.code} onChange={val => update(i, "code", val)} placeholder={'print("Hello World!")'} rows={5} />
          )}
          <Input value={c.description || ""} onChange={e => update(i, "description", e.target.value)} placeholder="코드 설명 (선택)" className="h-7 text-xs" />
          <div>
            <Label className="text-xs text-gray-500">예상 출력 결과 (학생 실행 결과와 비교)</Label>
            <CodeTextarea value={c.expected_output} onChange={val => update(i, "expected_output", val)} placeholder={"Hello World!"} rows={2} className="mt-1" />
          </div>
          <StdinSection
            code={c.code || ""}
            defaultStdin={c.default_stdin || ""}
            stdinDescription={c.stdin_description || ""}
            usesInput={c.uses_input === true}
            onUpdate={(field, val) => update(i, field, val)}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Matching Pairs Editor ───────────────────────────────────────────────────
const MATCHING_TEMPLATES = [
  { label: "Python 함수", pairs: [{ left: "print()", right: "화면에 출력" }, { left: "input()", right: "값을 입력받음" }, { left: "int()", right: "정수로 변환" }, { left: "len()", right: "길이를 구함" }] },
  { label: "연산자", pairs: [{ left: "+", right: "더하기" }, { left: "-", right: "빼기" }, { left: "*", right: "곱하기" }, { left: "/", right: "나누기" }, { left: "%", right: "나머지" }] },
  { label: "자료형", pairs: [{ left: "int", right: "정수" }, { left: "float", right: "실수" }, { left: "str", right: "문자열" }, { left: "bool", right: "참/거짓" }] },
];

function MatchingPairsEditor({ pairs = [], onChange }) {
  const addPair = () => onChange([...pairs, { left: "", right: "" }]);
  const removePair = (i) => onChange(pairs.filter((_, idx) => idx !== i));
  const updatePair = (i, field, val) => {
    const p = [...pairs]; p[i] = { ...p[i], [field]: val }; onChange(p);
  };
  const loadTemplate = (tpl) => onChange([...tpl.pairs]);

  return (
    <div className="space-y-2 border border-green-200 rounded-lg p-2 bg-green-50">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <p className="text-xs font-bold text-green-700">짝 맞추기 쌍 설정</p>
        <div className="flex gap-1 flex-wrap">
          {MATCHING_TEMPLATES.map(tpl => (
            <button key={tpl.label} type="button" onClick={() => loadTemplate(tpl)}
              className="text-xs px-2 py-0.5 rounded bg-green-100 hover:bg-green-200 text-green-700 border border-green-300">
              {tpl.label} 템플릿
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 text-xs text-gray-500 px-1">
        <span>왼쪽 항목</span><span></span><span>오른쪽 정답</span><span></span>
      </div>
      {pairs.map((pair, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center">
          <Input value={pair.left} onChange={e => updatePair(i, "left", e.target.value)}
            placeholder={`항목 ${i+1} (예: print())`} className="h-7 text-xs" />
          <span className="text-gray-400 text-xs px-1">↔</span>
          <Input value={pair.right} onChange={e => updatePair(i, "right", e.target.value)}
            placeholder="정답 (예: 화면에 출력)" className="h-7 text-xs" />
          <Button type="button" size="sm" variant="ghost" onClick={() => removePair(i)} className="h-7 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addPair} className="h-6 text-xs w-full border-dashed border-green-300 text-green-700 hover:bg-green-100">
        <Plus className="w-3 h-3 mr-1" />짝 추가
      </Button>
      {pairs.length > 0 && (
        <p className="text-xs text-gray-400">오른쪽 항목은 학생 화면에서 자동으로 섞입니다.</p>
      )}
    </div>
  );
}

// ─── Code Result Predict Editor ──────────────────────────────────────────────
function CodeResultPredictEditor({ items = [], onChange }) {
  const addItem = () => onChange([...items, { code: "", expected_output: "" }]);
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-2 border border-orange-200 rounded-lg p-2 bg-orange-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-orange-700">코드 블록 목록</p>
        <button type="button" onClick={addItem}
          className="text-xs px-2 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300 flex items-center gap-1">
          <Plus className="w-3 h-3" />코드 추가
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-orange-400 text-center py-2">코드 블록을 추가하세요. 각 코드마다 학생이 예상 결과를 입력합니다.</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="border border-orange-200 rounded-lg p-2 bg-white space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-600">코드 {i + 1}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
          </div>
          <div>
            <Label className="text-xs text-gray-500">코드 *</Label>
            <CodeTextarea value={item.code} onChange={val => updateItem(i, "code", val)} placeholder={"print(3 + 5)"} rows={4} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">정답 출력 (줄바꿈 그대로)</Label>
            <CodeTextarea value={item.expected_output} onChange={val => updateItem(i, "expected_output", val)} placeholder={"8"} rows={2} className="mt-1 border-green-300 focus:ring-green-400" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Questions Editor ────────────────────────────────────────────────────────
export function QuestionsEditor({ questions = [], onChange, subject = "python" }) {
  const TYPES = ["객관식", "객관식복수", "OX", "빈칸채우기", "짝맞추기", "코드빈칸채우기", "코드결과예측", "순서맞추기", "주관식"];
  const TYPE_HINTS = {
    "객관식": "정답: 번호(예: 2). 선택 즉시 자동 채점됩니다.",
    "객관식복수": "정답: 쉼표로 구분 (예: 1,3). 전체 일치해야 정답.",
    "OX": "정답: O 또는 X. 선택 즉시 자동 채점됩니다.",
    "빈칸채우기": "정답: 단어 입력 (대소문자 무시, 공백 제거 후 비교)",
    "코드빈칸채우기": "문제 텍스트에 ____로 빈칸 표시. 정답: 쉼표 구분",
    "코드결과예측": "코드 블록을 여러 개 추가하고 각 코드의 예상 출력을 입력하세요. 모든 코드 결과가 맞아야 정답입니다.",
    "순서맞추기": "보기 항목을 올바른 순서로 입력하세요. 학생은 섞인 항목을 순서대로 배열합니다.",
    "주관식": "자동 채점 없음. 학생 답변이 '선생님 확인 대기' 상태로 저장됩니다. 해설란에 모범 답안 입력 가능.",
  };
  const DIFFICULTIES = [
    { value: "", label: "난이도 없음" },
    { value: "easy", label: "쉬움 (easy)" },
    { value: "medium", label: "보통 (medium)" },
    { value: "hard", label: "어려움 (hard)" },
  ];
  const { toast } = useToast();

  const normalize = (q) => ({ code_block: "", expected_output: "", code_items: [], options: [], pairs: [], answer: "", explanation: "", difficulty: "", ...q });
  const safeQuestions = questions.map(normalize);
  const reindex = (arr) => arr.map((q, idx) => ({ ...q, number: idx + 1 }));
  const add = () => onChange(reindex([...safeQuestions, { number: safeQuestions.length + 1, type: "객관식", question: "", options: [], pairs: [], answer: "", explanation: "", code_block: "", expected_output: "", code_items: [], difficulty: "" }]));
  const moveQ = (from, to) => onChange(reindex(moveItem(safeQuestions, from, to)));

  const handleReindex = () => {
    onChange(reindex(safeQuestions));
    toast({ title: "번호 재정렬 완료", description: `Question ${safeQuestions.length}개, 번호가 1부터 재정렬되었습니다.` });
  };
  const remove = (i) => onChange(reindex(safeQuestions.filter((_, idx) => idx !== i)));
  const update = (i, field, val) => {
    const q = safeQuestions.map(normalize);
    q[i] = { ...q[i], [field]: val };
    onChange(q);
  };
  const addOption = (i) => {
    const q = safeQuestions.map(normalize);
    q[i] = { ...q[i], options: [...(q[i].options || []), ""] };
    onChange(q);
  };
  const updateOption = (i, j, val) => {
    const q = safeQuestions.map(normalize);
    const opts = [...(q[i].options || [])]; opts[j] = val; q[i] = { ...q[i], options: opts };
    onChange(q);
  };
  const removeOption = (i, j) => {
    const q = safeQuestions.map(normalize);
    q[i] = { ...q[i], options: q[i].options.filter((_, oi) => oi !== j) };
    onChange(q);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" />Question ({safeQuestions.length}개)</Label>
        <div className="flex gap-1 flex-wrap">
          {safeQuestions.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={handleReindex}
              className="h-7 text-xs bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100">
              <RefreshCw className="w-3 h-3 mr-1" />번호 재정렬
            </Button>
          )}
          <AIQuestionCleaner subject={subject} questions={safeQuestions} onChange={onChange} />
          <Button type="button" size="sm" variant="outline" onClick={add} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Question 추가</Button>
        </div>
      </div>

      {safeQuestions.map((q, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex gap-2 items-center flex-wrap">
            <ReorderButtons index={i} total={safeQuestions.length} onMove={moveQ} />
            <span className="text-xs font-bold text-gray-500 w-10 flex-shrink-0">Q{i + 1}.</span>
            <div className="flex gap-1 flex-1 flex-wrap">
              <select value={q.type} onChange={e => update(i, "type", e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={q.difficulty || ""} onChange={e => update(i, "difficulty", e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
          {TYPE_HINTS[q.type] && <p className="text-xs text-blue-500 bg-blue-50 rounded px-2 py-1">{TYPE_HINTS[q.type]}</p>}

          {/* 문제 텍스트 */}
          {q.type !== "짝맞추기" && q.type !== "코드빈칸채우기" && (
            <Textarea value={q.question || ""} onChange={e => update(i, "question", e.target.value)}
              placeholder="문제 내용 (질문 텍스트)"
              className="h-16 text-sm" />
          )}
          {q.type === "코드빈칸채우기" && (
            <CodeTextarea value={q.question} onChange={val => update(i, "question", val)} placeholder={"코드에 ____로 빈칸 표시\n예: x = ____\nprint(x)"} rows={5} className="border-blue-200 focus:ring-blue-400" />
          )}
          {q.type === "짝맞추기" && (
            <Input value={q.question || ""} onChange={e => update(i, "question", e.target.value)}
              placeholder="문제 지문 (예: 함수와 설명을 짝지어 보세요)" className="h-8 text-sm" />
          )}

          {/* 코드빈칸채우기 안내 */}
          {q.type === "코드빈칸채우기" && (
            <div className="space-y-1 border border-blue-200 rounded-lg p-2 bg-blue-50">
              <p className="text-xs text-blue-700 font-bold">💡 코드빈칸채우기 작성법</p>
              <p className="text-xs text-blue-600">문제 텍스트에 <code className="bg-blue-100 px-1 rounded">____</code>로 빈칸을 표시하세요.</p>
              <p className="text-xs text-blue-600">정답: 쉼표로 구분 (예: <code className="bg-blue-100 px-1 rounded">print,Hello</code>)</p>
            </div>
          )}

          {/* 코드결과예측 전용 에디터 */}
          {q.type === "코드결과예측" && (
            <CodeResultPredictEditor
              items={q.code_items || []}
              onChange={items => update(i, "code_items", items)}
            />
          )}

          {/* 짝맞추기 전용 에디터 */}
          {q.type === "짝맞추기" && (
            <MatchingPairsEditor
              pairs={q.pairs || []}
              onChange={pairs => update(i, "pairs", pairs)}
            />
          )}

          {/* 순서맞추기 보기 (올바른 순서대로 입력) */}
          {q.type === "순서맞추기" && (
            <div className="space-y-1 border border-pink-200 rounded-lg p-2 bg-pink-50">
              <p className="text-xs font-bold text-pink-700">순서 항목 (올바른 순서대로 입력)</p>
              {(q.options || []).map((opt, j) => (
                <div key={j} className="flex gap-1 items-center">
                  <span className="text-xs text-pink-500 w-5 flex-shrink-0">{j+1}.</span>
                  <Input value={opt} onChange={e => updateOption(i, j, e.target.value)}
                    placeholder={`순서 ${j+1} 항목`} className="flex-1 h-7 text-xs" />
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeOption(i, j)} className="h-7 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => addOption(i)} className="h-6 text-xs"><Plus className="w-3 h-3 mr-1" />항목 추가</Button>
              <p className="text-xs text-pink-400">학생 화면에서 자동으로 섞입니다.</p>
            </div>
          )}

          {/* 객관식 보기 */}
          {["객관식", "객관식복수"].includes(q.type) && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400">보기</p>
              {(q.options || []).map((opt, j) => (
                <div key={j} className="flex gap-1">
                  <span className="text-xs text-gray-400 mt-1.5 w-5">{j+1}.</span>
                  <Input value={opt} onChange={e => updateOption(i, j, e.target.value)}
                    placeholder={`보기 ${j+1}`} className="flex-1 h-7 text-xs" />
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeOption(i, j)} className="h-7 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => addOption(i)} className="h-6 text-xs"><Plus className="w-3 h-3 mr-1" />보기 추가</Button>
            </div>
          )}

          {/* OX 정답 */}
          {q.type === "OX" && (
            <div>
              <Label className="text-xs text-gray-500">정답</Label>
              <div className="flex gap-2 mt-1">
                {["O", "X"].map(v => (
                  <button key={v} type="button" onClick={() => update(i, "answer", v)}
                    className={`px-6 py-1.5 rounded-lg border-2 font-bold text-lg transition-colors ${q.answer === v ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-500"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 정답 + 해설 (짝맞추기/OX/코드결과예측 제외) */}
          {!["OX", "짝맞추기", "코드결과예측"].includes(q.type) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-500">{q.type === "주관식" ? "모범 답안 (선택)" : "정답"}</Label>
                <Input value={q.answer || ""} onChange={e => update(i, "answer", e.target.value)}
                  placeholder={q.type === "주관식" ? "모범 답안" : "정답"} className="h-7 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">{q.type === "주관식" ? "채점 기준 / 해설" : "해설 (정답 시 표시)"}</Label>
                <Input value={q.explanation || ""} onChange={e => update(i, "explanation", e.target.value)} placeholder="해설 입력" className="h-7 text-xs mt-1" />
              </div>
            </div>
          )}
          {["OX", "짝맞추기", "코드결과예측"].includes(q.type) && (
            <div>
              <Label className="text-xs text-gray-500">해설 (정답 시 표시)</Label>
              <Input value={q.explanation || ""} onChange={e => update(i, "explanation", e.target.value)} placeholder="해설 입력" className="h-7 text-xs mt-1" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Missions Editor ─────────────────────────────────────────────────────────
export function MissionsEditor({ missions = [], onChange, defaultCode = 'print("Hello CODA")' }) {
  const reindex = (arr) => arr.map((m, idx) => ({ ...m, number: idx + 1 }));
  const add = () => onChange(reindex([...missions, {
    number: missions.length + 1, title: "", description: "",
    default_code: defaultCode, expected_output: "",
    input_condition: "", output_condition: "", example: ""
  }]));
  const remove = (i) => onChange(reindex(missions.filter((_, idx) => idx !== i)));
  const moveM = (from, to) => onChange(reindex(moveItem(missions, from, to)));
  const update = (i, field, val) => {
    const m = [...missions]; m[i] = { ...m[i], [field]: val }; onChange(m);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1"><Target className="w-3.5 h-3.5" />Mission</Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Mission 추가</Button>
      </div>
      {missions.map((m, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex gap-2 items-center">
            <ReorderButtons index={i} total={missions.length} onMove={moveM} />
            <span className="text-xs font-bold text-gray-500 flex-shrink-0">Mission {i + 1}.</span>
            <Input value={m.title || ""} onChange={e => update(i, "title", e.target.value)} placeholder="Mission 제목 (선택)" className="flex-1 h-7 text-xs" />
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Mission 설명 *</Label>
            <Textarea value={m.description} onChange={e => update(i, "description", e.target.value)} placeholder="Mission 설명을 입력하세요" className="h-16 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">입력 조건 (선택)</Label>
              <Textarea value={m.input_condition || ""} onChange={e => update(i, "input_condition", e.target.value)} placeholder="입력 조건" className="h-12 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">출력 조건 (선택)</Label>
              <Textarea value={m.output_condition || ""} onChange={e => update(i, "output_condition", e.target.value)} placeholder="출력 조건" className="h-12 text-xs mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">예시 (선택)</Label>
            <Textarea value={m.example || ""} onChange={e => update(i, "example", e.target.value)} placeholder="입력: ...\n출력: ..." className="h-10 text-xs mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">기본 코드 (학생에게 제공)</Label>
            <CodeTextarea value={m.default_code} onChange={val => update(i, "default_code", val)} placeholder={'print("Hello CODA")'} rows={3} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">예상 출력 결과 (정답 비교용)</Label>
            <CodeTextarea value={m.expected_output} onChange={val => update(i, "expected_output", val)} placeholder={"Hello CODA"} rows={2} className="mt-1" />
          </div>
          <RandomTestGenerator mission={m} onChange={updated => { const arr = [...missions]; arr[i] = updated; onChange(arr); }} />
          <StdinSection
            code={m.default_code || ""}
            defaultStdin={m.default_stdin || ""}
            stdinDescription={m.stdin_description || ""}
            usesInput={m.uses_input === true}
            gradingMode={m.grading_mode || "normalize"}
            showGradingMode
            onUpdate={(field, val) => update(i, field, val)}
          />
          <TestCasesEditor cases={m.test_cases || []} onChange={cases => update(i, "test_cases", cases)} />
        </div>
      ))}
    </div>
  );
}

// ─── Learning Objectives Editor ──────────────────────────────────────────────
export function LearningObjectivesEditor({ items = [], onChange }) {
  const add = () => onChange([...items, ""]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const move = (from, to) => onChange(moveItem(items, from, to));
  const update = (i, val) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1"><Target className="w-3.5 h-3.5" />Learning Objectives (학습 목표)</Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />목표 추가</Button>
      </div>
      <p className="text-xs text-gray-400">이번 시간에 배울 내용 3~5개를 입력하세요.</p>
      {items.map((obj, i) => (
        <div key={i} className="flex gap-2 items-center">
          <ReorderButtons index={i} total={items.length} onMove={move} />
          <span className="text-xs text-gray-400 font-bold w-6 flex-shrink-0">{i + 1}.</span>
          <Input value={obj} onChange={e => update(i, e.target.value)} placeholder="예: f-string의 기본 문법을 이해한다" className="flex-1 h-8 text-sm" />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg">학습 목표를 추가해주세요.</p>
      )}
    </div>
  );
}

// ─── Summary Editor ──────────────────────────────────────────────────────────
export function SummaryEditor({ items = [], onChange }) {
  const add = () => onChange([...items, ""]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const move = (from, to) => onChange(moveItem(items, from, to));
  const update = (i, val) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />핵심 요약 (Summary)</Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />요약 추가</Button>
      </div>
      <p className="text-xs text-gray-400">이 Unit의 핵심 내용 3~5개를 정리하세요.</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <ReorderButtons index={i} total={items.length} onMove={move} />
          <span className="text-xs text-gray-400 font-bold w-6 flex-shrink-0 mt-2">{i + 1}.</span>
          <Textarea value={item} onChange={e => update(i, e.target.value)} placeholder="예: f-string은 f'...' 형태로 변수를 {} 안에 넣어 출력한다" className="flex-1 text-sm" rows={2} />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 p-0 text-red-500 mt-1"><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg">핵심 요약을 추가해주세요.</p>
      )}
    </div>
  );
}