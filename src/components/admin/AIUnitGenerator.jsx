/**
 * AIUnitGenerator — 공통 AI Unit 생성 컴포넌트
 * Python, 저학년 Python, C++, Java, HTML 모든 과목에서 재사용.
 *
 * props:
 *   subject: "python" | "junior_python" | "cpp" | "java" | "html"
 *   subjectName: 표시용 과목명 (예: "C++")
 *   previousUnits: 이전 Unit 목록 (AI 참고용)
 *   currentForm: 현재 폼 데이터 (기존 데이터 보호용)
 *   onApply: (partialData, applyMode) => void
 *     - applyMode: "all" | "concepts" | "examples" | "questions" | "missions" | "tables" | "objectives" | "summary"
 *     - partialData: 해당 모드에 맞는 데이터
 */
import React, { useState } from "react";
import { generateAIUnit } from "@/lib/sheetsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sparkles, X, Loader2, Wand2, CheckCircle2, AlertTriangle,
  FileCode, BookOpen, HelpCircle, Target, Rocket, ListChecks,
  ShieldCheck, ShieldX, Plus,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { computeLearningScope, buildScopePromptSection, validateUnitAgainstScope } from "@/lib/learningScope";

const SUBJECT_LABELS = {
  python: "Python",
  junior_python: "저학년 Python",
  cpp: "C++",
  java: "Java",
  html: "HTML/CSS/JS",
};

const LEVEL_OPTIONS = [
  { value: "초급", label: "초급" },
  { value: "중급", label: "중급" },
  { value: "고급", label: "고급" },
  { value: "저학년", label: "저학년" },
];

const DEFAULT_SETTINGS = {
  concept_count: 3,
  table_count: 1,
  example_count: 8,
  question_count: 5,
  mission_count: 5,
};

