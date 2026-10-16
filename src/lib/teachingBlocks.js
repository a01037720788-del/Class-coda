// 과목 유형별 Unit 엔티티 매핑
export const UNIT_ENTITY_MAP = {
  python: { entity: "PythonUnit", lang: "python", label: "Python" },
  junior_python: { entity: "JuniorPythonUnit", lang: "python", label: "저학년 Python" },
  cpp: { entity: "CppUnit", lang: "cpp", label: "C++" },
  java: { entity: "JavaUnit", lang: "java", label: "Java" },
  html: { entity: "HTMLUnit", lang: "html", label: "HTML" },
  algorithm_learning: { entity: "AlgorithmUnit", lang: "python", label: "알고리즘 학습" },
  algorithm: { entity: "GenericUnit", lang: "python", label: "알고리즘" },
  entry: { entity: "EntryUnit", lang: "python", label: "엔트리" },
  block: { entity: "GenericUnit", lang: "python", label: "블록코딩" },
  other: { entity: "GenericUnit", lang: "python", label: "기타" },
};

// Unit 데이터에서 콘텐츠 블록 목록 생성
export function buildBlocks(unit, subjectType) {
  const blocks = [];

  // 학습 목표
  if (unit.learning_objectives?.length) {
    blocks.push({ type: "objectives", title: "학습 목표", data: unit.learning_objectives });
  }

  // 개념 설명 섹션
  (unit.concept_sections || []).forEach((s, i) => {
    blocks.push({ type: "concept", title: s.title || `개념 ${i + 1}`, data: s });
  });

  // 표
  (unit.tables || []).forEach((t, i) => {
    blocks.push({ type: "table", title: t.title || `표 ${i + 1}`, data: t });
  });

  // 알고리즘 학습 전용 블록
  if (subjectType === "algorithm_learning") {
    if (unit.why_needed?.length) {
      blocks.push({ type: "text_list", title: "왜 필요한가?", data: unit.why_needed });
    }
    if (unit.core_idea?.length) {
      blocks.push({ type: "text_list", title: "핵심 아이디어", data: unit.core_idea });
    }
    if (unit.algorithm_flow?.length) {
      blocks.push({ type: "algorithm_flow", title: "알고리즘 흐름", data: unit.algorithm_flow });
    }
  }

  // 예제 코드
  (unit.example_codes || []).forEach((c, i) => {
    blocks.push({ type: "code", title: c.filename || c.description || `예제 코드 ${i + 1}`, data: c });
  });

  // 문제
  (unit.questions || []).forEach((q, i) => {
    blocks.push({ type: "question", title: `문제 ${q.number || i + 1}`, data: q });
  });

  // 알고리즘 학습 전용: 코드 빈칸, 직접 구현
  if (subjectType === "algorithm_learning") {
    (unit.code_blanks || []).forEach((b, i) => {
      blocks.push({ type: "code_blank", title: `빈칸 ${b.number || i + 1}. ${b.title || ""}`, data: b });
    });
    (unit.implementations || []).forEach((imp, i) => {
      blocks.push({ type: "implementation", title: `구현 ${imp.number || i + 1}. ${imp.title || ""}`, data: imp });
    });
  }

  // 미션
  (unit.missions || []).forEach((m, i) => {
    blocks.push({ type: "mission", title: `미션 ${m.number || i + 1}. ${m.title || ""}`, data: m });
  });

  // 핵심 요약
  if (unit.summary?.length) {
    blocks.push({ type: "summary", title: "핵심 요약", data: unit.summary });
  }

  return blocks;
}

// 블록 유형별 아이콘 라벨
export const BLOCK_TYPE_LABEL = {
  objectives: "🎯",
  concept: "📖",
  table: "📊",
  code: "💻",
  question: "❓",
  mission: "🚀",
  summary: "📝",
  text_list: "💡",
  algorithm_flow: "🔄",
  code_blank: "✏️",
  implementation: "🔧",
};