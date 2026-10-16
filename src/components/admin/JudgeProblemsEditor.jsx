import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronUp, ChevronDown, Wand2, Loader2 } from "lucide-react";
import { runPython } from "@/lib/codeRunner";

function uid() {
  try { return crypto.randomUUID(); } catch { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

// 단일 문제 편집기
function JudgeProblemEditor({ problem, onChange, onDelete, onMoveUp, onMoveDown, index, total }) {
  const update = (field, val) => onChange({ ...problem, [field]: val });
  const [autoGen, setAutoGen] = useState(false);

  const updateTestCase = (i, field, val) => {
    const next = [...(problem.test_cases || [])];
    next[i] = { ...next[i], [field]: val };
    update("test_cases", next);
  };
  const addTestCase = () => {
    const next = [...(problem.test_cases || []), { id: uid(), input: "", expected_output: "", hidden: false, description: "" }];
    update("test_cases", next);
  };
  const removeTestCase = (i) => update("test_cases", (problem.test_cases || []).filter((_, idx) => idx !== i));

  // 정답 출력 자동 계산: answer_code를 각 test input으로 실행
  const autoGenerateOutputs = async () => {
    if (!problem.answer_code?.trim()) { alert("정답 코드를 먼저 입력하세요."); return; }
    if (!problem.test_cases?.length) { alert("테스트케이스를 먼저 추가하세요."); return; }
    setAutoGen(true);
    try {
      const updated = [...problem.test_cases];
      for (let i = 0; i < updated.length; i++) {
        const tc = updated[i];
        const res = await runPython({ code: problem.answer_code, stdin: tc.input || "" });
        if (res.error && !res.output) {
          updated[i] = { ...tc, expected_output: `# 오류: ${res.error}` };
        } else {
          updated[i] = { ...tc, expected_output: (res.output || "").trim() };
        }
      }
      update("test_cases", updated);
    } finally { setAutoGen(false); }
  };

  return (
    <div className="border border-violet-200 rounded-lg p-3 space-y-3 bg-violet-50/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-violet-700">문제 {index + 1}</span>
          <Input
            type="number"
            value={problem.number || index + 1}
            onChange={e => update("number", Number(e.target.value))}
            className="w-16 h-7 text-xs"
          />
          <Badge variant="outline" className="text-xs">{problem.difficulty || "하"}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === 0} onClick={onMoveUp}><ChevronUp className="w-3 h-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === total - 1} onClick={onMoveDown}><ChevronDown className="w-3 h-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>

      <Input value={problem.title || ""} onChange={e => update("title", e.target.value)} placeholder="문제 제목 (예: 특정 값 찾기)" className="text-sm font-medium" />
      <Textarea value={problem.description || ""} onChange={e => update("description", e.target.value)} placeholder="문제 설명" className="text-sm min-h-[60px]" />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-gray-500">입력 설명</Label>
          <Textarea value={problem.input_desc || ""} onChange={e => update("input_desc", e.target.value)} placeholder="입력 형식 설명" className="text-xs min-h-[40px]" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">출력 설명</Label>
          <Textarea value={problem.output_desc || ""} onChange={e => update("output_desc", e.target.value)} placeholder="출력 형식 설명" className="text-xs min-h-[40px]" />
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">제한 조건</Label>
        <Input value={problem.constraints || ""} onChange={e => update("constraints", e.target.value)} placeholder="예: 1 ≤ N ≤ 100,000" className="text-xs" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-gray-500">예제 입력</Label>
          <Textarea value={problem.sample_input || ""} onChange={e => update("sample_input", e.target.value)} placeholder="5&#10;1 3 5 7 9&#10;5" className="font-mono text-xs min-h-[50px]" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">예제 출력</Label>
          <Textarea value={problem.sample_output || ""} onChange={e => update("sample_output", e.target.value)} placeholder="2" className="font-mono text-xs min-h-[50px]" />
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">학생 시작 코드</Label>
        <Textarea value={problem.default_code || ""} onChange={e => update("default_code", e.target.value)} placeholder="# 학생에게 제공될 시작 코드" className="font-mono text-xs min-h-[60px]" />
      </div>
      <div>
        <Label className="text-xs text-gray-500">정답 코드 (관리자용, 학생에게 비공개)</Label>
        <Textarea value={problem.answer_code || ""} onChange={e => update("answer_code", e.target.value)} placeholder="# 정답 코드" className="font-mono text-xs min-h-[60px]" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-xs text-gray-500">난이도</Label>
          <select value={problem.difficulty || "하"} onChange={e => update("difficulty", e.target.value)} className="w-full text-xs border rounded px-1 py-1">
            <option value="하">하</option><option value="중">중</option><option value="상">상</option>
          </select>
        </div>
        <div>
          <Label className="text-xs text-gray-500">시간 제한(초)</Label>
          <Input type="number" value={problem.time_limit ?? 2} onChange={e => update("time_limit", Number(e.target.value))} className="text-xs" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">메모리(MB)</Label>
          <Input type="number" value={problem.memory_limit ?? 256} onChange={e => update("memory_limit", Number(e.target.value))} className="text-xs" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">비교 방식</Label>
          <select value={problem.grading_mode || "normalize"} onChange={e => update("grading_mode", e.target.value)} className="w-full text-xs border rounded px-1 py-1">
            <option value="normalize">normalize</option><option value="exact">exact</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={problem.is_published !== false} onChange={e => update("is_published", e.target.checked)} />
          학생에게 공개
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={problem.stop_on_first_fail === true} onChange={e => update("stop_on_first_fail", e.target.checked)} />
          첫 실패 시 중단
        </label>
      </div>

      {/* 테스트케이스 */}
      <div className="border border-green-200 rounded-lg p-2 space-y-2 bg-green-50">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-green-700">테스트케이스 ({(problem.test_cases || []).length}개)</p>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="outline" onClick={autoGenerateOutputs} disabled={autoGen} className="h-6 text-xs">
              {autoGen ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />계산 중...</> : <><Wand2 className="w-3 h-3 mr-1" />정답 출력 자동 계산</>}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={addTestCase} className="h-6 text-xs"><Plus className="w-3 h-3 mr-1" />추가</Button>
          </div>
        </div>
        {(problem.test_cases || []).map((tc, i) => (
          <div key={tc.id || i} className="border border-green-200 rounded-lg p-2 bg-white space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-green-600">테스트 {i + 1}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input type="checkbox" checked={tc.hidden === true} onChange={e => updateTestCase(i, "hidden", e.target.checked)} className="w-3 h-3" />
                  숨김
                </label>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeTestCase(i)} className="h-6 w-6 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">입력값 (stdin)</Label>
              <Textarea value={tc.input || ""} onChange={e => updateTestCase(i, "input", e.target.value)} placeholder="5&#10;1 3 5 7 9&#10;5" className="font-mono text-xs min-h-[40px]" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">기대 출력</Label>
              <Textarea value={tc.expected_output || ""} onChange={e => updateTestCase(i, "expected_output", e.target.value)} placeholder="2" className="font-mono text-xs min-h-[30px]" />
            </div>
            <Input value={tc.description || ""} onChange={e => updateTestCase(i, "description", e.target.value)} placeholder="설명 (선택)" className="text-xs" />
          </div>
        ))}
        {(!problem.test_cases || problem.test_cases.length === 0) && (
          <p className="text-xs text-green-600 text-center py-1">테스트케이스가 없습니다. 추가 버튼을 눌러 등록하세요.</p>
        )}
      </div>
    </div>
  );
}

