import React, { useState, useEffect } from "react";
import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useTheme, DEFAULT_THEME } from "@/hooks/useTheme";
import { useEditorSettings } from "@/hooks/useEditorSettings";
import EditorSettingsPanel from "@/components/common/EditorSettingsPanel";
import { Palette, Code, RotateCcw, Check } from "lucide-react";

const COLOR_FIELDS = [
  { key: "background_color", label: "전체 배경 색상", group: "레이아웃" },
  { key: "card_color", label: "카드 배경 색상", group: "레이아웃" },
  { key: "button_color", label: "버튼 색상", group: "레이아웃" },
  { key: "accent_color", label: "강조 색상", group: "레이아웃" },
  { key: "example_code_bg", label: "예제 코드 원본 배경", group: "코드 에디터" },
  { key: "example_code_text", label: "예제 코드 원본 글자", group: "코드 에디터" },
  { key: "student_code_bg", label: "내 코드 입력창 배경", group: "코드 에디터" },
  { key: "student_code_text", label: "내 코드 입력창 글자", group: "코드 에디터" },
  { key: "result_bg", label: "실행 결과 배경", group: "코드 에디터" },
  { key: "result_text", label: "실행 결과 글자", group: "코드 에디터" },
];

const PRESET_COLORS = [
  "#ffffff", "#f9fafb", "#f3f4f6", "#111827", "#1e1e1e",
  "#7c3aed", "#2563eb", "#059669", "#dc2626", "#d97706",
  "#86efac", "#93c5fd", "#fde68a", "#f9fafb", "#d4d4d4",
];

const GROUPS = ["레이아웃", "코드 에디터"];

export default function StudentSettings() {
  const u = getSessionUser();
  const sid = u?.student_id;
  const { theme, saveTheme } = useTheme(sid);
  const { settings: editorSettings, saveSettings: saveEditorSettings } = useEditorSettings(sid);
  const [activeTab, setActiveTab] = useState("theme");
  const [draft, setDraft] = useState(theme);
  const [saved, setSaved] = useState(false);

  React.useEffect(() => { setDraft(theme); }, [JSON.stringify(theme)]);

  const handleChange = (key, value) => {
    setDraft(d => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await saveTheme(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    setDraft(DEFAULT_THEME);
    await saveTheme(DEFAULT_THEME);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <Palette className="w-5 h-5 text-[#7c3aed]" />
        <h2 className="text-xl font-bold text-gray-900">설정</h2>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setActiveTab("theme")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "theme" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          <Palette className="w-4 h-4" />화면 테마
        </button>
        <button onClick={() => setActiveTab("editor")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "editor" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
          <Code className="w-4 h-4" />코드 에디터
        </button>
      </div>

      {activeTab === "editor" && (
        <EditorSettingsPanel settings={editorSettings} onSave={saveEditorSettings} />
      )}

      {activeTab === "theme" && (<>

      {GROUPS.map(group => {
        const fields = COLOR_FIELDS.filter(f => f.group === group);
        return (
          <div key={group} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
            <h3 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">{group}</h3>
            <div className="space-y-4">
              {fields.map(field => (
                <div key={field.key} className="flex items-center justify-between gap-4">
                  <label className="text-sm text-gray-700 font-medium flex-1">{field.label}</label>
                  <div className="flex items-center gap-2">
                    {/* Preset colors */}
                    <div className="flex gap-1 flex-wrap max-w-[160px]">
                      {PRESET_COLORS.map(c => (
                        <button key={c} onClick={() => handleChange(field.key, c)}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full border transition-all ${
                            draft[field.key] === c ? "border-gray-800 scale-125" : "border-gray-300 hover:scale-110"
                          }`} title={c} />
                      ))}
                    </div>
                    {/* Color picker */}
                    <div className="relative">
                      <input type="color" value={draft[field.key] || "#ffffff"}
                        onChange={e => handleChange(field.key, e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                    </div>
                    {/* Current color preview */}
                    <div className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0"
                      style={{ backgroundColor: draft[field.key] }} />
                    <span className="text-xs font-mono text-gray-400 w-16">{draft[field.key]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Preview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">미리보기</h3>
        <div className="rounded-lg p-4 border" style={{ backgroundColor: draft.background_color }}>
          <div className="rounded-lg p-4 border mb-3" style={{ backgroundColor: draft.card_color, borderColor: "#e5e7eb" }}>
            <p className="text-sm font-medium mb-2" style={{ color: draft.example_code_text === draft.card_color ? "#374151" : "#374151" }}>카드 영역</p>
            <button className="px-4 py-2 rounded-lg text-white text-sm font-medium mr-2"
              style={{ backgroundColor: draft.button_color }}>버튼</button>
            <button className="px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: draft.accent_color }}>강조 버튼</button>
          </div>
          <div className="rounded-lg p-3 font-mono text-xs mb-2"
            style={{ backgroundColor: draft.example_code_bg, color: draft.example_code_text }}>
            # 예제 코드 영역{"\n"}print("Hello, World!")
          </div>
          <div className="rounded-lg p-3 font-mono text-xs mb-2"
            style={{ backgroundColor: draft.student_code_bg, color: draft.student_code_text }}>
            # 내 코드 입력창{"\n"}answer = input()
          </div>
          <div className="rounded-lg p-3 font-mono text-xs"
            style={{ backgroundColor: draft.result_bg, color: draft.result_text }}>
            실행 결과: Hello, World!
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleReset} variant="outline" className="gap-2">
          <RotateCcw className="w-4 h-4" />기본값으로
        </Button>
        <Button onClick={handleSave} className="gap-2 flex-1" style={{ backgroundColor: draft.button_color }}>
          {saved ? <><Check className="w-4 h-4" />저장됨!</> : "설정 저장"}
        </Button>
      </div>
      </>)}
    </div>
  );
}