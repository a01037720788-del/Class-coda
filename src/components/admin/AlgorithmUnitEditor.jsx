import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

// 문자열 배열 에디터 (학습목표, 핵심아이디어 등)
export function StringListEditor({ value = [], onChange, placeholder = "" }) {
  const update = (i, v) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...value, ""]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-xs text-gray-400 mt-2 w-6">{i + 1}.</span>
          <Textarea
        value={item}
        onChange={e => update(i, e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-h-[40px] text-sm"
      />
          <div className="flex flex-col gap-0.5">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)}><ChevronUp className="w-3 h-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)}><ChevronDown className="w-3 h-3" /></Button>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />추가</Button>
    </div>
  );
}

// 개념 섹션 에디터
export function ConceptSectionsEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { title: "", lines: [], code_example: "" }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {value.map((sec, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">섹션 {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Input value={sec.title || ""} onChange={e => update(i, "title", e.target.value)} placeholder="섹션 제목" className="text-sm" />
          <StringListEditor value={sec.lines || []} onChange={v => update(i, "lines", v)} placeholder="설명 라인" />
          <div>
            <Label className="text-xs text-gray-500">코드 예시</Label>
            <Textarea value={sec.code_example || ""} onChange={e => update(i, "code_example", e.target.value)} placeholder="코드 예시 (선택)" className="font-mono text-xs min-h-[60px]" />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />섹션 추가</Button>
    </div>
  );
}

// 알고리즘 흐름 에디터 (step + description)
export function AlgorithmFlowEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { step: "", description: "" }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-xs text-gray-400 mt-2 w-6">{i + 1}.</span>
          <Input value={item.step || ""} onChange={e => update(i, "step", e.target.value)} placeholder="단계 (예: 1단계)" className="text-sm flex-1" />
          <Input value={item.description || ""} onChange={e => update(i, "description", e.target.value)} placeholder="설명" className="text-sm flex-[2]" />
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />단계 추가</Button>
    </div>
  );
}

// 예제 코드 에디터 (코드 라인별 설명 포함)
export function ExampleCodesEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { filename: "", code: "", description: "", expected_output: "", uses_input: false, default_stdin: "", stdin_description: "", code_explanations: [] }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {value.map((ex, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">예제 {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Input value={ex.filename || ""} onChange={e => update(i, "filename", e.target.value)} placeholder="파일명 (예: basic.py)" className="text-sm" />
          <Input value={ex.description || ""} onChange={e => update(i, "description", e.target.value)} placeholder="설명" className="text-sm" />
          <Textarea value={ex.code || ""} onChange={e => update(i, "code", e.target.value)} placeholder="코드" className="font-mono text-xs min-h-[100px]" />
          <Textarea value={ex.expected_output || ""} onChange={e => update(i, "expected_output", e.target.value)} placeholder="예상 출력" className="font-mono text-xs min-h-[40px]" />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={ex.uses_input || false} onChange={e => update(i, "uses_input", e.target.checked)} />
            input() 사용
          </label>
          {ex.uses_input && (
            <>
              <Input value={ex.default_stdin || ""} onChange={e => update(i, "default_stdin", e.target.value)} placeholder="기본 입력값" className="text-sm" />
              <Input value={ex.stdin_description || ""} onChange={e => update(i, "stdin_description", e.target.value)} placeholder="입력값 설명 (안내 문구)" className="text-sm" />
            </>
          )}
          {/* 코드 라인별 설명 */}
          <div className="border-t border-gray-200 pt-2">
            <Label className="text-xs text-gray-500 mb-1 block">코드 라인별 설명</Label>
            <CodeExplanationsEditor value={ex.code_explanations || []} onChange={v => update(i, "code_explanations", v)} />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />예제 추가</Button>
    </div>
  );
}

// 코드 라인별 설명 에디터
export function CodeExplanationsEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { line: "", explanation: "" }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <Input value={item.line || ""} onChange={e => update(i, "line", e.target.value)} placeholder="코드 라인 (예: left = 0)" className="font-mono text-xs flex-1" />
          <Input value={item.explanation || ""} onChange={e => update(i, "explanation", e.target.value)} placeholder="설명 (예: 탐색 시작 위치)" className="text-xs flex-[2]" />
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />라인 설명 추가</Button>
    </div>
  );
}

// Question 에디터
export function QuestionsEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { number: value.length + 1, type: "객관식", question: "", options: [], answer: "", explanation: "" }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Q {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" value={q.number || i + 1} onChange={e => update(i, "number", Number(e.target.value))} className="text-sm" />
            <select value={q.type || "객관식"} onChange={e => update(i, "type", e.target.value)} className="text-sm border rounded px-2">
              <option>객관식</option><option>OX</option><option>빈칸</option><option>짝맞추기</option>
              <option>주관식</option><option>결과예측</option><option>알고리즘단계</option>
            </select>
          </div>
          <Textarea value={q.question || ""} onChange={e => update(i, "question", e.target.value)} placeholder="문제" className="text-sm min-h-[40px]" />
          {(q.type === "객관식" || q.type === "OX") && (
            <StringListEditor value={q.options || []} onChange={v => update(i, "options", v)} placeholder="보기" />
          )}
          <Input value={q.answer || ""} onChange={e => update(i, "answer", e.target.value)} placeholder="정답" className="text-sm" />
          <Textarea value={q.explanation || ""} onChange={e => update(i, "explanation", e.target.value)} placeholder="해설" className="text-sm min-h-[40px]" />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />Question 추가</Button>
    </div>
  );
}