export default function JudgeProblemsEditor({ value = [], onChange }) {
  const update = (i, val) => {
    const next = [...value];
    next[i] = val;
    onChange(next);
  };
  const add = () => {
    const newProblem = {
      id: uid(),
      number: value.length + 1,
      title: "",
      description: "",
      input_desc: "",
      output_desc: "",
      constraints: "",
      sample_input: "",
      sample_output: "",
      default_code: "",
      answer_code: "",
      difficulty: "하",
      time_limit: 2,
      memory_limit: 256,
      test_cases: [],
      is_published: true,
      grading_mode: "normalize",
      stop_on_first_fail: false,
      order: value.length,
    };
    onChange([...value, newProblem]);
  };
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    // 번호 재정렬
    next.forEach((p, idx) => { next[idx] = { ...p, number: idx + 1, order: idx }; });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">알고리즘 문제 (온라인 저지)</p>
        <Button type="button" size="sm" variant="outline" onClick={add}><Plus className="w-3 h-3 mr-1" />문제 추가</Button>
      </div>
      <p className="text-xs text-gray-400">💡 각 문제는 고유 ID로 관리되어 순서 변경 시 학생 기록이 유지됩니다. 정답 코드와 숨김 테스트케이스는 학생에게 공개되지 않습니다.</p>
      {value.map((p, i) => (
        <JudgeProblemEditor
          key={p.id || i}
          problem={p}
          index={i}
          total={value.length}
          onChange={(val) => update(i, val)}
          onDelete={() => remove(i)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
        />
      ))}
      {value.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed">
          알고리즘 문제가 없습니다. "문제 추가" 버튼으로 문제를 등록하세요.
        </div>
      )}
    </div>
  );
}