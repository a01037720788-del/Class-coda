// Python 표준 입력(stdin) 관련 공유 유틸리티

// C++ 코드의 cin/getline 입력 사용 여부 확인
export function hasCppInput(code) {
  if (!code) return false;
  const s = String(code);
  return /\b(?:std::)?cin\s*>>/.test(s) || /getline\s*\(\s*(?:std::)?cin\s*,/.test(s);
}

// 코드 내 input() 호출 개수 계算
export function countInputCalls(code) {
  if (!code) return 0;
  const matches = String(code).match(/\binput\s*\(/g);
  return matches ? matches.length : 0;
}

// 코드에서 input("...") 안의 안내 문구(prompt) 추출
export function extractInputPrompts(code) {
  if (!code) return [];
  const prompts = [];
  const regex = /\binput\s*\(\s*["'`]([\s\S]*?)["'`]\s*\)/g;
  let m;
  while ((m = regex.exec(code)) !== null) {
    prompts.push(m[1]);
  }
  return prompts;
}

// 출력 정규화: 줄바꿈/공백 정리
export function normalizeOutput(s) {
  if (!s) return "";
  return String(s)
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

// 출력에서 input() 안내 문구 제거
export function stripInputPrompts(output, code) {
  if (!output) return "";
  let result = String(output);
  const prompts = extractInputPrompts(code);
  prompts.forEach(p => {
    if (p) {
      // 안내 문구를 빈 문자열로 치환
      result = result.split(p).join("");
    }
  });
  return result;
}

// 채점 모드별 출력 비교
// mode: "exact" | "normalize" | "exclude_prompts"
export function compareOutput(actual, expected, mode = "normalize", code = "") {
  const a = actual || "";
  const e = expected || "";
  if (mode === "exact") {
    return a === e;
  }
  if (mode === "exclude_prompts") {
    const stripped = stripInputPrompts(a, code);
    return normalizeOutput(stripped) === normalizeOutput(e);
  }
  // default: normalize
  return normalizeOutput(a) === normalizeOutput(e);
}

// stdin을 줄 단위로 분리
export function splitStdinLines(stdin) {
  const raw = String(stdin || "").trim();
  if (!raw) return [];
  return raw.split(/\r?\n/);
}

// 코드 내 input() 호출 상세 분석 — 각 호출의 타입과 제안값 추출
// 반환: { count, items: [{ lineIdx, type, suggestion }] }
export function analyzeInputCalls(code) {
  if (!code) return { count: 0, items: [] };
  const lines = String(code).split(/\r?\n/);
  const items = [];

  lines.forEach((line, idx) => {
    const inputMatches = line.match(/\binput\s*\(/g);
    if (!inputMatches) return;
    const inputCount = inputMatches.length;

    let type = "string";
    let varCount = 1;

    // a, b = map(int, input().split())
    const mapMatch = line.match(/^\s*([\w\s,]+?)\s*=\s*map\s*\(\s*(\w+)\s*,\s*input\s*\(\s*\)\s*\.split\s*\(\s*\)/);
    if (mapMatch) {
      const vars = mapMatch[1].split(",").map(v => v.trim()).filter(Boolean);
      varCount = vars.length;
      const t = mapMatch[2];
      type = t === "int" ? "int_split" : t === "float" ? "float_split" : "str_split";
    } else if (/=\s*list\s*\(\s*map\s*\(\s*\w+\s*,\s*input/.test(line)) {
      const lm = line.match(/=\s*list\s*\(\s*map\s*\(\s*(\w+)\s*,/);
      const t = lm ? lm[1] : "int";
      type = t === "int" ? "int_list" : t === "float" ? "float_list" : "str_list";
      varCount = 3;
    } else if (/\bint\s*\(\s*input\s*\(/.test(line)) {
      type = "int";
    } else if (/\bfloat\s*\(\s*input\s*\(/.test(line)) {
      type = "float";
    } else {
      type = "string";
    }

    let suggestion;
    if (type === "int") suggestion = "10";
    else if (type === "float") suggestion = "1.5";
    else if (type === "int_split") suggestion = Array.from({ length: varCount }, (_, i) => String(10 + i * 10)).join(" ");
    else if (type === "float_split") suggestion = Array.from({ length: varCount }, (_, i) => (1.5 + i).toFixed(1)).join(" ");
    else if (type === "str_split") suggestion = Array.from({ length: varCount }, (_, i) => `값${i + 1}`).join(" ");
    else if (type === "int_list") suggestion = "10 20 30";
    else if (type === "float_list") suggestion = "1.5 2.5 3.5";
    else if (type === "str_list") suggestion = "사과 바나나 포도";
    else suggestion = "홍길동";

    // input() 호출마다 한 줄씩 제안 (map+split은 한 줄에 여러 값)
    for (let i = 0; i < inputCount; i++) {
      items.push({ lineIdx: idx, type, suggestion });
    }
  });

  return { count: items.length, items };
}

// 코드에서 실행 가능한 기본 stdin 자동 생성
export function generateDefaultStdin(code) {
  const { items } = analyzeInputCalls(code);
  if (items.length === 0) return "";
  return items.map(it => it.suggestion).join("\n");
}