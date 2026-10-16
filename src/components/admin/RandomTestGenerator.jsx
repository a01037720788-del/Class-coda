import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Wand2, Loader2, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { analyzeInputPatterns } from "@/lib/inputAnalysis";

const DATA_TYPES = [
  { value: "integer", label: "정수" },
  { value: "float", label: "실수" },
  { value: "string", label: "문자열" },
  { value: "choice", label: "선택값" },
];

export default function RandomTestGenerator({ mission, onChange }) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null); // { test_cases, warning }
  const [answerChanged, setAnswerChanged] = useState(false);

  const enabled = mission.random_test_enabled === true;
  const count = mission.random_test_count ?? 10;
  const specs = mission.random_input_specs || [];
  const existingTests = mission.test_cases || [];

  const update = (field, val) => onChange({ ...mission, [field]: val });

  const handleAnswerCodeChange = (val) => {
    update("answer_code", val);
    if (existingTests.length > 0) setAnswerChanged(true);
  };

  const updateSpec = (i, field, val) => {
    const next = [...specs];
    next[i] = { ...next[i], [field]: val };
    onChange({ ...mission, random_input_specs: next });
  };

  const addSpec = () => {
    onChange({
      ...mission,
      random_input_specs: [...specs, { name: `input${specs.length + 1}`, data_type: "integer", min: 1, max: 100 }],
    });
  };

  const removeSpec = (i) => {
    onChange({ ...mission, random_input_specs: specs.filter((_, idx) => idx !== i) });
  };

  const handleAutoAnalyze = () => {
    if (!mission.answer_code) {
      toast({ title: "정답 코드를 먼저 입력하세요.", variant: "destructive" });
      return;
    }
    const analyzed = analyzeInputPatterns(mission.answer_code);
    if (analyzed.length === 0) {
      toast({ title: "input() 패턴을 찾을 수 없습니다.", description: "직접 입력 설정을 추가해주세요.", variant: "destructive" });
      return;
    }
    onChange({ ...mission, random_input_specs: analyzed });
    toast({ title: `입력값 ${analyzed.length}개 자동 분석 완료`, description: "필요시 범위를 수정하세요." });
  };

  const handleGenerate = async () => {
    if (!mission.answer_code) {
      toast({ title: "정답 코드를 먼저 입력하세요.", variant: "destructive" });
      return;
    }
    if (specs.length === 0) {
      toast({ title: "입력값 설정을 추가하세요.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setPreview(null);
    try {
      const res = await base44.functions.invoke("generatePythonMissionTests", {
        answer_code: mission.answer_code,
        test_count: count,
        input_specs: specs,
      });
      const data = res.data;
      if (data.error) {
        toast({ title: "생성 실패", description: data.error, variant: "destructive" });
        return;
      }
      setPreview({ test_cases: data.test_cases || [], warning: data.warning || null });
      toast({ title: `${data.test_cases?.length || 0}개 테스트케이스 생성 완료`, description: data.warning || "미리보기를 확인 후 저장하세요." });
    } catch (err) {
      toast({ title: "생성 실패", description: err?.response?.data?.error || err?.message || "오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const removePreviewItem = (i) => {
    if (!preview) return;
    setPreview({ ...preview, test_cases: preview.test_cases.filter((_, idx) => idx !== i) });
  };

  const handleSavePreview = () => {
    if (!preview) return;
    const existing = mission.test_cases || [];
    onChange({ ...mission, test_cases: [...existing, ...preview.test_cases] });
    toast({ title: `테스트케이스 ${preview.test_cases.length}개 저장 완료` });
    setPreview(null);
  };

  const handleRegenerateAll = () => {
    setPreview(null);
    handleGenerate();
  };

  const handleRecalculate = async () => {
    if (!mission.answer_code) {
      toast({ title: "정답 코드를 먼저 입력하세요.", variant: "destructive" });
      return;
    }
    if (existingTests.length === 0) {
      toast({ title: "재계산할 테스트케이스가 없습니다.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("generatePythonMissionTests", {
        answer_code: mission.answer_code,
        mode: "recalculate",
        existing_test_cases: existingTests,
      });
      const data = res.data;
      if (data.error) {
        toast({ title: "재계산 실패", description: data.error, variant: "destructive" });
        return;
      }
      onChange({ ...mission, test_cases: data.test_cases });
      setAnswerChanged(false);
      toast({ title: `예상 출력 ${data.test_cases.length}개 재계산 완료` });
    } catch (err) {
      toast({ title: "재계산 실패", description: err?.response?.data?.error || err?.message || "오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border border-purple-200 rounded-lg p-3 space-y-3 bg-purple-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-purple-700">🎲 자동 랜덤 테스트케이스</p>
        <label className="flex items-center gap-1.5 text-xs text-purple-700">
          <input type="checkbox" checked={enabled} onChange={e => update("random_test_enabled", e.target.checked)} className="w-3.5 h-3.5" />
          자동 생성 사용
        </label>
      </div>

      {enabled && (
        <>
          {/* 정답 코드 */}
          <div>
            <Label className="text-xs text-purple-600">정답 코드 (학생에게 보이지 않음)</Label>
            <textarea
              value={mission.answer_code || ""}
              onChange={e => handleAnswerCodeChange(e.target.value)}
              placeholder={"a = int(input())\nb = int(input())\nprint(a + b)"}
              rows={4}
              className="w-full text-xs font-mono border border-purple-200 rounded-md p-2 bg-white resize-y focus:outline-none focus:ring-1 focus:ring-purple-400 mt-1"
              spellCheck={false}
              style={{ tabSize: 4, whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto" }}
            />
            <p className="text-xs text-purple-400 mt-1">⚠️ 이 코드는 학생 화면에 절대 표시되지 않습니다.</p>
            {answerChanged && existingTests.length > 0 && (
              <div className="mt-2 border border-amber-300 rounded-lg p-2 bg-amber-50 space-y-1.5">
                <div className="flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>정답 코드가 변경되었습니다. 기존 테스트케이스({existingTests.length}개)의 예상 출력이 오래되었을 수 있습니다.</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button type="button" size="sm" variant="outline" onClick={() => setAnswerChanged(false)}
                    className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-100">
                    기존 테스트케이스 유지
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleRecalculate}
                    disabled={generating}
                    className="h-6 text-xs border-blue-300 text-blue-700 hover:bg-blue-100">
                    예상 출력 다시 계산
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { handleGenerate(); setAnswerChanged(false); }}
                    disabled={generating || specs.length === 0}
                    className="h-6 text-xs border-purple-300 text-purple-700 hover:bg-purple-100">
                    전체 테스트케이스 다시 생성
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 생성 개수 */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-purple-600 whitespace-nowrap">생성 개수</Label>
            <Input type="number" min={1} max={20} value={count}
              onChange={e => update("random_test_count", Math.min(20, Math.max(1, parseInt(e.target.value) || 10)))}
              className="h-7 w-20 text-xs" />
            <span className="text-xs text-gray-400">최대 20개</span>
          </div>

          {/* 입력값 설정 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-purple-600">입력값별 자료형/범위</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={handleAutoAnalyze}
                  className="h-6 text-xs border-purple-300 text-purple-600 hover:bg-purple-100">
                  <Wand2 className="w-3 h-3 mr-1" />정답 코드에서 자동 분석
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={addSpec} className="h-6 text-xs">
                  <Plus className="w-3 h-3 mr-1" />입력값 추가
                </Button>
              </div>
            </div>

            {specs.length === 0 && (
              <p className="text-xs text-purple-400 text-center py-2 bg-white rounded border border-dashed border-purple-200">
                정답 코드의 input() 패턴을 자동 분석하거나 직접 추가하세요.
              </p>
            )}

            {specs.map((spec, i) => (
              <div key={i} className="border border-purple-200 rounded-lg p-2 bg-white space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-purple-500 w-14 flex-shrink-0">입력 {i + 1}</span>
                  <Input value={spec.name || ""} onChange={e => updateSpec(i, "name", e.target.value)}
                    placeholder="이름" className="flex-1 h-7 text-xs" />
                  <select value={spec.data_type || "integer"} onChange={e => updateSpec(i, "data_type", e.target.value)}
                    className="h-7 text-xs border border-gray-200 rounded px-1 bg-white">
                    {DATA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeSpec(i)} className="h-7 w-6 p-0 text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {(spec.data_type === "integer" || spec.data_type === "float") && (
                  <div className="flex items-center gap-2 pl-14">
                    <Label className="text-xs text-gray-500">최소</Label>
                    <Input type="number" value={spec.min ?? ""} onChange={e => updateSpec(i, "min", parseFloat(e.target.value))}
                      className="h-7 w-20 text-xs" />
                    <Label className="text-xs text-gray-500">최대</Label>
                    <Input type="number" value={spec.max ?? ""} onChange={e => updateSpec(i, "max", parseFloat(e.target.value))}
                      className="h-7 w-20 text-xs" />
                  </div>
                )}
                {spec.data_type === "string" && (
                  <div className="flex items-center gap-2 pl-14">
                    <Label className="text-xs text-gray-500">최소 길이</Label>
                    <Input type="number" value={spec.min_length ?? ""} onChange={e => updateSpec(i, "min_length", parseInt(e.target.value))}
                      className="h-7 w-16 text-xs" />
                    <Label className="text-xs text-gray-500">최대 길이</Label>
                    <Input type="number" value={spec.max_length ?? ""} onChange={e => updateSpec(i, "max_length", parseInt(e.target.value))}
                      className="h-7 w-16 text-xs" />
                  </div>
                )}
                {spec.data_type === "choice" && (
                  <div className="pl-14 space-y-1">
                    <Label className="text-xs text-gray-500">선택값 목록 (쉼표로 구분)</Label>
                    <Input value={(spec.choices || []).join(", ")}
                      onChange={e => updateSpec(i, "choices", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                      placeholder="사과, 바나나, 포도" className="h-7 text-xs" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 생성 버튼 */}
          <Button type="button" onClick={handleGenerate} disabled={generating}
            className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white">
            {generating ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />생성 중...</> : <><Wand2 className="w-3 h-3 mr-1" />랜덤 테스트케이스 생성</>}
          </Button>

          {/* 미리보기 */}
          {preview && (
            <div className="border border-purple-300 rounded-lg p-2 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-purple-700">📋 생성 결과 미리보기 ({preview.test_cases.length}개)</p>
                <Button type="button" size="sm" variant="outline" onClick={handleRegenerateAll} disabled={generating}
                  className="h-6 text-xs">
                  <RefreshCw className="w-3 h-3 mr-1" />전체 다시 생성
                </Button>
              </div>
              {preview.warning && (
                <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{preview.warning}</span>
                </div>
              )}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {preview.test_cases.map((tc, i) => (
                  <div key={i} className="flex items-start gap-2 border border-gray-200 rounded p-1.5 bg-gray-50">
                    <span className="text-xs font-bold text-gray-500 w-6 flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="text-xs"><span className="text-gray-400">입력:</span> <code className="text-purple-700">{tc.input}</code></div>
                      <div className="text-xs"><span className="text-gray-400">출력:</span> <code className="text-green-700">{tc.expected_output}</code></div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">숨김</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removePreviewItem(i)} className="h-5 w-5 p-0 text-red-400 flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" onClick={handleSavePreview}
                className="w-full h-7 text-xs bg-green-600 hover:bg-green-700 text-white">
                <Check className="w-3 h-3 mr-1" />테스트케이스 저장
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}