// 코드 빈칸 문제 에디터
export function CodeBlanksEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { number: value.length + 1, title: "", description: "", full_code: "", blank_answer: "", explanation: "" }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">빈칸 {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Input value={q.title || ""} onChange={e => update(i, "title", e.target.value)} placeholder="제목" className="text-sm" />
          <Textarea value={q.description || ""} onChange={e => update(i, "description", e.target.value)} placeholder="문제 설명" className="text-sm min-h-[40px]" />
          <Textarea value={q.full_code || ""} onChange={e => update(i, "full_code", e.target.value)} placeholder="전체 코드 (빈칸은 ____________ 로 표시)" className="font-mono text-xs min-h-[100px]" />
          <Input value={q.blank_answer || ""} onChange={e => update(i, "blank_answer", e.target.value)} placeholder="정답 (빈칸에 들어갈 코드)" className="font-mono text-sm" />
          <Textarea value={q.explanation || ""} onChange={e => update(i, "explanation", e.target.value)} placeholder="해설" className="text-sm min-h-[40px]" />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />빈칸 문제 추가</Button>
    </div>
  );
}

// 직접 구현 에디터
export function ImplementationsEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { number: value.length + 1, title: "", description: "", default_code: "", answer_code: "", test_cases: [], grading_mode: "normalize" }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">구현 {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Input value={q.title || ""} onChange={e => update(i, "title", e.target.value)} placeholder="제목 (예: binary_search 함수 완성)" className="text-sm" />
          <Textarea value={q.description || ""} onChange={e => update(i, "description", e.target.value)} placeholder="문제 설명" className="text-sm min-h-[40px]" />
          <Textarea value={q.default_code || ""} onChange={e => update(i, "default_code", e.target.value)} placeholder="학생용 시작 코드" className="font-mono text-xs min-h-[80px]" />
          <Textarea value={q.answer_code || ""} onChange={e => update(i, "answer_code", e.target.value)} placeholder="정답 코드 (관리자용)" className="font-mono text-xs min-h-[80px]" />
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">테스트케이스</Label>
            <TestCasesEditor value={q.test_cases || []} onChange={v => update(i, "test_cases", v)} />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />구현 문제 추가</Button>
    </div>
  );
}

// Mission 에디터
export function MissionsEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { number: value.length + 1, title: "", description: "", default_code: "", expected_output: "", uses_input: false, default_stdin: "", stdin_description: "", grading_mode: "normalize", test_cases: [] }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {value.map((m, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Mission {i + 1}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <Input value={m.title || ""} onChange={e => update(i, "title", e.target.value)} placeholder="Mission 제목" className="text-sm" />
          <Textarea value={m.description || ""} onChange={e => update(i, "description", e.target.value)} placeholder="Mission 설명" className="text-sm min-h-[50px]" />
          <Textarea value={m.default_code || ""} onChange={e => update(i, "default_code", e.target.value)} placeholder="기본 제공 코드" className="font-mono text-xs min-h-[60px]" />
          <Textarea value={m.expected_output || ""} onChange={e => update(i, "expected_output", e.target.value)} placeholder="예상 출력" className="font-mono text-xs min-h-[40px]" />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={m.uses_input || false} onChange={e => update(i, "uses_input", e.target.checked)} />
            input() 사용
          </label>
          {m.uses_input && (
            <>
              <Input value={m.default_stdin || ""} onChange={e => update(i, "default_stdin", e.target.value)} placeholder="기본 입력값" className="text-sm" />
              <Input value={m.stdin_description || ""} onChange={e => update(i, "stdin_description", e.target.value)} placeholder="입력값 설명" className="text-sm" />
            </>
          )}
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">테스트케이스 (자동 채점용)</Label>
            <TestCasesEditor value={m.test_cases || []} onChange={v => update(i, "test_cases", v)} />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />Mission 추가</Button>
    </div>
  );
}

// 테스트케이스 에디터 (공용)
export function TestCasesEditor({ value = [], onChange }) {
  const update = (i, field, v) => {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  };
  const add = () => onChange([...value, { input: "", expected_output: "", hidden: false }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {value.map((tc, i) => (
        <div key={i} className="flex items-start gap-2">
          <Textarea value={tc.input || ""} onChange={e => update(i, "input", e.target.value)} placeholder="입력" className="font-mono text-xs flex-1 min-h-[40px]" />
          <Textarea value={tc.expected_output || ""} onChange={e => update(i, "expected_output", e.target.value)} placeholder="기대 출력" className="font-mono text-xs flex-1 min-h-[40px]" />
          <label className="flex items-center gap-1 text-xs mt-2"><input type="checkbox" checked={tc.hidden || false} onChange={e => update(i, "hidden", e.target.checked)} />숨김</label>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />테스트케이스 추가</Button>
    </div>
  );
}