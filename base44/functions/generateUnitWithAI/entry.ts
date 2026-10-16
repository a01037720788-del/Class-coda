import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ── 과목별 생성 규칙 ──────────────────────────────────────────────────────────
const SUBJECT_RULES = {
  python: {
    label: 'Python',
    standard: 'Python 3',
    levelGuide: '중학생~고등학생 수준',
    codeRule: 'Python 3 문법만 사용. print(), input(), for, while, list, dict, f-string 등 활용.',
    defaultCode: 'print("Hello CODA")',
    defaultFile: 'example.py',
    missionHint: 'input()으로 값을 입력받고 print()로 출력하는 과제',
    questionTypes: 'multiple_choice, multiple_select, short_answer, code_output, matching, ordering',
    extraRules: '',
  },
  junior_python: {
    label: '저학년 Python',
    standard: 'Python 3',
    levelGuide: '초등학교 저학년 수준',
    codeRule: 'Python 3 기초 문법만 사용. print(), input(), 간단한 변수, for문 위주.',
    defaultCode: 'print("Hello!")',
    defaultFile: 'example.py',
    missionHint: 'print()로 출력하거나 input()으로 간단한 값을 입력받는 과제',
    questionTypes: 'multiple_choice, short_answer, code_output',
    extraRules: [
      '설명을 짧고 쉽게 작성하세요. 어려운 전문용어를 최소화하세요.',
      '일상생활의 예시를 많이 사용하세요. (예: "변수는 값을 넣어두는 상자와 같아요")',
      '한 예제의 코드 길이를 짧게 유지하세요 (5~10줄 이내).',
      '한 Mission에 여러 개념을 섞지 마세요. 하나의 개념에 집중하세요.',
      '학생이 이해하기 쉬운 친근한 말투로 작성하세요.',
    ].join('\n'),
  },
  cpp: {
    label: 'C++',
    standard: 'C++17',
    levelGuide: '중학생~고등학생 수준',
    codeRule: 'C++17 표준만 사용. 모든 코드는 아래 기본 구조를 포함해야 합니다:\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // 코드\n    return 0;\n}',
    defaultCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello CODA";\n    return 0;\n}',
    defaultFile: 'example.cpp',
    missionHint: 'cin으로 입력받고 cout으로 출력하는 과제',
    questionTypes: 'multiple_choice, multiple_select, short_answer, code_output, matching, ordering',
    extraRules: 'Python 문법을 그대로 번역하지 말고 C++ 자체의 개념으로 설명하세요. (예: for(초기식; 조건식; 증감식) 각 부분을 따로 설명)',
  },
  java: {
    label: 'Java',
    standard: 'Java 17',
    levelGuide: '중학생~고등학생 수준',
    codeRule: 'Java 17 표준만 사용. 모든 코드는 아래 기본 구조를 포함해야 합니다:\npublic class Main {\n    public static void main(String[] args) {\n        // 코드\n    }\n}\n입력이 필요한 경우 Scanner를 사용:\nimport java.util.Scanner;\nScanner sc = new Scanner(System.in);',
    defaultCode: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello CODA");\n    }\n}',
    defaultFile: 'Main.java',
    missionHint: 'Scanner로 입력받아 System.out.println으로 출력하는 과제',
    questionTypes: 'multiple_choice, multiple_select, short_answer, code_output, matching, ordering',
    extraRules: '모든 예제와 Mission 코드는 사이트 Java 실행 환경에서 바로 실행 가능한 완전한 코드여야 합니다. class 이름은 반드시 Main이어야 합니다.',
  },
  html: {
    label: 'HTML/CSS/JS',
    standard: 'HTML5 + CSS3 + JavaScript (ES6+)',
    levelGuide: '중학생~고등학생 수준',
    codeRule: 'HTML/CSS/JavaScript를 사용. HTML은 아래 기본 템플릿을 사용:\n<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8">\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n</body>\n</html>\n주의: viewport meta, title 태그, "Hello CODA", console.log(), 기본 CSS를 불필요하게 자동 생성하지 마세요. CSS와 JavaScript는 필요한 경우에만 작성하세요.',
    defaultCode: '<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8">\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n</body>\n</html>',
    defaultFile: 'index.html',
    missionHint: '주어진 구조의 웹페이지를 HTML/CSS로 만드는 과제',
    questionTypes: 'multiple_choice, multiple_select, short_answer, matching, ordering',
    extraRules: [
      '개념 설명은 태그의 역할과 구조를 설명하세요. (예: <h1>은 제목, <p>는 문단, <a>는 링크)',
      '표는 태그와 역할을 연결하는 형태로 작성하세요. (예: 태그 | 역할 | 예제)',
      'Mission은 실제 웹페이지를 만드는 형태로 생성하세요. (예: h1 태그로 이름 표시, p 태그로 자기소개)',
      'example_codes의 code 필드에는 HTML 코드를, missions의 default_code 필드에도 HTML 코드를 넣으세요.',
    ].join('\n'),
  },
};

