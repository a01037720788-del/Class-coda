// =============================================================================
// learningScope.js — AI Unit 생성 시 학습 범위 계산 및 코드 검증
//
// 핵심 원칙: AI가 생성하는 모든 코드는
//   [이전 Unit에서 배운 내용] + [현재 Unit에서 배우는 개념]
// 만 사용해야 한다. 이후 Unit에서 배울 문법/자료구조/라이브러리는 금지.
// =============================================================================

// ── 과목별 개념 키워드 (Unit 제목/목표/요약에서 개념 추출용) ──────────────────
const CONCEPT_KEYWORDS = {
  cpp: {
    cout: ['cout', '출력', 'console output'],
    cin: ['cin', '입력', 'console input'],
    variable: ['변수'],
    int: ['int', '정수'],
    double: ['double', '실수'],
    float: ['float'],
    string: ['string', '문자열'],
    char: ['char', '문자'],
    bool: ['bool', '불리언', 'boolean'],
    arithmetic: ['사칙연산', '연산', '덧셈', '뺄셈', '곱셈', '나눗셈', '나머지', 'modular'],
    assignment: ['대입', '복합 대입', '+=', '-=', '*=', '/='],
    type_conversion: ['형변환', '자료형 변환', '캐스팅', 'cast'],
    format: ['출력 서식', 'setw', 'setprecision', 'fixed', '포맷'],
    comparison: ['비교', '비교 연산자', '==', '!=', '<=', '>='],
    logical: ['논리', 'logical', '&&', '||', '!'],
    if: ['if', '조건문'],
    else: ['else', 'else if'],
    switch: ['switch', 'switch문', 'case'],
    for: ['for', 'for문', '반복문'],
    while: ['while', 'while문'],
    do_while: ['do-while', 'do while'],
    break: ['break', 'continue'],
    nested_for: ['중첩 for', '중첩 반복문', '다중 반복문', '이중 for', '다중 for'],
    array: ['array', '배열'],
    '2d_array': ['2차원 배열', '이차원 배열', '2D 배열', '2차원배열'],
    vector: ['vector', '벡터'],
    function: ['함수', 'function', '사용자 정의 함수', '함수 정의'],
    sort: ['sort', '정렬', 'std::sort'],
    pair: ['pair', '페어'],
    set: ['set', '집합'],
    map: ['map', '맵', '해시맵'],
    stack: ['stack', '스택'],
    queue: ['queue', '큐'],
    priority_queue: ['priority_queue', '우선순위 큐'],
    deque: ['deque', '덱'],
    struct: ['struct', '구조체'],
    class: ['class', '클래스'],
    pointer: ['포인터', 'pointer'],
    reference: ['참조', 'reference', '참조자'],
    recursion: ['재귀', 'recursion', '재귀함수'],
  },
  python: {
    print: ['print', '출력'],
    input: ['input', '입력'],
    variable: ['변수'],
    int: ['int', '정수'],
    float: ['float', '실수'],
    string: ['string', '문자열', 'str'],
    bool: ['bool', '불리언', 'boolean', 'True', 'False'],
    arithmetic: ['사칙연산', '연산', '덧셈', '뺄셈', '곱셈', '나눗셈', '나머지'],
    comparison: ['비교', '비교 연산자'],
    logical: ['논리', 'logical', 'and', 'or', 'not'],
    if: ['if', '조건문'],
    else: ['else', 'elif'],
    for: ['for', 'for문', '반복문'],
    while: ['while', 'while문'],
    break: ['break', 'continue'],
    nested_for: ['중첩 for', '중첩 반복문', '다중 반복문', '이중 for', '다중 for'],
    list: ['list', '리스트'],
    '2d_list': ['2차원 리스트', '이차원 리스트', '2D 리스트', '2차원리스트'],
    dict: ['dict', '딕셔너리'],
    tuple: ['tuple', '튜플'],
    set: ['set', '집합'],
    def: ['def', '함수', 'function', '사용자 정의 함수'],
    try: ['try', 'except', '예외', '예외 처리', '예외처리'],
    class: ['class', '클래스'],
    lambda: ['lambda', '람다'],
    import: ['import', '모듈', 'module'],
    comprehension: ['컴프리헨션', 'comprehension', 'list comprehension'],
    fstring: ['f-string', 'fstring', '포맷팅', 'f"'],
    split: ['split'],
    map_fn: ['map', 'map 함수'],
    join: ['join'],
    recursion: ['재귀', 'recursion', '재귀함수'],
  },
};

