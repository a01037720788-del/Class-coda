import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { loadAllUnitsWithSource, loadUnitContent } from "@/lib/dataAccess";
import { UNIT_ENTITY_MAP, buildBlocks, BLOCK_TYPE_LABEL } from "@/lib/teachingBlocks";
import { highlightCode } from "@/lib/syntaxHighlight";
import { Button } from "@/components/ui/button";
import PenCanvas from "@/components/teaching/PenCanvas";
import TeacherNotePanel from "@/components/teaching/TeacherNotePanel";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Pen, Highlighter, Eraser, Trash2, Type, ZoomIn, ZoomOut,
  Focus, Eye, Star, Code2, X, StickyNote,
} from "lucide-react";

export default function UnitTeaching() {
  const { subjectType, unitId } = useParams();
  const navigate = useNavigate();

  const [unit, setUnit] = useState(null);
  const [allUnits, setAllUnits] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(1);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  // 펜 도구
  const [penActive, setPenActive] = useState(false);
  const [penTool, setPenTool] = useState("pen");
  const [penColor, setPenColor] = useState("#EF4444");
  const [penWidth, setPenWidth] = useState(3);
  const penRef = useRef(null);
  // 강조/정답/코드 줄 상태 (임시, 저장 안 함)
  const [highlightedBlocks, setHighlightedBlocks] = useState(new Set());
  const [showAnswers, setShowAnswers] = useState({});
  const [highlightedLines, setHighlightedLines] = useState({});
  const [largeCode, setLargeCode] = useState(null); // { code, lang }

  const config = UNIT_ENTITY_MAP[subjectType];

  // ── Unit 로드 ──
  useEffect(() => {
    if (!config) { setLoading(false); return; }
    loadUnit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectType, unitId]);

  const loadUnit = async () => {
    setLoading(true);
    try {
      // 1. 현재 Unit 전체 콘텐츠 로드 (Supabase UUID / Base44 ID 모두 지원)
      const fullUnit = await loadUnitContent(unitId);

      // 2. 목록 로드 (네비게이션용 — 관리 컴포넌트와 동일한 소스 사용)
      let unitList = [];
      try {
        const result = await loadAllUnitsWithSource(subjectType);
        unitList = result?.units || [];
      } catch { /* 폴백 진행 */ }

      // 3. 목록이 비어있거나 algorithm_learning/python인 경우 Base44 Entity에서 직접 로드
      if ((unitList.length === 0 || subjectType === "algorithm_learning" || subjectType === "python") && config?.entity) {
        try {
          const items = await base44.entities[config.entity].list();
          if (items?.length > 0) {
            unitList = items.map((u) => ({ ...u, _source: "base44" }));
          }
        } catch { /* 무시 */ }
      }

      const sorted = [...unitList].sort((a, b) => (a.unit_number || 0) - (b.unit_number || 0));
      setAllUnits(sorted);

      if (fullUnit) {
        setUnit(fullUnit);
        setBlocks(buildBlocks(fullUnit, subjectType));
      } else if (sorted.length > 0) {
        const found = sorted.find((u) => u.id === unitId);
        if (found) {
          setUnit(found);
          setBlocks(buildBlocks(found, subjectType));
        }
      }

      setCurrentBlockIdx(0);
      setHighlightedBlocks(new Set());
      setShowAnswers({});
      setHighlightedLines({});
    } catch (err) {
      console.error("[UnitTeaching] 로드 실패:", err);
    }
    setLoading(false);
  };

  // ── Unit 이동 ──
  const currentUnitIdx = allUnits.findIndex((u) => u.id === unitId);
  const goPrevUnit = () => {
    if (currentUnitIdx > 0) {
      navigate(`/admin/teaching/${subjectType}/${allUnits[currentUnitIdx - 1].id}`);
    }
  };
  const goNextUnit = () => {
    if (currentUnitIdx >= 0 && currentUnitIdx < allUnits.length - 1) {
      navigate(`/admin/teaching/${subjectType}/${allUnits[currentUnitIdx + 1].id}`);
    }
  };

  // ── 블록 이동 ──
  const goPrevBlock = () => setCurrentBlockIdx((i) => Math.max(0, i - 1));
  const goNextBlock = () => setCurrentBlockIdx((i) => Math.min(blocks.length - 1, i + 1));

  // ── 전체 화면 ──
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (largeCode) { setLargeCode(null); return; }
        if (penActive) { setPenActive(false); return; }
        if (focusMode) { setFocusMode(false); return; }
        if (fullscreen) { setFullscreen(false); return; }
      }
      if (e.key === "ArrowLeft" && !largeCode) goPrevBlock();
      if (e.key === "ArrowRight" && !largeCode) goNextBlock();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penActive, focusMode, fullscreen, largeCode, blocks.length]);

  // ── 펜 도구 ──
  const togglePen = () => {
    setPenActive((p) => !p);
    if (!penActive) setShowSidebar(false);
  };
  const clearPen = () => penRef.current?.clear();

  const scrollToBlock = (idx) => {
    const el = document.getElementById(`block-${idx}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── 강조 토글 ──
  const toggleHighlight = (blockIdx) => {
    setHighlightedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockIdx)) next.delete(blockIdx);
      else next.add(blockIdx);
      return next;
    });
  };

  // ── 정답 토글 ──
  const toggleAnswer = (blockIdx) => {
    setShowAnswers((prev) => ({ ...prev, [blockIdx]: !prev[blockIdx] }));
  };

  // ── 코드 줄 강조 ──
  const toggleLineHighlight = (blockIdx, lineIdx) => {
    setHighlightedLines((prev) => ({
      ...prev,
      [blockIdx]: prev[blockIdx] === lineIdx ? null : lineIdx,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!config || !unit) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500 mb-4">Unit을 찾을 수 없습니다.</p>
        <Link to="/admin/subjects"><Button variant="outline">과목 관리로</Button></Link>
      </div>
    );
  }

  const visibleBlocks = focusMode ? [blocks[currentBlockIdx]] : blocks;
  const visibleIndices = focusMode ? [currentBlockIdx] : blocks.map((_, i) => i);

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-white overflow-auto flex flex-col" : "flex flex-col h-screen bg-gray-50"}>
      {/* ── 상단 툴바 ── */}
      <div className={`flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0 ${fullscreen ? "hidden" : ""}`}>
        <Link to="/admin/subjects">
          <Button variant="ghost" size="sm" className="text-gray-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Unit 목록
          </Button>
        </Link>
        <div className="h-5 w-px bg-gray-200" />
        <span className="text-sm font-bold text-violet-600">{config.label}</span>
        <span className="text-sm text-gray-400">›</span>
        <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
          Unit {unit.unit_number}. {unit.title}
        </span>

        <div className="flex-1" />

        {/* 글씨 크기 조절 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1">
          <button onClick={() => setFontSize((f) => Math.max(0.7, f - 0.1))} className="p-1.5 hover:bg-gray-200 rounded" title="글씨 작게">
            <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <span className="text-xs text-gray-500 px-1">{Math.round(fontSize * 100)}%</span>
          <button onClick={() => setFontSize(1)} className="p-1.5 hover:bg-gray-200 rounded" title="기본 크기">
            <Type className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button onClick={() => setFontSize((f) => Math.min(2.0, f + 0.1))} className="p-1.5 hover:bg-gray-200 rounded" title="글씨 크게">
            <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* 펜 도구 */}
        <button
          onClick={togglePen}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${penActive ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          title="펜 모드"
        >
          <Pen className="w-3.5 h-3.5" />
          펜
        </button>
        {penActive && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1.5 py-1">
            <button onClick={() => setPenTool("pen")} className={`p-1 rounded ${penTool === "pen" ? "bg-white shadow-sm" : ""}`} title="펜">
              <Pen className="w-3.5 h-3.5 text-gray-700" />
            </button>
            <button onClick={() => setPenTool("highlighter")} className={`p-1 rounded ${penTool === "highlighter" ? "bg-white shadow-sm" : ""}`} title="형광펜">
              <Highlighter className="w-3.5 h-3.5 text-yellow-500" />
            </button>
            <button onClick={() => setPenTool("eraser")} className={`p-1 rounded ${penTool === "eraser" ? "bg-white shadow-sm" : ""}`} title="지우개">
              <Eraser className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <div className="flex gap-0.5 ml-1">
              {["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#000000"].map((c) => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  className={`w-4 h-4 rounded-full border ${penColor === c ? "ring-2 ring-offset-1 ring-gray-400" : "border-gray-200"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button onClick={clearPen} className="flex items-center gap-1 px-2 py-1 hover:bg-red-100 rounded ml-1 text-xs font-medium text-red-500" title="모두 지우기">
              <Trash2 className="w-3.5 h-3.5" />
              모두 지우기
            </button>
          </div>
        )}

        <div className="h-5 w-px bg-gray-200" />

        {/* 집중 설명 / 전체 화면 / 메모 */}
        <button
          onClick={() => setFocusMode((f) => !f)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium ${focusMode ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          title="집중 설명 모드"
        >
          <Focus className="w-3.5 h-3.5" />
          집중
        </button>
        <button
          onClick={() => setShowNotes((s) => !s)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium ${showNotes ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          title="관리자 메모"
        >
          <StickyNote className="w-3.5 h-3.5" />
          메모
        </button>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="전체 화면"
        >
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          전체화면
        </button>
      </div>

      {/* ── Unit 이동 바 ── */}
      <div className={`flex items-center justify-between px-4 py-1.5 bg-violet-50 border-b border-violet-100 flex-shrink-0 ${fullscreen ? "hidden" : ""}`}>
        <Button variant="ghost" size="sm" onClick={goPrevUnit} disabled={currentUnitIdx <= 0} className="text-violet-600">
          <ChevronLeft className="w-4 h-4" /> 이전 Unit
        </Button>
        <span className="text-xs text-violet-500">
          Unit {currentUnitIdx + 1} / {allUnits.length}
        </span>
        <Button variant="ghost" size="sm" onClick={goNextUnit} disabled={currentUnitIdx >= allUnits.length - 1} className="text-violet-600">
          다음 Unit <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* ── 본문 영역 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 목차 사이드바 */}
        {showSidebar && !fullscreen && !focusMode && (
          <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="px-3 py-2 text-xs font-bold text-gray-400 border-b border-gray-100 sticky top-0 bg-white">
              📋 목차 ({blocks.length})
            </div>
            {blocks.map((b, i) => (
              <button
                key={i}
                onClick={() => { setCurrentBlockIdx(i); scrollToBlock(i); }}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 flex items-start gap-1.5 transition-colors ${
                  currentBlockIdx === i ? "bg-violet-50 text-violet-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="flex-shrink-0">{BLOCK_TYPE_LABEL[b.type] || "📌"}</span>
                <span className="truncate">{b.title}</span>
                {highlightedBlocks.has(i) && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {/* 메인 콘텐츠 */}
        <div
          className="flex-1 overflow-y-auto px-6 md:px-10 py-6"
          style={{ fontSize: `${fontSize}rem` }}
          ref={(el) => {
            if (el && focusMode && currentBlockIdx !== null) {
              // focusMode에서 블록 변경 시 스크롤 상단
            }
          }}
        >
          {focusMode && blocks[currentBlockIdx] && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{BLOCK_TYPE_LABEL[blocks[currentBlockIdx].type]}</span>
                <span>{currentBlockIdx + 1} / {blocks.length}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={goPrevBlock} disabled={currentBlockIdx === 0}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goNextBlock} disabled={currentBlockIdx >= blocks.length - 1}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {visibleBlocks.map((block, vi) => {
            const realIdx = visibleIndices[vi];
            return (
              <BlockRenderer
                key={realIdx}
                block={block}
                blockIdx={realIdx}
                subjectType={subjectType}
                lang={config.lang}
                fontSize={fontSize}
                highlighted={highlightedBlocks.has(realIdx)}
                onToggleHighlight={() => toggleHighlight(realIdx)}
                showAnswer={showAnswers[realIdx]}
                onToggleAnswer={() => toggleAnswer(realIdx)}
                highlightedLine={highlightedLines[realIdx]}
                onLineClick={(li) => toggleLineHighlight(realIdx, li)}
                onLargeCode={(code, lang) => setLargeCode({ code, lang })}
              />
            );
          })}

          {blocks.length === 0 && (
            <div className="text-center text-gray-400 py-20">콘텐츠가 없습니다.</div>
          )}
        </div>

        {/* 우측 관리자 메모 패널 */}
        {showNotes && (
          <TeacherNotePanel
            unitId={unitId}
            unitType={subjectType}
            subjectName={config.label}
            onClose={() => setShowNotes(false)}
          />
        )}
      </div>

      {/* ── 하단 블록 이동 바 (집중 모드) ── */}
      {focusMode && (
        <div className="flex items-center justify-center gap-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
          <Button variant="outline" onClick={goPrevBlock} disabled={currentBlockIdx === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 이전
          </Button>
          <span className="text-sm text-gray-500">
            {currentBlockIdx + 1} / {blocks.length}
          </span>
          <Button variant="outline" onClick={goNextBlock} disabled={currentBlockIdx >= blocks.length - 1}>
            다음 <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── 펜 캔버스 오버레이 ── */}
      <PenCanvas ref={penRef} active={penActive} tool={penTool} color={penColor} lineWidth={penWidth} />

      {/* ── 코드 크게 보기 모달 ── */}
      {largeCode && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-8" onClick={() => setLargeCode(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLargeCode(null)}>
            <X className="w-8 h-8" />
          </button>
          <pre
            className="bg-gray-900 text-gray-100 rounded-xl p-8 max-w-5xl w-full overflow-x-auto"
            style={{ fontSize: `${Math.max(fontSize * 1.5, 1.3)}rem`, lineHeight: 1.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <code dangerouslySetInnerHTML={{ __html: highlightCode(largeCode.code, largeCode.lang) }} />
          </pre>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 블록 렌더러
// ═══════════════════════════════════════════════
function BlockRenderer({ block, blockIdx, subjectType, lang, fontSize, highlighted, onToggleHighlight, showAnswer, onToggleAnswer, highlightedLine, onLineClick, onLargeCode }) {
  const blockStyle = highlighted
    ? "ring-2 ring-amber-400 bg-amber-50/30"
    : "ring-1 ring-gray-100";

  return (
    <div className={`mb-6 bg-white rounded-xl shadow-sm p-6 md:p-8 transition-all scroll-mt-20 ${blockStyle}`} id={`block-${blockIdx}`}>
      {/* 블록 헤더 */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-900 flex items-center gap-2" style={{ fontSize: `${fontSize * 1.3}rem` }}>
          <span>{BLOCK_TYPE_LABEL[block.type] || "📌"}</span>
          {block.title}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={onToggleHighlight}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${highlighted ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-500 hover:bg-amber-100"}`}
            title="중요 표시"
          >
            <Star className={`w-3.5 h-3.5 ${highlighted ? "fill-white" : ""}`} />
            강조
          </button>
        </div>
      </div>

      {/* 블록 본문 */}
      <div className="block-content">
        {block.type === "objectives" && <ObjectivesBlock data={block.data} fontSize={fontSize} />}
        {block.type === "concept" && <ConceptBlock data={block.data} lang={lang} fontSize={fontSize} onLargeCode={onLargeCode} />}
        {block.type === "table" && <TableBlock data={block.data} fontSize={fontSize} />}
        {block.type === "text_list" && <TextListBlock data={block.data} fontSize={fontSize} />}
        {block.type === "algorithm_flow" && <AlgorithmFlowBlock data={block.data} fontSize={fontSize} />}
        {block.type === "code" && <CodeBlock data={block.data} lang={lang} fontSize={fontSize} highlightedLine={highlightedLine} onLineClick={onLineClick} onLargeCode={onLargeCode} />}
        {block.type === "question" && <QuestionBlock data={block.data} fontSize={fontSize} showAnswer={showAnswer} onToggleAnswer={onToggleAnswer} />}
        {block.type === "mission" && <MissionBlock data={block.data} lang={lang} fontSize={fontSize} showAnswer={showAnswer} onToggleAnswer={onToggleAnswer} highlightedLine={highlightedLine} onLineClick={onLineClick} onLargeCode={onLargeCode} />}
        {block.type === "code_blank" && <CodeBlankBlock data={block.data} fontSize={fontSize} showAnswer={showAnswer} onToggleAnswer={onToggleAnswer} />}
        {block.type === "implementation" && <ImplementationBlock data={block.data} lang={lang} fontSize={fontSize} showAnswer={showAnswer} onToggleAnswer={onToggleAnswer} />}
        {block.type === "summary" && <SummaryBlock data={block.data} fontSize={fontSize} />}
      </div>
    </div>
  );
}

// ── 학습 목표 ──
function ObjectivesBlock({ data, fontSize }) {
  return (
    <ul className="space-y-2" style={{ fontSize: `${fontSize * 1.1}rem` }}>
      {data.map((obj, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-700">
          <span className="flex-shrink-0 w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
            {i + 1}
          </span>
          <span>{obj}</span>
        </li>
      ))}
    </ul>
  );
}

// ── 개념 설명 ──
function ConceptBlock({ data, lang, fontSize, onLargeCode }) {
  return (
    <div className="space-y-4">
      {(data.lines || []).length > 0 && (
        <div className="space-y-2" style={{ fontSize: `${fontSize * 1.1}rem` }}>
          {data.lines.map((line, i) => (
            <p key={i} className="text-gray-700 leading-relaxed">{line}</p>
          ))}
        </div>
      )}
      {data.code_example && (
        <div>
          <div className="flex justify-end mb-1">
            <button
              onClick={() => onLargeCode(data.code_example, lang)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <Code2 className="w-3.5 h-3.5" /> 코드 크게 보기
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto" style={{ fontSize: `${fontSize * 0.95}rem` }}>
            <code dangerouslySetInnerHTML={{ __html: highlightCode(data.code_example, lang) }} />
          </pre>
        </div>
      )}
    </div>
  );
}

// ── 표 ──
function TableBlock({ data, fontSize }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ fontSize: `${fontSize * 1.05}rem` }}>
        <thead>
          <tr>
            {(data.headers || []).map((h, i) => (
              <th key={i} className="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold text-gray-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((row, ri) => (
            <tr key={ri} className="hover:bg-gray-50">
              {row.map((cell, ci) => (
                <td key={ci} className="border border-gray-300 px-4 py-2 text-gray-600">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 텍스트 리스트 ──
function TextListBlock({ data, fontSize }) {
  return (
    <ul className="space-y-2" style={{ fontSize: `${fontSize * 1.1}rem` }}>
      {data.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-700">
          <span className="text-violet-400 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── 알고리즘 흐름 ──
function AlgorithmFlowBlock({ data, fontSize }) {
  return (
    <div className="space-y-3" style={{ fontSize: `${fontSize * 1.1}rem` }}>
      {data.map((step, i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg">
          <span className="flex-shrink-0 w-7 h-7 bg-violet-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-violet-900">{step.step}</p>
            {step.description && <p className="text-gray-600 mt-1">{step.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 예제 코드 ──
function CodeBlock({ data, lang, fontSize, highlightedLine, onLineClick, onLargeCode }) {
  const code = data.code || data.html || "";
  const displayLang = data.html ? "html" : lang;
  const lines = code.split("\n");

  return (
    <div>
      {data.description && <p className="text-gray-600 mb-3" style={{ fontSize: `${fontSize * 1.05}rem` }}>{data.description}</p>}
      <div className="flex justify-end mb-1 gap-1">
        <button
          onClick={() => onLargeCode(code, displayLang)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          <Code2 className="w-3.5 h-3.5" /> 코드 크게 보기
        </button>
      </div>
      <pre className="bg-gray-900 text-gray-100 rounded-lg overflow-x-auto" style={{ fontSize: `${fontSize * 0.95}rem` }}>
        {lines.map((line, i) => (
          <div
            key={i}
            onClick={() => onLineClick(i)}
            className={`flex cursor-pointer hover:bg-white/5 ${highlightedLine === i ? "bg-yellow-500/30 border-l-2 border-yellow-400" : ""}`}
          >
            <span className="text-gray-500 select-none pr-3 pl-3 text-right" style={{ minWidth: "2.5em" }}>{i + 1}</span>
            <span className="flex-1 pr-4" dangerouslySetInnerHTML={{ __html: highlightCode(line, displayLang) || "&nbsp;" }} />
          </div>
        ))}
      </pre>
      {data.expected_output && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-xs text-green-600 font-semibold">예상 출력:</span>
          <pre className="text-green-800 mt-1" style={{ fontSize: `${fontSize * 0.9}rem` }}>{data.expected_output}</pre>
        </div>
      )}
    </div>
  );
}

// ── 문제 ──
function QuestionBlock({ data, fontSize, showAnswer, onToggleAnswer }) {
  return (
    <div>
      <p className="font-medium text-gray-800 mb-3" style={{ fontSize: `${fontSize * 1.15}rem` }}>{data.question}</p>
      {data.code_block && (
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 mb-3 overflow-x-auto" style={{ fontSize: `${fontSize * 0.9}rem` }}>
          <code>{data.code_block}</code>
        </pre>
      )}
      {data.options?.length > 0 && (
        <div className="space-y-2" style={{ fontSize: `${fontSize * 1.1}rem` }}>
          {data.options.map((opt, i) => (
            <div key={i} className={`p-2 rounded-lg ${showAnswer && opt === data.answer ? "bg-green-100 text-green-800 font-semibold" : "bg-gray-50 text-gray-700"}`}>
              <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
            </div>
          ))}
        </div>
      )}
      {data.pairs?.length > 0 && (
        <div className="grid grid-cols-2 gap-2" style={{ fontSize: `${fontSize * 1.05}rem` }}>
          {data.pairs.map((p, i) => (
            <div key={i} className="flex gap-2 p-2 bg-gray-50 rounded">
              <span className="font-semibold text-gray-700">{p.left}</span>
              <span className="text-gray-400">↔</span>
              <span className="text-gray-700">{p.right}</span>
            </div>
          ))}
        </div>
      )}
      {data.code_items?.length > 0 && (
        <div className="space-y-2">
          {data.code_items.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3">
              {item.description && <p className="text-sm text-gray-500 mb-1">{item.description}</p>}
              <pre className="bg-gray-900 text-gray-100 rounded p-2 text-sm overflow-x-auto"><code>{item.code}</code></pre>
              {item.expected_output && <p className="text-xs text-green-600 mt-1">출력: {item.expected_output}</p>}
            </div>
          ))}
        </div>
      )}
      {/* 관리자 전용 정답 보기 */}
      <button
        onClick={onToggleAnswer}
        className="mt-4 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
      >
        <Eye className="w-4 h-4" />
        {showAnswer ? "정답 숨기기" : "정답 보기"}
      </button>
      {showAnswer && (
        <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
          {data.answer && (
            <div>
              <span className="text-xs font-bold text-red-600">★ 정답:</span>
              <p className="text-red-900 font-semibold" style={{ fontSize: `${fontSize * 1.1}rem` }}>{data.answer}</p>
            </div>
          )}
          {data.explanation && (
            <div>
              <span className="text-xs font-bold text-red-600">📝 해설:</span>
              <p className="text-gray-700" style={{ fontSize: `${fontSize * 1.05}rem` }}>{data.explanation}</p>
            </div>
          )}
          {data.expected_output && !data.options?.length && (
            <div>
              <span className="text-xs font-bold text-red-600">예상 출력:</span>
              <pre className="text-green-800 mt-1">{data.expected_output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 미션 ──
function MissionBlock({ data, lang, fontSize, showAnswer, onToggleAnswer, highlightedLine, onLineClick, onLargeCode }) {
  return (
    <div>
      <p className="font-medium text-gray-800 mb-2" style={{ fontSize: `${fontSize * 1.15}rem` }}>{data.description}</p>
      {data.example && (
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-sm text-gray-600 overflow-x-auto">{data.example}</pre>
      )}
      {data.input_condition && <p className="text-sm text-blue-600 mb-1">입력: {data.input_condition}</p>}
      {data.output_condition && <p className="text-sm text-green-600 mb-1">출력: {data.output_condition}</p>}
      {data.expected_output && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-sm">
          <span className="text-green-600 font-semibold">예상 출력: </span>
          <pre className="text-green-800 inline">{data.expected_output}</pre>
        </div>
      )}
      {data.default_code && (
        <div>
          <p className="text-xs text-gray-400 mb-1">시작 코드:</p>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 mb-3 overflow-x-auto text-sm"><code dangerouslySetInnerHTML={{ __html: highlightCode(data.default_code, lang) }} /></pre>
        </div>
      )}
      {/* 관리자 전용 정답 코드 보기 */}
      {data.answer_code && (
        <>
          <button
            onClick={onToggleAnswer}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 mb-2"
          >
            <Eye className="w-4 h-4" />
            {showAnswer ? "정답 코드 숨기기" : "정답 코드 보기"}
          </button>
          {showAnswer && (
            <div>
              <div className="flex justify-end mb-1">
                <button
                  onClick={() => onLargeCode(data.answer_code, lang)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  <Code2 className="w-3.5 h-3.5" /> 크게 보기
                </button>
              </div>
              <pre className="bg-gray-900 text-green-100 rounded-lg p-4 overflow-x-auto border-2 border-red-300" style={{ fontSize: `${fontSize * 0.95}rem` }}>
                {data.answer_code.split("\n").map((line, i) => (
                  <div
                    key={i}
                    onClick={() => onLineClick(i)}
                    className={`flex cursor-pointer hover:bg-white/5 ${highlightedLine === i ? "bg-yellow-500/30 border-l-2 border-yellow-400" : ""}`}
                  >
                    <span className="text-gray-500 select-none pr-3 text-right" style={{ minWidth: "2.5em" }}>{i + 1}</span>
                    <span className="flex-1 pr-4" dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) || "&nbsp;" }} />
                  </div>
                ))}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 코드 빈칸 ──
function CodeBlankBlock({ data, fontSize, showAnswer, onToggleAnswer }) {
  return (
    <div>
      {data.description && <p className="text-gray-600 mb-3" style={{ fontSize: `${fontSize * 1.05}rem` }}>{data.description}</p>}
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto mb-3" style={{ fontSize: `${fontSize * 0.95}rem` }}>
        <code>{data.full_code}</code>
      </pre>
      <button
        onClick={onToggleAnswer}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
      >
        <Eye className="w-4 h-4" />
        {showAnswer ? "정답 숨기기" : "정답 보기"}
      </button>
      {showAnswer && (
        <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-xs font-bold text-red-600">★ 정답:</span>
          <p className="text-red-900 font-semibold" style={{ fontSize: `${fontSize * 1.1}rem` }}>{data.blank_answer}</p>
          {data.explanation && <p className="text-gray-700 mt-2">{data.explanation}</p>}
        </div>
      )}
    </div>
  );
}

// ── 직접 구현 ──
function ImplementationBlock({ data, lang, fontSize, showAnswer, onToggleAnswer }) {
  return (
    <div>
      {data.description && <p className="text-gray-600 mb-3" style={{ fontSize: `${fontSize * 1.05}rem` }}>{data.description}</p>}
      {data.default_code && (
        <div>
          <p className="text-xs text-gray-400 mb-1">시작 코드:</p>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 mb-3 overflow-x-auto text-sm"><code dangerouslySetInnerHTML={{ __html: highlightCode(data.default_code, lang) }} /></pre>
        </div>
      )}
      {data.answer_code && (
        <>
          <button
            onClick={onToggleAnswer}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
          >
            <Eye className="w-4 h-4" />
            {showAnswer ? "정답 코드 숨기기" : "정답 코드 보기"}
          </button>
          {showAnswer && (
            <pre className="mt-2 bg-gray-900 text-green-100 rounded-lg p-4 overflow-x-auto border-2 border-red-300" style={{ fontSize: `${fontSize * 0.95}rem` }}>
              <code dangerouslySetInnerHTML={{ __html: highlightCode(data.answer_code, lang) }} />
            </pre>
          )}
        </>
      )}
    </div>
  );
}

// ── 핵심 요약 ──
function SummaryBlock({ data, fontSize }) {
  return (
    <ul className="space-y-2" style={{ fontSize: `${fontSize * 1.1}rem` }}>
      {data.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-gray-700 p-2 bg-violet-50 rounded-lg">
          <span className="text-violet-500 flex-shrink-0">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}