const LEVEL_LABELS = {
  저학년: '초등학교 저학년 수준 — 매우 쉽고 친근하게',
  초급: '초급 수준 — 기본 개념 위주, 쉬운 예제',
  중급: '중급 수준 — 기본 개념 + 간단한 응용',
  고급: '고급 수준 — 응용 중심, 다양한 활용',
};

// ── JSON Schema (AI 응답 형식) ────────────────────────────────────────────────
const UNIT_SCHEMA = {
  type: 'object',
  properties: {
    unit: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Unit 제목' },
        subtitle: { type: 'string', description: 'Unit 부제목' },
        learning_objectives: {
          type: 'array',
          items: { type: 'string' },
          description: '학습 목표 3~5개',
        },
        concept_sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              lines: { type: 'array', items: { type: 'string' } },
              code_example: { type: 'string' },
            },
          },
        },
        tables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              headers: { type: 'array', items: { type: 'string' } },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
        example_codes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              code: { type: 'string' },
              description: { type: 'string' },
              expected_output: { type: 'string' },
              uses_input: { type: 'boolean' },
              default_stdin: { type: 'string' },
              stdin_description: { type: 'string' },
            },
          },
        },
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'multiple_choice, multiple_select, short_answer, code_output, matching, ordering' },
              question: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              pairs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { left: { type: 'string' }, right: { type: 'string' } },
                },
              },
              answer: { type: 'string', description: '정답 (필수)' },
              explanation: { type: 'string', description: '해설 (필수)' },
              code_block: { type: 'string' },
              expected_output: { type: 'string' },
              code_items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { code: { type: 'string' }, expected_output: { type: 'string' } },
                },
              },
            },
          },
        },
        missions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string', description: '문제 설명' },
              default_code: { type: 'string', description: '기본 제공 코드 (학생용)' },
              answer_code: { type: 'string', description: '정답 코드 (관리자용)' },
              expected_output: { type: 'string' },
              input_condition: { type: 'string', description: '입력 설명' },
              output_condition: { type: 'string', description: '출력 설명' },
              example: { type: 'string', description: '입출력 예시' },
              uses_input: { type: 'boolean' },
              default_stdin: { type: 'string' },
              stdin_description: { type: 'string' },
              test_cases: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    input: { type: 'string' },
                    expected_output: { type: 'string' },
                    hidden: { type: 'boolean' },
                  },
                },
                description: '입력을 사용하는 Mission은 최소 5개 테스트케이스 (기본값, 작은 값, 중간 값, 큰 값, 경계값)',
              },
            },
          },
        },
        summary: {
          type: 'array',
          items: { type: 'string' },
          description: '핵심 요약 3~5개',
        },
      },
    },
  },
};

