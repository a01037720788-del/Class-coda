import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { ALGORITHM_LABELS } from "@/lib/algorithmSimulators";

export default function AIAlgorithmUnitGenerator({ onApply }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("기초");
  const [target, setTarget] = useState("중학생");
  const [extra, setExtra] = useState("");
  const { toast } = useToast();

  const generate = async () => {
    if (!topic.trim()) {
      toast({ title: "주제를 입력해주세요", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const prompt = `알고리즘 학습 Unit을 JSON으로 생성해주세요.
주제: ${topic}
난이도: ${difficulty}
대상: ${target}
추가 요청: ${extra || "없음"}

다음 구조를 가진 JSON 객체를 반환하세요 (마크다운 없이 순수 JSON만):
{
  "title": "알고리즘 이름",
  "subtitle": "부제목",
  "difficulty": "${difficulty}",
  "algorithm_tag": "분류 (탐색/정렬/자료구조/DFS/BFS/그리디/누적합/투포인터/재귀/분할정복/DP/그래프/기타 중 하나)",
  "learning_objectives": ["학습목표1", "학습목표2", "학습목표3"],
  "concept_sections": [{"title": "개념 설명", "lines": ["설명1", "설명2"], "code_example": ""}],
  "why_needed": ["왜 필요한지 이유1", "이유2"],
  "core_idea": ["핵심 아이디어1", "핵심 아이디어2"],
  "algorithm_flow": [{"step": "1단계", "description": "설명"}, {"step": "2단계", "description": "설명"}],
  "simulator": {
    "enabled": true,
    "algorithm_type": "linear_search|binary_search|selection_sort|insertion_sort|bubble_sort|dfs|bfs|stack|queue|two_pointer|prefix_sum|greedy 중 가장 적합한 것",
    "array_data": [1,2,3,4,5],
    "target": 3,
    "description": "시뮬레이터 설명",
    "auto_speed": 1000
  },
  "example_codes": [{"filename": "basic.py", "code": "코드", "description": "기본 구현", "expected_output": "출력", "uses_input": false, "code_explanations": [{"line": "left = 0", "explanation": "탐색 시작 위치"}]}],
  "questions": [{"number": 1, "type": "객관식", "question": "문제", "options": ["보기1","보기2"], "answer": "정답", "explanation": "해설"}],
  "code_blanks": [{"number": 1, "title": "빈칸 문제", "description": "설명", "full_code": "while left <= right:\\n    mid = ____________", "blank_answer": "(left + right) // 2", "explanation": "해설"}],
  "implementations": [{"number": 1, "title": "구현 문제", "description": "설명", "default_code": "def solve():\\n    pass", "answer_code": "정답코드", "test_cases": [{"input": "", "expected_output": ""}], "grading_mode": "normalize"}],
  "missions": [{"number": 1, "title": "Mission", "description": "설명", "default_code": "", "expected_output": "", "uses_input": false, "test_cases": []}],
  "summary": ["요약1", "요약2", "요약3"]
}

${extra ? `추가 요청사항: ${extra}` : ""}
대상 학생(${target})이 이해하기 쉽도록 설명해주세요.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            difficulty: { type: "string" },
            algorithm_tag: { type: "string" },
            learning_objectives: { type: "array", items: { type: "string" } },
            concept_sections: { type: "array", items: { type: "object" } },
            why_needed: { type: "array", items: { type: "string" } },
            core_idea: { type: "array", items: { type: "string" } },
            algorithm_flow: { type: "array", items: { type: "object" } },
            simulator: { type: "object" },
            example_codes: { type: "array", items: { type: "object" } },
            questions: { type: "array", items: { type: "object" } },
            code_blanks: { type: "array", items: { type: "object" } },
            implementations: { type: "array", items: { type: "object" } },
            missions: { type: "array", items: { type: "object" } },
            summary: { type: "array", items: { type: "string" } },
          },
        },
      });

      const data = typeof res === "string" ? JSON.parse(res) : res;
      onApply(data);
      toast({ title: "AI가 Unit을 생성했습니다. 내용을 확인 후 저장하세요." });
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: "AI 생성 실패", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="border-violet-300 text-violet-700 hover:bg-violet-50">
        <Sparkles className="w-3.5 h-3.5 mr-1" />AI로 Unit 만들기
      </Button>
    );
  }

  return (
    <div className="border border-violet-200 rounded-lg p-4 space-y-3 bg-violet-50">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-600" />
        <span className="font-semibold text-sm text-violet-800">AI 알고리즘 Unit 생성</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">주제 (예: 이진탐색)</Label>
          <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="이진탐색" className="text-sm" />
        </div>
        <div>
          <Label className="text-xs">난이도</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="입문">입문</SelectItem>
              <SelectItem value="기초">기초</SelectItem>
              <SelectItem value="중급">중급</SelectItem>
              <SelectItem value="심화">심화</SelectItem>
              <SelectItem value="대회">대회</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">대상</Label>
          <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="중학생" className="text-sm" />
        </div>
        <div>
          <Label className="text-xs">추가 요청</Label>
          <Input value={extra} onChange={e => setExtra(e.target.value)} placeholder="left, mid, right 변화를 쉽게 설명" className="text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={generate} disabled={loading} size="sm" className="bg-violet-600 hover:bg-violet-700">
          {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />생성 중...</> : <><Sparkles className="w-3.5 h-3.5 mr-1" />생성</>}
        </Button>
        <Button onClick={() => setOpen(false)} variant="outline" size="sm">취소</Button>
      </div>
    </div>
  );
}