// ── 과목별 코드 패턴 (생성된 코드에서 금지 개념 사용 검출) ────────────────────
const CODE_PATTERNS = {
  cpp: {
    array: [/\barray\s*</, /#include\s*<array>/, /\b\w+\s+\w+\s*\[\s*\d+\s*\]/],
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

// ── 이전 Unit 텍스트에서 배운 개념 키 추출 ──────────────────────────────────
function extractConceptKeysFromUnit(unit, subject) {
  const keywords = CONCEPT_KEYWORDS[subject] || {};
  const textParts = [
    unit.title || '',
    ...(unit.learning_objectives || []),
    ...((unit.concept_sections || []).map(s => s.title || '')),
    ...(unit.summary || []),
    unit.subtitle || '',
  ];
  const text = textParts.join(' ');
  const found = new Set();
  for (const [key, words] of Object.entries(keywords)) {
    for (const w of words) {
      if (text.includes(w)) {
        found.add(key);
        break;
      }
    }
  }
  return found;
}

// ── 메인: 학습 범위 계산 ──────────────────────────────────────────────────────
// previousUnits: 전체 Unit 목록 (unit_number 포함)
// currentUnitNumber: 현재 생성할 Unit 번호
// currentUnitTitle: 현재 Unit 제목/주제
// subject: "cpp" | "python" | "junior_python" | "java" | "html"
// extraAllowed: 관리자가 추가로 허용한 개념 키 배열
//
// 반환: {
//   allowedConcepts: string[]   — 허용된 개념 키
//   allowedLabels: string[]     — 허용된 개념 표시명
//   bannedConcepts: string[]    — 금지된 개념 키 (코드 패턴이 있는 것만)
//   bannedLabels: string[]      — 금지된 개념 표시명
//   currentUnitConcepts: string[] — 현재 Unit에서 새로 배우는 개념
//   previousConcepts: string[]   — 이전 Unit에서 배운 개념
// }
export function computeLearningScope(previousUnits, currentUnitNumber, currentUnitTitle, subject, extraAllowed = []) {
  const effectiveSubject = subject === 'junior_python' ? 'python' : subject;
  const keywords = CONCEPT_KEYWORDS[effectiveSubject] || {};
  const patterns = CODE_PATTERNS[effectiveSubject] || {};

  // 1. 이전 Unit에서 배운 개념 추출 (unit_number < currentUnitNumber)
  const previousConcepts = new Set();
  if (previousUnits && previousUnits.length > 0) {
    for (const u of previousUnits) {
      if ((u.unit_number || 0) < currentUnitNumber) {
        const keys = extractConceptKeysFromUnit(u, effectiveSubject);
        for (const k of keys) previousConcepts.add(k);
      }
    }
  }

  // 2. 현재 Unit에서 배우는 개념 추출 (제목/주제에서)
  const currentConcepts = new Set();
  if (currentUnitTitle) {
    const tempUnit = { title: currentUnitTitle };
    const keys = extractConceptKeysFromUnit(tempUnit, effectiveSubject);
    for (const k of keys) currentConcepts.add(k);
  }

  // 3. 전체 허용 개념 = 이전 + 현재 + 관리자 추가
  const allowedConcepts = new Set([...previousConcepts, ...currentConcepts, ...extraAllowed]);

  // 4. 금지 개념 = 코드 패턴이 있으면서 허용 목록에 없는 것
  const bannedConcepts = [];
  for (const key of Object.keys(patterns)) {
    if (!allowedConcepts.has(key)) {
      bannedConcepts.push(key);
    }
  }

  // 5. 표시명 생성
  const getLabel = (key) => {
    const words = keywords[key] || [key];
    return words[0];
  };

  return {
    allowedConcepts: [...allowedConcepts].sort(),
    allowedLabels: [...allowedConcepts].sort().map(getLabel),
    bannedConcepts,
    bannedLabels: bannedConcepts.map(getLabel),
    currentUnitConcepts: [...currentConcepts].sort(),
    previousConcepts: [...previousConcepts].sort(),
  };
}

// ── 코드 문자열에서 금지 패턴 검사 ────────────────────────────────────────────
// 반환: [{ concept, label, snippet }] — 위반 항목 목록
export function validateCode(code, scope, subject) {
  if (!code || typeof code !== 'string') return [];
  const effectiveSubject = subject === 'junior_python' ? 'python' : subject;
  const patterns = CODE_PATTERNS[effectiveSubject] || {};
  const keywords = CONCEPT_KEYWORDS[effectiveSubject] || {};
  const violations = [];

  for (const concept of scope.bannedConcepts) {
    const conceptPatterns = patterns[concept];
    if (!conceptPatterns) continue;
    for (const re of conceptPatterns) {
      const match = code.match(re);
      if (match) {
        const idx = match.index || 0;
        const start = Math.max(0, idx - 10);
        const end = Math.min(code.length, idx + (match[0]?.length || 0) + 20);
        violations.push({
          concept,
          label: (keywords[concept] || [concept])[0],
          snippet: code.slice(start, end).replace(/\n/g, ' '),
        });
        break; // 개념당 한 번만
      }
    }
  }
  return violations;
}

// ── Unit 전체 코드 검증 ───────────────────────────────────────────────────────
// 반환: { violations: [{ location, concept, label, snippet }], hasViolations: boolean }
export function validateUnitAgainstScope(unit, scope, subject) {
  const allViolations = [];

  // example_codes
  if (Array.isArray(unit.example_codes)) {
    unit.example_codes.forEach((ex, i) => {
      const v = validateCode(ex.code, scope, subject);
      v.forEach(vi => allViolations.push({ location: `예제 ${i + 1}`, ...vi }));
    });
  }

  // questions — code_block, code_items[].code
  if (Array.isArray(unit.questions)) {
    unit.questions.forEach((q, i) => {
      if (q.code_block) {
        const v = validateCode(q.code_block, scope, subject);
        v.forEach(vi => allViolations.push({ location: `Question ${i + 1} (code_block)`, ...vi }));
      }
      if (Array.isArray(q.code_items)) {
        q.code_items.forEach((ci, j) => {
          const v = validateCode(ci.code, scope, subject);
          v.forEach(vi => allViolations.push({ location: `Question ${i + 1} (code_items ${j + 1})`, ...vi }));
        });
      }
    });
  }

  // missions — default_code, answer_code
  if (Array.isArray(unit.missions)) {
    unit.missions.forEach((m, i) => {
      if (m.default_code) {
        const v = validateCode(m.default_code, scope, subject);
        v.forEach(vi => allViolations.push({ location: `Mission ${i + 1} (default_code)`, ...vi }));
      }
      if (m.answer_code) {
        const v = validateCode(m.answer_code, scope, subject);
        v.forEach(vi => allViolations.push({ location: `Mission ${i + 1} (answer_code)`, ...vi }));
      }
    });
  }

  // concept_sections — code_example
  if (Array.isArray(unit.concept_sections)) {
    unit.concept_sections.forEach((s, i) => {
      if (s.code_example) {
        const v = validateCode(s.code_example, scope, subject);
        v.forEach(vi => allViolations.push({ location: `개념 ${i + 1} (code_example)`, ...vi }));
      }
    });
  }

  return {
    violations: allViolations,
    hasViolations: allViolations.length > 0,
  };
}

// ── 프롬프트용 학습 범위 텍스트 생성 ───────────────────────────────────────────
export function buildScopePromptSection(scope) {
  const lines = [];

  if (scope.allowedLabels.length > 0) {
    lines.push(`【현재까지 학습 가능한 문법 범위】`);
    lines.push(`다음 개념만 코드에 사용할 수 있습니다:`);
    lines.push(scope.allowedLabels.map(l => `  ✓ ${l}`).join('\n'));
    lines.push('');
  }

  if (scope.bannedLabels.length > 0) {
    lines.push(`【절대 사용 금지 — 아직 배우지 않은 문법】`);
    lines.push(`다음 문법/자료구조/라이브러리는 예제 코드, Question 코드, Mission default_code, Mission answer_code, 개념 설명의 code_example 어디에도 절대 사용하지 마세요:`);
    lines.push(scope.bannedLabels.map(l => `  ✕ ${l}`).join('\n'));
    lines.push('');
  }

  lines.push(`【학습 범위 규칙】`);
  lines.push(`- 위 "허용 개념 목록"에 없는 프로그래밍 문법, 자료구조, 표준 라이브러리, 함수는 절대로 사용하지 마세요.`);
  lines.push(`- 예제 코드, Question 코드, Mission default_code, Mission answer_code 모두 동일한 제한을 적용합니다.`);
  lines.push(`- 문제를 더 쉽게 만들기 위해서라도 앞으로 배울 개념을 미리 사용해서는 안 됩니다.`);
  lines.push(`- 필요한 기능을 아직 배우지 않았다면 현재까지 배운 문법만으로 해결 가능한 문제를 만들어야 합니다.`);
  lines.push(`- 이전 Unit의 내용을 활용하는 것은 적극적으로 허용합니다 (이전 내용 + 현재 내용 결합).`);

  return lines.join('\n');
}