// ── 프롬프트 빌더 ──────────────────────────────────────────────────────────────
function buildPrompt(params) {
  const { subject_type, subject_name, unit_number, title, level, previous_units, settings, extra_prompt, scope_section } = params;
  const rule = SUBJECT_RULES[subject_type] || SUBJECT_RULES.python;
  const levelLabel = LEVEL_LABELS[level] || LEVEL_LABELS['초급'];

  // 이전 Unit 정보 — 학습 목표, 개념 제목, 요약 포함
  let prevUnitInfo = '';
  if (previous_units && previous_units.length > 0) {
    const unitList = previous_units
      .filter(u => u.unit_number < unit_number)
      .sort((a, b) => (a.unit_number || 0) - (b.unit_number || 0))
      .map(u => {
        const concepts = (u.concept_sections || []).map(s => s.title).filter(Boolean).join(', ');
        const objectives = (u.learning_objectives || []).join(', ');
        const summary = (u.summary || []).join(', ');
        const parts = [`Unit ${u.unit_number}: ${u.title}`];
        if (concepts) parts.push(`주요 개념: ${concepts}`);
        if (objectives) parts.push(`학습 목표: ${objectives}`);
        if (summary) parts.push(`요약: ${summary}`);
        return `  - ${parts.join(' | ')}`;
      })
      .join('\n');
    if (unitList) {
      prevUnitInfo = `\n【이전 Unit에서 배운 내용】\n${unitList}\n`;
    }
  }

  // 학습 범위 섹션 (프론트엔드에서 계산하여 전달)
  const scopeInfo = scope_section ? `\n${scope_section}\n` : '';

  const counts = settings || {};
  const conceptCount = counts.concept_count || 3;
  const tableCount = counts.table_count || 1;
  const exampleCount = counts.example_count || 8;
  const questionCount = counts.question_count || 5;
  const missionCount = counts.mission_count || 5;

  return `당신은 코딩 교육 전문가입니다. 아래 조건에 맞춰 완전한 학습 Unit을 생성하세요.

【과목】 ${subject_name || rule.label} (${rule.standard})
【Unit 번호】 Unit ${unit_number}
【Unit 제목】 ${title || '(주제에 맞게 자동 생성)'}
【학생 수준】 ${levelLabel}
${prevUnitInfo}${scopeInfo}
${extra_prompt ? `【추가 요청사항】\n${extra_prompt}\n` : ''}
【과목별 코드 규칙】
${rule.codeRule}

${rule.extraRules ? `【과목별 추가 규칙】\n${rule.extraRules}\n` : ''}【생성할 항목 및 개수】
1. title: Unit 제목 (간결하게)
2. subtitle: Unit 부제목 (학습 내용 요약)
3. learning_objectives: 학습 목표 3~5개
4. concept_sections: 개념 설명 최소 ${conceptCount}개 섹션 (주제를 충분히 설명하기 위해 필요하면 더 많이 생성해도 좋습니다)
   - 각 섹션: { title, lines(설명 줄 배열), code_example(코드 예시) }
5. tables: 정리 표 ${tableCount}개 (각 표: { title, headers, rows })
6. example_codes: 예제 코드 ${exampleCount}개
   - 각 예제: { filename, code, description, expected_output, uses_input, default_stdin, stdin_description }
   - 쉬운 것 → 응용 순서로 생성 (기본 문법 → 값 변경 → 입력 활용 → 조건 결합 → 간단 응용)
   - input()을 사용하는 예제는 uses_input: true, default_stdin, stdin_description 포함
   - default_stdin은 해당 코드를 실제로 실행할 때 input()이 읽을 수 있는 실행 가능한 값이어야 합니다.
     예: code가 "name = input()\nage = int(input())\nprint(name, age)" 인 경우 default_stdin은 "철수\n12"
     예: code가 "a, b = map(int, input().split())\nprint(a+b)" 인 경우 default_stdin은 "10 20"
     예: code가 "n = int(input())" 인 경우 default_stdin은 "5"
   - expected_output은 default_stdin을 입력으로 실행했을 때의 실제 출력이어야 합니다.
7. questions: 학습 문제 ${questionCount}개
   - 사용 가능한 문제 유형: ${rule.questionTypes}
   - 각 문제: { type, question, options(객관식 시), answer(정답-필수), explanation(해설-필수) }
   - code_output 유형: code_block과 expected_output 포함
   - matching 유형: pairs 배열 사용 (각 항목: { left, right })
   - ordering 유형: options 배열을 올바른 순서로 배치
   - 정답(answer)과 해설(explanation)은 반드시 모든 문제에 포함해야 합니다
8. missions: 실습 미션 ${missionCount}개
   - 각 미션: { title, description, default_code, answer_code, expected_output, input_condition, output_condition, example, uses_input, default_stdin, stdin_description, test_cases }
   - default_code: 학생에게 제공할 기본 코드 (빈 코드 또는 부분 코드)
   - answer_code: 정답 코드 (관리자용, 반드시 생성)
   - 입력을 사용하는 Mission은 uses_input: true, default_stdin, stdin_description 포함
   - default_stdin은 answer_code를 실행할 때 input()이 읽을 수 있는 실행 가능한 값이어야 합니다.
   - 입력을 사용하는 Mission은 test_cases에 최소 5개 생성 (기본값, 작은 값, 중간 값, 큰 값, 경계값)
   - 각 test_case: { input, expected_output, hidden: true }
9. summary: 핵심 요약 3~5개

【중요 지시사항】
- 현재 Unit 이전까지 배운 문법만 자유롭게 사용할 수 있습니다.
- 현재 Unit에서 처음 배우는 내용을 제외하고, 향후 Unit에서 배울 고급 문법을 예제나 Mission에 사용하지 마세요.
- 위 "학습 범위" 섹션에 명시된 허용/금지 목록을 절대적으로 준수하세요.
- 허용 목록에 없는 문법, 자료구조, 표준 라이브러리, 함수는 예제 코드, Question 코드, Mission default_code, Mission answer_code, 개념 설명 code_example 어디에도 사용하지 마세요.
- 문제를 더 쉽게 만들기 위해 앞으로 배울 개념을 미리 사용하지 마세요.
- 필요한 기능을 아직 배우지 않았다면 현재까지 배운 문법만으로 해결 가능한 문제를 만들어야 합니다.
- 이전 Unit의 내용을 복습하는 형태로 문제를 만드는 것은 적극적으로 권장합니다.
- 모든 내용은 한국어로 작성하세요.
- 모든 Question에는 반드시 정답(answer)과 해설(explanation)이 있어야 합니다.
- 모든 Mission에는 반드시 정답 코드(answer_code)가 있어야 합니다.
- 코드는 실제로 실행 가능한 정확한 코드여야 하고, expected_output은 실제 실행 결과와 일치해야 합니다.
- ${rule.standard} 표준만 사용하세요.`;
}

