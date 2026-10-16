import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, Type } from "lucide-react";
import {
  EDITOR_THEMES, THEME_GROUPS, EDITOR_FONTS,
  DEFAULT_EDITOR_SETTINGS, getLineHeight, getFontStack,
} from "@/hooks/useEditorSettings";

const PREVIEW_CODE_PY = `def hello(name):
    msg = f"안녕하세요, {name}!"
    print(msg)

hello("CODA")`;

const PREVIEW_CODE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <title>CODA HTML</title>
</head>
<body>
  <h1>Hello, CODA!</h1>
</body>
</html>`;

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];
const LINE_HEIGHTS = [
  { value: "compact", label: "좁게 (1.4)" },
  { value: "normal", label: "기본 (1.6)" },
  { value: "relaxed", label: "넓게 (2.0)" },
];

const GROUP_COLORS = {
  Dark: "text-indigo-600 bg-indigo-50 border-indigo-200",
  Light: "text-amber-700 bg-amber-50 border-amber-200",
  Mac: "text-gray-700 bg-gray-100 border-gray-300",
  Neon: "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200",
  CODA: "text-orange-600 bg-orange-50 border-orange-200",
};

export default function EditorSettingsPanel({ settings, onSave }) {
  const [draft, setDraft] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [previewLang, setPreviewLang] = useState("py");
  const [activeGroup, setActiveGroup] = useState(THEME_GROUPS[0]);

  const set = (key, val) => { setDraft(d => ({ ...d, [key]: val })); setSaved(false); };

  const handleSave = async () => {
    await onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    setDraft({ ...DEFAULT_EDITOR_SETTINGS });
    await onSave(DEFAULT_EDITOR_SETTINGS);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentTheme = EDITOR_THEMES[draft.theme] || EDITOR_THEMES["vscode-dark"];
  const fontStack = getFontStack(draft.font_family || "fira-code");
  const lineHeight = getLineHeight(draft.line_height);
  const previewCode = previewLang === "py" ? PREVIEW_CODE_PY : PREVIEW_CODE_HTML;

  return (
    <div className="space-y-5">

      {/* ── 테마 선택 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
          에디터 테마
          <span className="text-xs font-normal text-gray-400 normal-case">({Object.keys(EDITOR_THEMES).length}개)</span>
        </h3>

        {/* 그룹 탭 */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {THEME_GROUPS.map(g => (
            <button key={g} onClick={() => setActiveGroup(g)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                activeGroup === g
                  ? GROUP_COLORS[g] || "text-violet-600 bg-violet-50 border-violet-200"
                  : "text-gray-500 bg-white border-gray-200 hover:border-gray-400"
              }`}>
              {g}
            </button>
          ))}
        </div>

        {/* 테마 카드 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
          {Object.entries(EDITOR_THEMES)
            .filter(([, t]) => t.group === activeGroup)
            .map(([key, t]) => {
              const selected = draft.theme === key;
              return (
                <button key={key} onClick={() => set("theme", key)}
                  className={`relative rounded-xl border-2 overflow-hidden transition-all text-left hover:scale-[1.02] ${
                    selected ? "border-violet-500 shadow-lg shadow-violet-200 scale-[1.02]" : "border-gray-200 hover:border-gray-400"
                  }`}
                  style={{ boxShadow: selected && t.glow ? `0 0 12px ${t.accent}55` : undefined }}
                >
                  {/* 가짜 툴바 */}
                  <div style={{ background: t.toolbar }} className="px-2.5 py-1.5 flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                  {/* 코드 미리보기 */}
                  <div
                    style={{
                      background: t.bg,
                      boxShadow: t.glow || "none",
                    }}
                    className="px-2 py-2 flex gap-1.5 min-h-[44px]"
                  >
                    <div style={{ color: t.lineNum, fontFamily: "monospace" }} className="text-[8px] leading-[14px] select-none flex-shrink-0">
                      {[1,2,3,4].map(n => <div key={n}>{n}</div>)}
                    </div>
                    <div style={{ color: t.text, fontFamily: "monospace" }} className="text-[8px] leading-[14px] flex-1">
                      <div><span style={{ color: t.accent }}>def</span> hello():</div>
                      <div>&nbsp;&nbsp;<span style={{ color: t.accent }}>print</span>("hi")</div>
                      <div style={{ color: t.lineNum }}># comment</div>
                      <div>hello()</div>
                    </div>
                  </div>
                  {/* 라벨 */}
                  <div style={{ background: t.toolbar }} className="px-2 py-1.5">
                    <p style={{ color: t.text }} className="text-[9px] font-bold truncate">{t.label}</p>
                    <p style={{ color: t.lineNum }} className="text-[8px] leading-tight truncate">{t.desc}</p>
                  </div>
                  {/* 선택 뱃지 */}
                  {selected && (
                    <div className="absolute top-1.5 right-1.5 bg-violet-500 rounded-full p-0.5 shadow">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* ── 폰트 선택 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
          <Type className="w-4 h-4" /> 폰트 선택
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EDITOR_FONTS.map(f => (
            <button key={f.key} onClick={() => set("font_family", f.key)}
              className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                draft.font_family === f.key
                  ? "border-violet-500 bg-violet-50 shadow-sm"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <p className="text-sm font-semibold text-gray-800" style={{ fontFamily: f.stack }}>{f.label}</p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5" style={{ fontFamily: f.stack }}>
                {f.ligature ? "=> !== >= 지원" : "기본 고정폭"}
              </p>
              {f.ligature && (
                <span className="text-[9px] text-violet-500 font-semibold mt-0.5 block">✨ Ligature</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 글자 크기 / 줄 간격 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">글자 크기 · 줄 간격</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-700 font-medium mb-2">글자 크기</p>
            <div className="flex gap-2 flex-wrap">
              {FONT_SIZES.map(s => (
                <button key={s} onClick={() => set("font_size", s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium border transition-all ${
                    draft.font_size === s ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-700 border-gray-300 hover:border-violet-400"
                  }`}>
                  {s}px
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-700 font-medium mb-2">줄 간격</p>
            <div className="flex gap-2 flex-wrap">
              {LINE_HEIGHTS.map(l => (
                <button key={l.value} onClick={() => set("line_height", l.value)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    draft.line_height === l.value ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-700 border-gray-300 hover:border-violet-400"
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 기타 옵션 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">기타 옵션</h3>
        <div className="space-y-3">
          {[
            { key: "show_line_numbers", label: "줄 번호 표시" },
            { key: "word_wrap", label: "자동 줄바꿈" },
          ].map(opt => (
            <div key={opt.key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{opt.label}</span>
              <button
                onClick={() => set(opt.key, !draft[opt.key])}
                className={`relative w-11 h-6 rounded-full transition-colors ${draft[opt.key] ? "bg-violet-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${draft[opt.key] ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── 실시간 미리보기 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">미리보기</h3>
          <div className="flex gap-1">
            {[["py", "Python"], ["html", "HTML"]].map(([k, l]) => (
              <button key={k} onClick={() => setPreviewLang(k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  previewLang === k ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-300"
                }`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: currentTheme.border }}>
          {/* 툴바 */}
          <div style={{ background: currentTheme.toolbar }} className="flex items-center gap-2 px-3 py-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span style={{ color: currentTheme.lineNum, fontFamily: fontStack }} className="ml-2 text-xs">
              {previewLang === "py" ? "main.py" : "index.html"}
            </span>
            {currentTheme.glow && (
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: currentTheme.accent + "30", color: currentTheme.accent }}>
                ✨ effect
              </span>
            )}
          </div>
          {/* 코드 영역 */}
          <div
            style={{
              background: currentTheme.bg,
              boxShadow: currentTheme.glow || "none",
            }}
            className="flex"
          >
            {draft.show_line_numbers && (
              <div
                className="font-mono select-none text-right pr-3 pl-2 pt-3 flex-shrink-0"
                style={{
                  color: currentTheme.lineNum,
                  background: currentTheme.bg,
                  borderRight: `1px solid ${currentTheme.border}`,
                  minWidth: "2.5rem",
                  fontSize: `${draft.font_size}px`,
                  lineHeight,
                  fontFamily: fontStack,
                }}
              >
                {previewCode.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
            )}
            <pre
              style={{
                color: currentTheme.text,
                background: currentTheme.bg,
                fontSize: `${draft.font_size}px`,
                lineHeight,
                fontFamily: fontStack,
                fontFeatureSettings: '"liga" 1, "calt" 1',
                wordBreak: draft.word_wrap ? "break-all" : "normal",
                whiteSpace: draft.word_wrap ? "pre-wrap" : "pre",
                flex: 1,
              }}
              className="p-3"
            >
              {previewCode}
            </pre>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          현재 테마: <span className="font-semibold text-gray-600">{currentTheme.label}</span>
          {currentTheme.glow ? " · 배경 효과 적용됨" : ""}
          {EDITOR_FONTS.find(f => f.key === draft.font_family)?.ligature ? " · Ligature 지원 폰트" : ""}
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleReset} variant="outline" className="gap-2">
          <RotateCcw className="w-4 h-4" />기본값
        </Button>
        <Button onClick={handleSave} className="gap-2 flex-1 bg-violet-600 hover:bg-violet-700">
          {saved ? <><Check className="w-4 h-4" />저장됨!</> : "설정 저장"}
        </Button>
      </div>
    </div>
  );
}