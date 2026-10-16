import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, File, X, CheckCircle, Layers } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const LEVELS = ["기초", "초급", "중급", "고급"];

// 파일명에서 확장자 제거
function stripExt(name) {
  return name.replace(/\.[^.]+$/, "");
}

// 두 파일명의 유사도 점수 (공통 숫자/단어 비율)
function similarity(a, b) {
  const na = stripExt(a).replace(/[^0-9a-zA-Z가-힣]/g, " ").trim();
  const nb = stripExt(b).replace(/[^0-9a-zA-Z가-힣]/g, " ").trim();
  // 공통 숫자 추출
  const numsA = (na.match(/\d+/g) || []);
  const numsB = (nb.match(/\d+/g) || []);
  const commonNums = numsA.filter(n => numsB.includes(n));
  if (commonNums.length > 0) return commonNums.length * 10;
  // 공통 단어
  const wordsA = na.split(/\s+/).filter(Boolean);
  const wordsB = nb.split(/\s+/).filter(Boolean);
  const common = wordsA.filter(w => wordsB.includes(w));
  return common.length;
}

// 문제 파일과 정답 파일 자동 매칭
function autoMatch(problemFiles, answerFiles) {
  const matched = new Set();
  return problemFiles.map(pf => {
    let best = null, bestScore = -1;
    answerFiles.forEach((af, i) => {
      if (matched.has(i)) return;
      const score = similarity(pf.name, af.name);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    if (best !== null && bestScore > 0) {
      matched.add(best);
      return { ...pf, answerIdx: best };
    }
    return { ...pf, answerIdx: null };
  });
}

export default function COSBulkUpload({ open, onClose, onDone, nextNumber = 1, unitId = "" }) {
  const [step, setStep] = useState("select"); // "select" | "preview" | "uploading" | "done"
  const [problemFiles, setProblemFiles] = useState([]); // [{file, name}]
  const [answerFiles, setAnswerFiles] = useState([]);   // [{file, name}]
  const [rows, setRows] = useState([]); // 미리보기 행: {title, problemFile, answerIdx, max_score, is_published, level, category, round}
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const problemInputRef = useRef();
  const answerInputRef = useRef();
  const { toast } = useToast();

  const reset = () => {
    setStep("select");
    setProblemFiles([]);
    setAnswerFiles([]);
    setRows([]);
    setProgress({ done: 0, total: 0 });
  };

  const handleClose = () => { reset(); onClose(); };

  // 중복 제거 병합 (파일명 + 크기 기준)
  const mergeFiles = (prev, next) => {
    const map = new Map();
    [...prev, ...next].forEach(f => {
      map.set(`${f.name}_${f.file.size}`, f);
    });
    return Array.from(map.values());
  };

  // 파일 선택
  const onProblemFiles = (e) => {
    const files = Array.from(e.target.files || []).map(f => ({ file: f, name: f.name }));
    setProblemFiles(prev => mergeFiles(prev, files));
    e.target.value = "";
  };
  const onAnswerFiles = (e) => {
    const files = Array.from(e.target.files || []).map(f => ({ file: f, name: f.name }));
    setAnswerFiles(prev => mergeFiles(prev, files));
    e.target.value = "";
  };

  // 미리보기 생성
  const buildPreview = () => {
    if (problemFiles.length === 0) {
      toast({ title: "문제 파일을 최소 1개 선택해주세요.", variant: "destructive" });
      return;
    }
    const matched = autoMatch(problemFiles, answerFiles);
    const built = matched.map((pf, i) => ({
      title: stripExt(pf.name),
      problemFileIdx: i,
      answerIdx: pf.answerIdx,
      is_published: true,
      level: "초급",
      category: "",
      round: "",
    }));
    setRows(built);
    setStep("preview");
  };

  // 행 수정
  const updateRow = (i, key, val) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  // 업로드 실행
  const handleUpload = async () => {
    setStep("uploading");
    setProgress({ done: 0, total: rows.length });

    const baseNum = nextNumber;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const pf = problemFiles[row.problemFileIdx];
      const af = row.answerIdx !== null && row.answerIdx !== undefined ? answerFiles[row.answerIdx] : null;

      // 문제 파일 업로드
      let problem_file_url = "", problem_file_name = "";
      if (pf?.file) {
        const r = await base44.integrations.Core.UploadFile({ file: pf.file });
        problem_file_url = r.file_url;
        problem_file_name = pf.name;
      }

      // 정답 파일 업로드
      let answer_file_url = "", answer_file_name = "";
      if (af?.file) {
        const r = await base44.integrations.Core.UploadFile({ file: af.file });
        answer_file_url = r.file_url;
        answer_file_name = af.name;
      }

      await base44.entities.COSProblem.create({
        title: row.title,
        unit_id: unitId || "",
        problem_number: baseNum + i,
        level: row.level,
        category: row.category,
        round: row.round,
        is_published: row.is_published,
        is_active: true,
        problem_file_url,
        problem_file_name,
        answer_file_url,
        answer_file_name,
      });

      setProgress({ done: i + 1, total: rows.length });
    }

    setStep("done");
    toast({ title: `✅ ${rows.length}개 문제가 등록되었습니다.` });
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            COS 문제 일괄 업로드
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: 파일 선택 ── */}
        {step === "select" && (
          <div className="space-y-5 mt-2">
            <p className="text-sm text-gray-500">문제 파일과 정답 파일을 여러 개 선택하면 파일명을 기반으로 자동 매칭합니다.</p>

            {/* 문제 파일 */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">📄 문제 파일 (학생 다운로드용) *</Label>
              <input ref={problemInputRef} type="file" multiple className="hidden" onChange={onProblemFiles} />
              <button onClick={() => problemInputRef.current?.click()}
                className="mt-1.5 w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-green-300 rounded-xl text-green-600 hover:border-green-400 hover:bg-green-50 transition-colors text-sm">
                <Upload className="w-5 h-5" />문제 파일 여러 개 선택 (드래그도 가능)
              </button>
              {problemFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {problemFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                      <File className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button onClick={() => setProblemFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 정답 파일 */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">📎 정답 파일 (채점용, 선택)</Label>
              <input ref={answerInputRef} type="file" multiple className="hidden" onChange={onAnswerFiles} />
              <button onClick={() => answerInputRef.current?.click()}
                className="mt-1.5 w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm">
                <Upload className="w-5 h-5" />정답 파일 여러 개 선택 (선택 사항)
              </button>
              {answerFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {answerFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                      <File className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button onClick={() => setAnswerFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">취소</Button>
              <Button onClick={buildPreview} disabled={problemFiles.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700">
                다음: 미리보기 →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: 미리보기 & 수정 ── */}
        {step === "preview" && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                총 <strong>{rows.length}개</strong> 문제가 생성됩니다. 내용을 확인하고 수정하세요.
              </p>
              <button onClick={() => setStep("select")} className="text-xs text-gray-400 hover:text-gray-600">← 파일 다시 선택</button>
            </div>

            <div className="space-y-3">
              {rows.map((row, i) => {
                const pf = problemFiles[row.problemFileIdx];
                const af = row.answerIdx !== null && row.answerIdx !== undefined ? answerFiles[row.answerIdx] : null;
                const hasAnswer = !!af;

                return (
                  <div key={i} className={`border rounded-xl p-3 space-y-2 ${hasAnswer ? "border-blue-200 bg-blue-50/30" : "border-orange-200 bg-orange-50/30"}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {nextNumber + i}
                      </span>
                      {hasAnswer
                        ? <span className="text-[10px] text-green-600 font-semibold bg-green-100 px-1.5 py-0.5 rounded">✅ 정답 매칭됨</span>
                        : <span className="text-[10px] text-orange-600 font-semibold bg-orange-100 px-1.5 py-0.5 rounded">⚠ 정답 미매칭</span>
                      }
                    </div>

                    {/* 제목 */}
                    <div>
                      <Label className="text-xs text-gray-500">문제 제목</Label>
                      <Input value={row.title} onChange={e => updateRow(i, "title", e.target.value)}
                        className="mt-0.5 h-8 text-sm" />
                    </div>

                    {/* 파일 정보 */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1.5 rounded-lg border border-green-200">
                        <File className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{pf?.name}</span>
                      </div>
                      <div>
                        {hasAnswer ? (
                          <div className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-200">
                            <File className="w-3 h-3 flex-shrink-0" />
                            <span className="flex-1 truncate">{af.name}</span>
                            <button onClick={() => updateRow(i, "answerIdx", null)}
                              className="text-gray-400 hover:text-red-400 flex-shrink-0"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <select
                            value=""
                            onChange={e => updateRow(i, "answerIdx", e.target.value === "" ? null : Number(e.target.value))}
                            className="w-full h-7 text-xs rounded-lg border border-orange-300 px-2 bg-white text-orange-700">
                            <option value="">정답 파일 직접 선택...</option>
                            {answerFiles.map((af, ai) => (
                              <option key={ai} value={ai}>{af.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* 세부 설정 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-gray-500">난이도</Label>
                        <select value={row.level} onChange={e => updateRow(i, "level", e.target.value)}
                          className="mt-0.5 w-full h-7 rounded-md border border-gray-200 text-xs px-1.5 bg-white">
                          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">유형</Label>
                        <Input value={row.category} onChange={e => updateRow(i, "category", e.target.value)}
                          placeholder="스프레드시트" className="mt-0.5 h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">회차</Label>
                        <Input value={row.round} onChange={e => updateRow(i, "round", e.target.value)}
                          placeholder="2024-1회" className="mt-0.5 h-7 text-xs" />
                      </div>
                    </div>

                    {/* 공개 여부 */}
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={row.is_published}
                        onChange={e => updateRow(i, "is_published", e.target.checked)} />
                      <span className="text-xs text-gray-600">학생에게 공개</span>
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("select")} className="flex-1">← 돌아가기</Button>
              <Button onClick={handleUpload} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {rows.length}개 문제 등록하기
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: 업로드 중 ── */}
        {step === "uploading" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-gray-700">업로드 중...</p>
              <p className="text-sm text-gray-500 mt-1">{progress.done} / {progress.total} 완료</p>
            </div>
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {/* ── STEP 4: 완료 ── */}
        {step === "done" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-800 text-lg">{progress.total}개 문제 등록 완료!</p>
              <p className="text-sm text-gray-500 mt-1">문제 목록에서 확인하세요.</p>
            </div>
            <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700 px-8">확인</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}