// ── 금지 개념 코드 패턴 (백엔드 검증용) ──────────────────────────────────────
const CODE_PATTERNS: Record<string, Record<string, RegExp[]>> = {
  cpp: {
    array: [/array\s*</, /#include\s*<array>/, /\b\w+\s+\w+\s*\[\s*\d+\s*\]/],
    '2d_array': [/\]\s*\[\s*\d+\s*\]/],
    vector: [/vector\s*</, /#include\s*<vector>/],
    function: [/^\s*(int|void|double|float|bool|char|string|long|short|unsigned|size_t|auto)\s+(?!main\b)\w+\s*\(/m],
    sort: [/std::sort/, /#include\s*<algorithm>/, /\bsort\s*\(/],
    pair: [/pair\s*</, /make_pair/],
    set: [/set\s*</, /#include\s*<set>/],
    map: [/map\s*</, /#include\s*<map>/],
    stack: [/stack\s*</, /#include\s*<stack>/],
    queue: [/queue\s*</, /#include\s*<queue>/],
    priority_queue: [/priority_queue/],
    deque: [/deque\s*</, /#include\s*<deque>/],
    struct: [/\bstruct\s+\w+/],
    class: [/\bclass\s+\w+/],
    pointer: [/^\s*\w+\s*\*\s*\w+/m],
    bits_stdc: [/bits\/stdc\+\+\.h/],
  },
  python: {
    for: [/\bfor\s+\w+\s+in\b/],
    while: [/\bwhile\s+/],
    def: [/\bdef\s+\w+\s*\(/],
    list: [/\blist\s*\(/, /\[\s*[^\[\]'"]+\s*,\s*[^\[\]'"]*\]/],
    dict: [/\bdict\s*\(/, /\{['"]\w+['"]\s*:/],
    tuple: [/\btuple\s*\(/],
    set: [/\bset\s*\(/],
    try: [/\btry\s*:/],
    except: [/\bexcept\b/],
    class: [/\bclass\s+\w+/],
    lambda: [/\blambda\b/],
    import: [/\bimport\s+/, /\bfrom\s+\w+\s+import\b/],
    comprehension: [/\[[^\]]*\bfor\b[^\]]*\]/, /\{[^\}]*\bfor\b[^\}]*\}/],
  },
};

// ── 코드에서 금지 패턴 검사 ──────────────────────────────────────────────────
function validateCode(code: string, bannedConcepts: string[], subject: string): { concept: string; snippet: string }[] {
  if (!code || typeof code !== 'string') return [];
  const effectiveSubject = subject === 'junior_python' ? 'python' : subject;
  const patterns = CODE_PATTERNS[effectiveSubject] || {};
  const violations: { concept: string; snippet: string }[] = [];
  for (const concept of bannedConcepts) {
    const conceptPatterns = patterns[concept];
    if (!conceptPatterns) continue;
    for (const re of conceptPatterns) {
      const match = code.match(re);
      if (match) {
        const idx = match.index || 0;
        const start = Math.max(0, idx - 10);
        const end = Math.min(code.length, idx + (match[0]?.length || 0) + 20);
        violations.push({ concept, snippet: code.slice(start, end).replace(/\n/g, ' ') });
        break;
      }
    }
  }
  return violations;
}

// ── Unit 전체 코드 검증 ──────────────────────────────────────────────────────
function validateUnitScope(unit: any, bannedConcepts: string[], subject: string): string[] {
  const warnings: string[] = [];
  const allConcepts = bannedConcepts;

  if (Array.isArray(unit.example_codes)) {
    unit.example_codes.forEach((ex: any, i: number) => {
      const v = validateCode(ex.code, allConcepts, subject);
      v.forEach(vi => warnings.push(`예제 ${i + 1}: 아직 배우지 않은 ${vi.concept} 사용 («${vi.snippet}»)»`));
    });
  }
  if (Array.isArray(unit.questions)) {
    unit.questions.forEach((q: any, i: number) => {
      if (q.code_block) {
        const v = validateCode(q.code_block, allConcepts, subject);
        v.forEach(vi => warnings.push(`Question ${i + 1} (code_block): ${vi.concept} 사용 («${vi.snippet}»)»`));
      }
      if (Array.isArray(q.code_items)) {
        q.code_items.forEach((ci: any, j: number) => {
          const v = validateCode(ci.code, allConcepts, subject);
          v.forEach(vi => warnings.push(`Question ${i + 1} (code_items ${j + 1}): ${vi.concept} 사용 («${vi.snippet}»)»`));
        });
      }
    });
  }
  if (Array.isArray(unit.missions)) {
    unit.missions.forEach((m: any, i: number) => {
      if (m.default_code) {
        const v = validateCode(m.default_code, allConcepts, subject);
        v.forEach(vi => warnings.push(`Mission ${i + 1} (default_code): ${vi.concept} 사용 («${vi.snippet}»)»`));
      }
      if (m.answer_code) {
        const v = validateCode(m.answer_code, allConcepts, subject);
        v.forEach(vi => warnings.push(`Mission ${i + 1} (answer_code): ${vi.concept} 사용 («${vi.snippet}»)»`));
      }
    });
  }
  if (Array.isArray(unit.concept_sections)) {
    unit.concept_sections.forEach((s: any, i: number) => {
      if (s.code_example) {
        const v = validateCode(s.code_example, allConcepts, subject);
        v.forEach(vi => warnings.push(`개념 ${i + 1} (code_example): ${vi.concept} 사용 («${vi.snippet}»)»`));
      }
    });
  }
  return warnings;
}

// ── 응답 검증 ──────────────────────────────────────────────────────────────────
function validateUnit(result, subject_type) {
  if (!result || typeof result !== 'object') {
    return { valid: false, error: 'AI가 유효하지 않은 응답을 반환했습니다.' };
  }
  const unit = result.unit || result;
  if (!unit || typeof unit !== 'object') {
    return { valid: false, error: 'AI 응답에 Unit 데이터가 없습니다.' };
  }

  const errors = [];

  // 기본 필드
  if (!unit.title || typeof unit.title !== 'string') {
    errors.push('Unit 제목이 없습니다.');
  }

  // concept_sections
  if (!Array.isArray(unit.concept_sections)) {
    errors.push('개념 설명(concept_sections)이 배열 형식이 아닙니다.');
  } else {
    unit.concept_sections = unit.concept_sections.filter(s => s && typeof s === 'object' && (s.title || (s.lines && s.lines.length > 0)));
  }

  // tables
  if (!Array.isArray(unit.tables)) {
    unit.tables = [];
  }

  // example_codes
  if (!Array.isArray(unit.example_codes)) {
    errors.push('예제 코드(example_codes)가 배열 형식이 아닙니다.');
  } else {
    unit.example_codes = unit.example_codes.filter(ex => ex && typeof ex === 'object' && ex.code);
    if (unit.example_codes.length === 0) {
      errors.push('예제 코드에 실행 가능한 코드가 없습니다.');
    }
  }

  // questions — 정답 필수
  if (!Array.isArray(unit.questions)) {
    unit.questions = [];
  } else {
    const validQuestions = [];
    const invalidCount = { no_answer: 0, no_question: 0 };
    for (const q of unit.questions) {
      if (!q || typeof q !== 'object') continue;
      if (!q.question || typeof q.question !== 'string') { invalidCount.no_question++; continue; }
      if (!q.answer || typeof q.answer !== 'string' || q.answer.trim() === '') {
        invalidCount.no_answer++;
        continue;
      }
      validQuestions.push(q);
    }
    unit.questions = validQuestions;
    if (invalidCount.no_answer > 0) {
      errors.push(`정답이 없는 문제 ${invalidCount.no_answer}개가 제외되었습니다.`);
    }
    if (unit.questions.length === 0) {
      errors.push('유효한 문제(정답 포함)가 하나도 없습니다.');
    }
  }

  // missions — answer_code 필수
  if (!Array.isArray(unit.missions)) {
    unit.missions = [];
  } else {
    const validMissions = [];
    const invalidCount = { no_code: 0, no_answer: 0 };
    for (const m of unit.missions) {
      if (!m || typeof m !== 'object') continue;
      if (!m.answer_code || typeof m.answer_code !== 'string' || m.answer_code.trim() === '') {
        invalidCount.no_answer++;
        continue;
      }
      validMissions.push(m);
    }
    unit.missions = validMissions;
    if (invalidCount.no_answer > 0) {
      errors.push(`정답 코드가 없는 미션 ${invalidCount.no_answer}개가 제외되었습니다.`);
    }
  }

  // learning_objectives, summary
  if (!Array.isArray(unit.learning_objectives)) unit.learning_objectives = [];
  if (!Array.isArray(unit.summary)) unit.summary = [];

  if (errors.length > 0 && (unit.questions.length === 0 || unit.example_codes.length === 0)) {
    return { valid: false, error: errors.join(' ') };
  }

  return { valid: true, unit, warnings: errors.length > 0 ? errors : null };
}

// ── 메인 핸들러 ────────────────────────────────────────────────────────────────
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // 인증 확인 (me() 실패해도 관리자 UI에서 호출되므로 진행)
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
      }
    } catch (_) { /* me() 실패 시에도 진행 (프론트엔드에서 이미 관리자 권한 확인됨) */ }

    let body;
    try {
      body = await req.json();
    } catch (_) {
      return Response.json({ success: false, error: '잘못된 요청 형식입니다.' }, { status: 400 });
    }

    const { subject_type, subject_name, unit_number, title, level, previous_units, settings, extra_prompt, scope_section, banned_concepts } = body;

    if (!subject_type) {
      return Response.json({ success: false, error: '과목 유형(subject_type)이 필요합니다.' }, { status: 400 });
    }
    if (!SUBJECT_RULES[subject_type]) {
      return Response.json({ success: false, error: `지원하지 않는 과목 유형: ${subject_type}` }, { status: 400 });
    }

    const prompt = buildPrompt({ subject_type, subject_name, unit_number, title, level, previous_units, settings, extra_prompt, scope_section });

    let llmResult;
    try {
      llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: UNIT_SCHEMA,
      });
    } catch (llmErr) {
      return Response.json({
        success: false,
        error: `AI 호출 실패: ${llmErr?.message || 'LLM 응답을 받을 수 없습니다.'}`,
      }, { status: 500 });
    }

    const validation = validateUnit(llmResult, subject_type);
    if (!validation.valid) {
      return Response.json({
        success: false,
        error: `AI 응답 형식이 올바르지 않습니다. ${validation.error}`,
      }, { status: 422 });
    }

    // 학습 범위 검증 — 금지된 문법이 코드에 포함되어 있는지 검사
    const scopeWarnings: string[] = [];
    if (Array.isArray(banned_concepts) && banned_concepts.length > 0) {
      const scopeViolations = validateUnitScope(validation.unit, banned_concepts, subject_type);
      scopeWarnings.push(...scopeViolations);
    }

    // 기존 검증 경고 + 학습 범위 경고 통합
    const allWarnings = [
      ...(validation.warnings || []),
      ...(scopeWarnings.length > 0 ? [`⚠ 학습 범위 검사 경고:`, ...scopeWarnings] : []),
    ];

    return Response.json({
      success: true,
      unit: validation.unit,
      warnings: allWarnings.length > 0 ? allWarnings : null,
      scopeViolations: scopeWarnings.length > 0 ? scopeWarnings : null,
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error?.message || 'AI Unit 생성 중 오류가 발생했습니다.',
    }, { status: 500 });
  }
}