import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Code2, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function PythonToCppConverter() {
  const [showDialog, setShowDialog] = useState(false);
  const [pythonUnits, setPythonUnits] = useState([]);
  const [cppUnits, setCppUnits] = useState([]);
  const [converting, setConverting] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [result, setResult] = useState(null);
  const [skipExisting, setSkipExisting] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    const [py, cpp] = await Promise.all([
      base44.entities.PythonUnit.list("unit_number"),
      base44.entities.CppUnit.list("unit_number"),
    ]);
    setPythonUnits(py);
    setCppUnits(cpp);
  };

  const openDialog = () => {
    loadData();
    setShowDialog(true);
    setResult(null);
    setSelectedUnit(null);
  };

  const cppExists = (unitNumber) => cppUnits.some(u => u.unit_number === unitNumber);

  const handleConvert = async (pyUnit) => {
    if (cppExists(pyUnit.unit_number)) {
      const ok = window.confirm(
        `이미 C++ Unit ${pyUnit.unit_number}이(가) 존재합니다. 덮어쓰시겠습니까?`
      );
      if (!ok) return;
    }

    setConverting(true);
    setSelectedUnit(pyUnit);
    setResult(null);

    try {
      const prompt = `당신은 Python 교육 자료를 C++ 교육 자료로 변환하는 전문가입니다.
아래 Python Unit 내용을 C++17 문법에 맞게 완전히 변환해주세요.

변환 규칙:
- print() → cout << ... << endl;
- input() → cin >> ...
- int(), float(), str() → int, double, string 자료형 선언  
- list → vector<T>
- dict → map<K,V>
- set → set<T>
- for x in range() → for (int x = ...; ...; x++)
- while → while
- if/elif/else → if/else if/else
- def 함수 → 반환형 있는 C++ 함수
- try/except → try/catch
- class/__init__/__del__ → C++ class/생성자/소멸자
- Python의 len() → .size()
- append() → push_back()
- Python의 ** → pow() (#include <cmath>)
- and/or/not → &&/||/!

Python Unit 데이터 (JSON):
${JSON.stringify(pyUnit, null, 2)}

위 Python Unit을 C++ 버전으로 변환하여 다음 JSON 구조로 반환하세요:
{
  "unit_number": (같은 번호),
  "title": "C++로 변환된 제목",
  "subtitle": "C++ 부제목",
  "concept_sections": [
    {
      "title": "섹션 제목",
      "lines": ["설명 항목들..."],
      "code_example": "C++ 코드 예제"
    }
  ],
  "tables": [...],
  "example_codes": [
    {
      "filename": "unitN_NN.cpp",
      "code": "완전한 C++ 코드 (#include <iostream> 포함)",
      "description": "설명",
      "expected_output": "예상 출력"
    }
  ],
  "questions": [
    {
      "number": 1,
      "type": "multiple_choice",
      "question": "C++ 관련 질문",
      "options": ["선택지들"],
      "answer": "정답",
      "explanation": "해설"
    }
  ],
  "missions": [
    {
      "number": 1,
      "title": "미션 제목",
      "description": "미션 설명",
      "default_code": "C++ 기본 코드 (#include 포함)",
      "expected_output": "예상 출력"
    }
  ],
  "is_active": true
}

중요: 
- 모든 C++ 코드는 반드시 #include <iostream>을 포함하고 int main() { ... return 0; } 구조를 사용
- Python 문법은 절대 사용하지 말고 C++17 문법만 사용
- 개념 설명은 "Python의 X == C++의 Y" 형태로 비교 설명 포함
- 모든 코드는 실제로 컴파일/실행 가능해야 함`;

      const cppData = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            unit_number: { type: "number" },
            title: { type: "string" },
            subtitle: { type: "string" },
            concept_sections: { type: "array", items: { type: "object" } },
            tables: { type: "array", items: { type: "object" } },
            example_codes: { type: "array", items: { type: "object" } },
            questions: { type: "array", items: { type: "object" } },
            missions: { type: "array", items: { type: "object" } },
            is_active: { type: "boolean" }
          }
        }
      });

      // 기존 C++ Unit 덮어쓰기 처리
      const existing = cppUnits.find(u => u.unit_number === pyUnit.unit_number);
      if (existing) {
        await base44.entities.CppUnit.update(existing.id, cppData);
      } else {
        await base44.entities.CppUnit.create(cppData);
      }

      setResult({ success: true, unit: cppData });
      toast({ title: `C++ Unit ${pyUnit.unit_number} 변환 완료!` });
      await loadData();
    } catch (err) {
      setResult({ success: false, error: err.message });
      toast({ title: "변환 실패", description: err.message, variant: "destructive" });
    } finally {
      setConverting(false);
      setSelectedUnit(null);
    }
  };

  const handleConvertAll = async () => {
    const targets = skipExisting
      ? pythonUnits.filter(u => !cppExists(u.unit_number))
      : pythonUnits;
    if (targets.length === 0) {
      toast({ title: "변환할 Unit이 없습니다.", description: "이미 모든 Unit이 C++로 변환되어 있습니다." });
      return;
    }
    const msg = skipExisting
      ? `C++ Unit이 없는 ${targets.length}개 Unit을 변환합니다. 기존 C++ Unit은 건너뜁니다.`
      : `모든 Python Unit(${targets.length}개)을 C++로 변환합니다. 기존 C++ Unit은 덮어씁니다.`;
    if (!window.confirm(msg)) return;

    for (const unit of targets) {
      await handleConvert(unit);
    }
    toast({ title: "전체 변환 완료!" });
  };

  return (
    <>
      <Button onClick={openDialog} variant="outline" className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
        <Code2 className="w-4 h-4" />
        Python → C++ 단원 변환
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-blue-600" />
              Python → C++ 단원 변환 생성
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">AI 변환 기능</p>
              <p>LLM을 사용하여 Python 단원 내용을 C++17 문법으로 자동 변환합니다. 개념 설명, 예제 코드, Q&A, 미션이 모두 C++로 변환됩니다.</p>
            </div>

            {result && (
              <div className={`p-3 rounded-lg border text-sm ${result.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                {result.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Unit {result.unit?.unit_number} 변환 완료: {result.unit?.title}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>오류: {result.error}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={e => setSkipExisting(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                이미 있는 Unit은 패스
              </label>
              <p className="text-sm text-gray-500">Python {pythonUnits.length}개 / C++ {cppUnits.length}개</p>
              <Button size="sm" variant="outline" onClick={handleConvertAll} disabled={converting} className="gap-1.5 text-xs">
                <RefreshCw className={`w-3 h-3 ${converting ? "animate-spin" : ""}`} />
                전체 변환
              </Button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {pythonUnits.map(unit => {
                const hasC = cppExists(unit.unit_number);
                const isConverting = converting && selectedUnit?.id === unit.id;
                return (
                  <div key={unit.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
                        {unit.unit_number}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{unit.title}</p>
                        <p className="text-[11px] text-gray-400">예제 {unit.example_codes?.length || 0}개 / 미션 {unit.missions?.length || 0}개</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasC && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0">C++ 있음</Badge>}
                      <Button
                        size="sm"
                        onClick={() => handleConvert(unit)}
                        disabled={converting}
                        className={`text-xs h-7 px-3 ${hasC ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}`}
                      >
                        {isConverting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : hasC ? "재변환" : "변환"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {pythonUnits.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Python Unit이 없습니다.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}