export default function AIUnitGenerator({
  subject = "python",
  subjectName,
  previousUnits = [],
  currentForm,
  onApply,
}) {
  const [open, setOpen] = useState(false);
  const [unitNumber, setUnitNumber] = useState("");
  const [unitTitle, setUnitTitle] = useState("");
  const [unitTopic, setUnitTopic] = useState("");
  const [level, setLevel] = useState("초급");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [scopeViolations, setScopeViolations] = useState(null);
  const [extraAllowedInput, setExtraAllowedInput] = useState("");
  const [extraAllowed, setExtraAllowed] = useState([]);
  const [applyMode, setApplyMode] = useState(null); // "preview" | "confirm" | "merge-replace"
  const { toast } = useToast();

  const label = subjectName || SUBJECT_LABELS[subject] || subject;

  // 학습 범위 계산 (이전 Unit + 현재 Unit + 관리자 추가 허용)
  const currentUnitNum = Number(unitNumber) || 1;
  const scope = computeLearningScope(previousUnits, currentUnitNum, unitTitle || unitTopic, subject, extraAllowed);

  const handleOpen = () => {
    // 현재 폼의 unit_number로 자동 세팅
    if (currentForm?.unit_number) setUnitNumber(String(currentForm.unit_number));
    if (currentForm?.title) setUnitTitle(currentForm.title);
    setOpen(true);
    setResult(null);
    setError(null);
    setWarnings(null);
    setScopeViolations(null);
    setApplyMode(null);
    setExtraAllowed([]);
    setExtraAllowedInput("");
  };

  const hasExistingData = (currentForm) => {
    if (!currentForm) return false;
    return (
      (currentForm.concept_sections?.length > 0) ||
      (currentForm.example_codes?.length > 0) ||
      (currentForm.questions?.length > 0) ||
      (currentForm.missions?.length > 0) ||
      (currentForm.tables?.length > 0) ||
      (currentForm.learning_objectives?.length > 0) ||
      (currentForm.summary?.length > 0)
    );
  };

  const handleGenerate = async () => {
    if (!unitTopic.trim() && !unitTitle.trim()) {
      toast({ title: "주제 입력 필요", description: "학습 주제 또는 Unit 제목을 입력해주세요.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    setWarnings(null);
    setScopeViolations(null);
    try {
      const computedScope = computeLearningScope(previousUnits, Number(unitNumber) || 1, unitTitle || unitTopic, subject, extraAllowed);
      const payload = {
        subject_type: subject,
        subject_name: label,
        unit_number: Number(unitNumber) || 1,
        title: unitTitle || unitTopic,
        level,
        previous_units: previousUnits.map(u => ({
          unit_number: u.unit_number,
          title: u.title,
          concept_sections: u.concept_sections || [],
          learning_objectives: u.learning_objectives || [],
          summary: u.summary || [],
        })),
        settings,
        extra_prompt: extraPrompt,
        scope_section: buildScopePromptSection(computedScope),
        banned_concepts: computedScope.bannedConcepts,
      };
      const res = await generateAIUnit(payload);
      const data = res?.data || res;
      if (!data.success) {
        throw new Error(data.error || "AI 생성에 실패했습니다.");
      }
      setResult(data.unit);
      setWarnings(data.warnings || null);
      setScopeViolations(data.scopeViolations || null);
      setApplyMode("preview");
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "AI Unit 생성에 실패했습니다.";
      setError(msg);
      toast({ title: "AI Unit 생성 실패", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── 선택적 적용 ──
  const extractSection = (mode) => {
    if (!result) return null;
    switch (mode) {
      case "all":
        return {
          title: result.title,
          subtitle: result.subtitle,
          learning_objectives: result.learning_objectives || [],
          concept_sections: result.concept_sections || [],
          tables: result.tables || [],
          example_codes: result.example_codes || [],
          questions: result.questions || [],
          missions: result.missions || [],
          summary: result.summary || [],
        };
      case "objectives":
        return { learning_objectives: result.learning_objectives || [] };
      case "concepts":
        return { concept_sections: result.concept_sections || [] };
      case "tables":
        return { tables: result.tables || [] };
      case "examples":
        return { example_codes: result.example_codes || [] };
      case "questions":
        return { questions: result.questions || [] };
      case "missions":
        return { missions: result.missions || [] };
      case "summary":
        return { summary: result.summary || [] };
      default:
        return null;
    }
  };

  const handleApplyClick = (mode) => {
    const data = extractSection(mode);
    if (!data) return;

    // 기존 데이터 보호: 전체 적용 또는 해당 섹션에 기존 데이터가 있으면 확인
    const sectionHasData = (m) => {
      if (m === "all") return hasExistingData(currentForm);
      if (m === "objectives") return currentForm?.learning_objectives?.length > 0;
      if (m === "concepts") return currentForm?.concept_sections?.length > 0;
      if (m === "tables") return currentForm?.tables?.length > 0;
      if (m === "examples") return currentForm?.example_codes?.length > 0;
      if (m === "questions") return currentForm?.questions?.length > 0;
      if (m === "missions") return currentForm?.missions?.length > 0;
      if (m === "summary") return currentForm?.summary?.length > 0;
      return false;
    };

    if (sectionHasData(mode)) {
      // 기존 데이터 있음 → 병합/교체 선택
      setApplyMode({ mode, showMergeReplace: true });
    } else {
      // 기존 데이터 없음 → 바로 적용
      doApply(mode, "replace");
    }
  };

  const doApply = (mode, mergeMode) => {
    const data = extractSection(mode);
    if (!data) return;
    onApply(data, mode, mergeMode);
    toast({
      title: "✅ 적용 완료",
      description: mode === "all" ? "전체 Unit 내용이 적용되었습니다." : `${getModeLabel(mode)} 내용이 적용되었습니다.`,
    });
    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setError(null);
    setWarnings(null);
    setScopeViolations(null);
    setApplyMode(null);
    setUnitTopic("");
    setExtraPrompt("");
    setExtraAllowed([]);
    setExtraAllowedInput("");
  };

  const getModeLabel = (mode) => {
    const labels = {
      all: "전체", objectives: "학습 목표", concepts: "개념 설명",
      tables: "표", examples: "예제 코드", questions: "Question", missions: "Mission", summary: "핵심 요약",
    };
    return labels[mode] || mode;
  };

  // ── 미리보기 렌더링 ──
  const renderPreview = () => {
    if (!result) return null;
    return (
      <div className="space-y-3 text-sm">
        {/* 헤더 */}
        <div className="bg-purple-50 rounded-lg p-3">
          <p className="font-bold text-purple-900 text-base">{result.title}</p>
          {result.subtitle && <p className="text-purple-700 text-xs mt-0.5">{result.subtitle}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {result.learning_objectives?.length > 0 && <Badge className="bg-blue-100 text-blue-700 text-xs">목표 {result.learning_objectives.length}</Badge>}
            {result.concept_sections?.length > 0 && <Badge className="bg-green-100 text-green-700 text-xs">개념 {result.concept_sections.length}</Badge>}
            {result.tables?.length > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-xs">표 {result.tables.length}</Badge>}
            {result.example_codes?.length > 0 && <Badge className="bg-purple-100 text-purple-700 text-xs">예제 {result.example_codes.length}</Badge>}
            {result.questions?.length > 0 && <Badge className="bg-orange-100 text-orange-700 text-xs">문제 {result.questions.length}</Badge>}
            {result.missions?.length > 0 && <Badge className="bg-red-100 text-red-700 text-xs">미션 {result.missions.length}</Badge>}
            {result.summary?.length > 0 && <Badge className="bg-gray-100 text-gray-700 text-xs">요약 {result.summary.length}</Badge>}
          </div>
        </div>

        {/* 학습 범위 검증 결과 */}
        {scopeViolations && scopeViolations.length > 0 ? (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 space-y-1">
            <div className="flex items-start gap-2">
              <ShieldX className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-800">
                <p className="font-bold mb-1">⚠ 학습 범위 검사 경고 — 아직 배우지 않은 문법이 발견되었습니다</p>
                {scopeViolations.map((v, i) => <p key={i}>• {v}</p>)}
                <p className="mt-1.5 font-semibold text-red-900">경고가 있는 항목은 적용되지 않습니다. "다시 생성"을 눌러 재시도하세요.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-green-800">학습 범위 검사: 통과</span>
          </div>
        )}

        {warnings && warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <p className="font-bold mb-0.5">검증 경고</p>
              {warnings.map((w, i) => <p key={i}>• {w}</p>)}
            </div>
          </div>
        )}

        {/* 개념 */}
        {result.concept_sections?.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="font-bold text-gray-800 flex items-center gap-1.5 mb-2"><BookOpen className="w-4 h-4 text-green-600" />개념 설명</p>
            {result.concept_sections.map((s, i) => (
              <div key={i} className="mb-2">
                <p className="font-semibold text-gray-700 text-xs">{i + 1}. {s.title}</p>
                <p className="text-gray-500 text-xs ml-3">{(s.lines || []).join(" ").slice(0, 80)}...</p>
              </div>
            ))}
          </div>
        )}

        {/* 예제 */}
        {result.example_codes?.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="font-bold text-gray-800 flex items-center gap-1.5 mb-2"><FileCode className="w-4 h-4 text-purple-600" />예제 코드</p>
            {result.example_codes.map((ex, i) => (
              <p key={i} className="text-xs text-gray-600">{i + 1}. {ex.description || ex.filename || `예제 ${i + 1}`}</p>
            ))}
          </div>
        )}

        {/* Question */}
        {result.questions?.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="font-bold text-gray-800 flex items-center gap-1.5 mb-2"><HelpCircle className="w-4 h-4 text-orange-600" />Question</p>
            {result.questions.map((q, i) => (
              <div key={i} className="mb-1">
                <p className="text-xs text-gray-700">Q{i + 1}. {q.question?.slice(0, 60)}</p>
                <p className="text-xs text-green-600 ml-3">정답: {q.answer?.slice(0, 30)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mission */}
        {result.missions?.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="font-bold text-gray-800 flex items-center gap-1.5 mb-2"><Rocket className="w-4 h-4 text-red-600" />Mission</p>
            {result.missions.map((m, i) => (
              <div key={i} className="mb-1">
                <p className="text-xs text-gray-700">M{i + 1}. {m.title}</p>
                <p className="text-xs text-green-600 ml-3">정답 코드: {m.answer_code ? "✓" : "✗"}</p>
                <p className="text-xs text-blue-600 ml-3">테스트: {m.test_cases?.length || 0}개</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={handleOpen}
        className="h-8 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5" />AI로 Unit 만들기
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI로 Unit 만들기 — {label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 입력 필드 */}
            {!result && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Unit 번호</Label>
                    <Input
                      type="number"
                      value={unitNumber}
                      onChange={e => setUnitNumber(e.target.value)}
                      placeholder="5"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">학생 수준</Label>
                    <select
                      value={level}
                      onChange={e => setLevel(e.target.value)}
                      className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Unit 제목</Label>
                  <Input
                    value={unitTitle}
                    onChange={e => setUnitTitle(e.target.value)}
                    placeholder="예: for 반복문"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">학습 주제 *</Label>
                  <Input
                    value={unitTopic}
                    onChange={e => setUnitTopic(e.target.value)}
                    placeholder="예: for문의 기본 구조와 반복 횟수"
                    className="mt-1"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">이전 Unit에서 배운 내용을 참고하여, 아직 배우지 않은 문법이 나오지 않도록 생성합니다.</p>
                </div>

                <div>
                  <Label className="text-xs">추가 요청사항 (선택)</Label>
                  <Textarea
                    value={extraPrompt}
                    onChange={e => setExtraPrompt(e.target.value)}
                    placeholder="예: for문의 기본 구조와 반복 횟수를 이해할 수 있도록 쉽게 설명해주세요."
                    className="h-16 text-sm mt-1"
                  />
                </div>

                {/* 생성 개수 설정 */}
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5" />생성 개수 설정
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { key: "concept_count", label: "개념", icon: BookOpen, color: "text-green-600" },
                      { key: "table_count", label: "표", icon: ListChecks, color: "text-yellow-600" },
                      { key: "example_count", label: "예제", icon: FileCode, color: "text-purple-600" },
                      { key: "question_count", label: "문제", icon: HelpCircle, color: "text-orange-600" },
                      { key: "mission_count", label: "미션", icon: Rocket, color: "text-red-600" },
                    ].map(({ key, label: l, icon: Icon, color }) => (
                      <div key={key}>
                        <Label className="text-xs flex items-center gap-1 mb-1">
                          <Icon className={`w-3 h-3 ${color}`} />{l}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max="20"
                          value={settings[key]}
                          onChange={e => setSettings(s => ({ ...s, [key]: Math.max(0, Math.min(20, Number(e.target.value) || 0)) }))}
                          className="h-8 text-sm text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 학습 범위 표시 */}
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                  <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                    AI 학습 범위 (Unit {currentUnitNum} 기준)
                  </p>

                  {/* 이전까지 배운 내용 */}
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-1">✓ 이전까지 배운 내용 (Unit 1~{currentUnitNum - 1})</p>
                    {scope.previousConcepts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {scope.previousConcepts.map((k, i) => (
                          <span key={i} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{k}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">이전 Unit이 없습니다.</p>
                    )}
                  </div>

                  {/* 이번 Unit에서 추가 */}
                  {scope.currentUnitConcepts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-700 mb-1">✦ 이번 Unit에서 추가</p>
                      <div className="flex flex-wrap gap-1">
                        {scope.currentUnitConcepts.map((k, i) => (
                          <span key={i} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 아직 사용 금지 */}
                  {scope.bannedLabels.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                        <ShieldX className="w-3 h-3" /> 아직 사용 금지
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {scope.bannedLabels.map((l, i) => (
                          <span key={i} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{l}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 관리자 추가 허용 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">추가 허용 개념 (예외)</p>
                    <div className="flex gap-1.5">
                      <Input
                        value={extraAllowedInput}
                        onChange={e => setExtraAllowedInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && extraAllowedInput.trim()) {
                            e.preventDefault();
                            if (!extraAllowed.includes(extraAllowedInput.trim())) {
                              setExtraAllowed([...extraAllowed, extraAllowedInput.trim()]);
                            }
                            setExtraAllowedInput("");
                          }
                        }}
                        placeholder="예: string"
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (extraAllowedInput.trim() && !extraAllowed.includes(extraAllowedInput.trim())) {
                            setExtraAllowed([...extraAllowed, extraAllowedInput.trim()]);
                            setExtraAllowedInput("");
                          }
                        }}
                      >
                        <Plus className="w-3 h-3" />추가
                      </Button>
                    </div>
                    {extraAllowed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {extraAllowed.map((c, i) => (
                          <span key={i} className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                            {c}
                            <button onClick={() => setExtraAllowed(extraAllowed.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 이전 Unit 참고 정보 */}
                {previousUnits.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                    <p className="text-xs font-bold text-blue-700 mb-1">📚 참고할 이전 Unit ({previousUnits.filter(u => (u.unit_number || 0) < currentUnitNum).length}개)</p>
                    <div className="text-xs text-blue-600 max-h-20 overflow-y-auto">
                      {previousUnits.filter(u => (u.unit_number || 0) < currentUnitNum).map(u => (
                        <span key={u.id} className="inline-block mr-2">Unit {u.unit_number}: {u.title}</span>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-red-800">
                      <p className="font-bold mb-0.5">AI Unit 생성에 실패했습니다.</p>
                      <p>원인: {error}</p>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading || (!unitTopic.trim() && !unitTitle.trim())}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />AI가 Unit을 생성하고 있습니다... (10~30초 소요)</>
                  ) : (
                    <><Wand2 className="w-4 h-4" />Unit 전체 생성</>
                  )}
                </Button>
              </>
            )}

            {/* 미리보기 + 적용 */}
            {result && applyMode === "preview" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-purple-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />생성 완료! 미리보기
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setResult(null); setApplyMode(null); }}>
                    다시 생성
                  </Button>
                </div>
                {renderPreview()}

                <div className="border-t pt-3 space-y-2">
                  {scopeViolations && scopeViolations.length > 0 ? (
                    <div className="text-center py-2">
                      <p className="text-xs text-red-600 font-semibold mb-2">학습 범위 위반으로 적용이 차단되었습니다.</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setResult(null); setApplyMode(null); setScopeViolations(null); }}>
                        다시 생성
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-gray-700">적용할 항목 선택:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" size="sm" onClick={() => handleApplyClick("all")} className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />전체 적용
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleApplyClick("objectives")} className="gap-1.5">
                          <Target className="w-3.5 h-3.5" />학습 목표만
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleApplyClick("concepts")} className="gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />개념 설명만
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleApplyClick("examples")} className="gap-1.5">
                          <FileCode className="w-3.5 h-3.5" />예제 코드만
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleApplyClick("questions")} className="gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5" />Question만
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleApplyClick("missions")} className="gap-1.5">
                          <Rocket className="w-3.5 h-3.5" />Mission만
                        </Button>
                      </div>
                    </>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={handleClose} className="w-full text-gray-500">
                    취소
                  </Button>
                </div>
              </>
            )}

            {/* 기존 데이터 보호: 병합/교체 선택 */}
            {result && applyMode?.showMergeReplace && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-yellow-800">현재 Unit에 이미 내용이 있습니다.</p>
                    <p className="text-xs text-yellow-700 mt-0.5">AI 생성 내용으로 교체하시겠습니까?</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => doApply(applyMode.mode, "merge")}
                    className="w-full justify-start gap-2 border-green-300 hover:bg-green-50 text-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />기존 내용 유지하면서 추가 (권장)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => doApply(applyMode.mode, "replace")}
                    className="w-full justify-start gap-2 bg-red-500 hover:bg-red-600 text-white"
                  >
                    <AlertTriangle className="w-4 h-4" />전체 교체 (기존 내용 삭제)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setApplyMode("preview")}
                    className="w-full text-gray-500"
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}