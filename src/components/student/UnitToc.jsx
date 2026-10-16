import React, { useState, useEffect, useCallback } from "react";
import {
  ListChecks, FileText, Table as TableIcon, Code2,
  HelpCircle, Target, BookOpen, StickyNote, ChevronDown, Menu,
} from "lucide-react";

// 공통 Unit 목차 컴포넌트 — 모든 과목(Python, 저학년 Python, C++, HTML, 알고리즘 등)에서 사용
// 목차 항목을 클릭하면 해당 섹션으로 부드러운 스크롤 이동
// IntersectionObserver로 현재 보고 있는 섹션 강조
//
// 사용법:
//   <UnitToc unit={unit} />  // 기본 섹션 자동 감지
//   <UnitToc unit={unit} sections={[{key, label, icon}, ...]} />  // 커스텀 섹션

const SECTION_META = {
  objectives: { label: "학습 목표", icon: ListChecks },
  concept:    { label: "개념 설명", icon: FileText },
  tables:     { label: "표",        icon: TableIcon },
  codes:      { label: "예제 코드", icon: Code2 },
  questions:  { label: "Question",  icon: HelpCircle },
  missions:   { label: "Mission",   icon: Target },
  summary:    { label: "핵심 요약", icon: BookOpen },
  memo:       { label: "Memo",      icon: StickyNote },
};

const SECTION_ORDER = ["objectives", "concept", "tables", "codes", "questions", "missions", "summary", "memo"];

// Unit에 실제 존재하는 섹션만 목차에 표시 (기본 섹션 기준)
export function getAvailableSections(unit) {
  if (!unit) return [];
  return SECTION_ORDER.filter(key => {
    if (key === "objectives") return unit.learning_objectives?.length > 0;
    if (key === "concept") return unit.concept_sections?.length > 0;
    if (key === "tables") return unit.tables?.length > 0;
    if (key === "codes") return unit.example_codes?.length > 0;
    if (key === "questions") return unit.questions?.length > 0;
    if (key === "missions") return unit.missions?.length > 0;
    if (key === "summary") return unit.summary?.length > 0;
    if (key === "memo") return true;
    return false;
  });
}

export default function UnitToc({ unit, sections: customSections }) {
  const [activeSection, setActiveSection] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 커스텀 섹션이 있으면 사용, 없으면 기본 섹션 자동 감지
  const sections = customSections || getAvailableSections(unit).map(key => ({
    key,
    label: SECTION_META[key]?.label || key,
    icon: SECTION_META[key]?.icon || FileText,
  }));

  const sectionKeys = sections.map(s => s.key).join(",");

  useEffect(() => {
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    sections.forEach(s => {
      const el = document.getElementById(s.key);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionKeys]);

  const scrollToSection = useCallback((key) => {
    const el = document.getElementById(key);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMobileOpen(false);
  }, []);

  if (sections.length === 0) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block w-48 flex-shrink-0">
        <div className="sticky top-20 bg-white border border-gray-200 rounded-xl p-3">
          <div className="text-xs font-bold text-gray-400 mb-2 px-1">📋 목차</div>
          <div className="space-y-0.5">
            {sections.map((s, i) => {
              const Icon = s.icon || FileText;
              const isActive = activeSection === s.key;
              return (
                <button key={s.key} onClick={() => scrollToSection(s.key)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                    isActive
                      ? "bg-violet-50 text-violet-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}>
                  <span className="text-xs text-gray-400 flex-shrink-0 w-5">{String(i + 1).padStart(2, "0")}</span>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile collapsible */}
      <div className="md:hidden mb-3">
        <button onClick={() => setMobileOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 w-full">
          <Menu className="w-4 h-4" />
          목차 보기
          <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
        </button>
        {mobileOpen && (
          <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2">
            <div className="flex flex-wrap gap-1.5">
              {sections.map((s, i) => {
                const Icon = s.icon || FileText;
                const isActive = activeSection === s.key;
                return (
                  <button key={s.key} onClick={() => scrollToSection(s.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-violet-100 text-violet-700"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}