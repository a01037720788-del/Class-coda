// 정답 코드에서 input() 패턴을 분석하여 입력값 자료형 추론

export function analyzeInputPatterns(code) {
  if (!code) return [];
  const specs = [];
  const lines = String(code).split(/\r?\n/);

  // 패턴 정규식
  const patterns = [
    // list(map(int, input().split())) 또는 map(int, input().split())
    { regex: /(\w+)\s*=\s*(?:list\s*\(\s*)?map\s*\(\s*int\s*,\s*input\s*\(\s*\)\s*\.split\s*\(\s*\)\s*\)?/, type: 'integer_list', desc: '정수 여러 개 (공백 구분)' },
    // list(map(float, input().split()))
    { regex: /(\w+)\s*=\s*(?:list\s*\(\s*)?map\s*\(\s*float\s*,\s*input\s*\(\s*\)\s*\.split\s*\(\s*\)\s*\)?/, type: 'float_list', desc: '실수 여러 개 (공백 구분)' },
    // int(input())
    { regex: /(\w+)\s*=\s*int\s*\(\s*input\s*\(\s*(?:["'`][^"'`]*["'`])?\s*\)\s*\)/, type: 'integer', desc: '정수' },
    // float(input())
    { regex: /(\w+)\s*=\s*float\s*\(\s*input\s*\(\s*(?:["'`][^"'`]*["'`])?\s*\)\s*\)/, type: 'float', desc: '실수' },
    // input() (문자열)
    { regex: /(\w+)\s*=\s*input\s*\(\s*(?:["'`][^"'`]*["'`])?\s*\)/, type: 'string', desc: '문자열' },
  ];

  for (const line of lines) {
    for (const p of patterns) {
      const m = line.match(p.regex);
      if (m) {
        const name = m[1] || `input${specs.length + 1}`;
        if (p.type === 'integer_list' || p.type === 'float_list') {
          // 여러 값을 하나의 입력으로 처리하지만, 개별 input()이 아니므로 한 줄에 여러 값
          // 단순화: 첫 번째 정수/실수로 처리 (관리자가 조정 가능)
          specs.push({
            name,
            data_type: p.type === 'integer_list' ? 'integer' : 'float',
            min: 1,
            max: 100,
            _note: p.desc,
          });
        } else {
          specs.push({
            name,
            data_type: p.type,
            ...(p.type === 'integer' || p.type === 'float' ? { min: 1, max: 100 } : {}),
            ...(p.type === 'string' ? { min_length: 1, max_length: 10 } : {}),
          });
        }
        break; // 한 줄에서 하나만 매칭
      }
    }
  }

  return specs;
}

// input() 호출 개수 (stdinUtils.countInputCalls와 동일)
export function countInputCalls(code) {
  if (!code) return 0;
  const matches = String(code).match(/\binput\s*\(/g);
  return matches ? matches.length : 0;
}