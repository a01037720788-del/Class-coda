import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ─── 랜덤값 생성 유틸 ──────────────────────────────────────────────────────
function randInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function randFloat(min, max) {
  if (max < min) return min;
  return Math.random() * (max - min) + min;
}

function randString(minLen, maxLen) {
  const len = randInt(minLen || 1, maxLen || 10);
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randChoice(choices) {
  if (!choices || choices.length === 0) return '';
  return choices[Math.floor(Math.random() * choices.length)];
}

// 단일 spec에 따라 랜덤값 하나 생성
function genValue(spec) {
  switch (spec.data_type) {
    case 'integer':
      return String(randInt(spec.min ?? 1, spec.max ?? 100));
    case 'float':
      return String(Math.round(randFloat(spec.min ?? 0, spec.max ?? 100) * 1000) / 1000);
    case 'string':
      return randString(spec.min_length ?? 1, spec.max_length ?? 10);
    case 'choice':
      return randChoice(spec.choices || []);
    default:
      return '';
  }
}

// 경계값 포함 입력 조합 생성
function generateBoundaryInputs(specs) {
  const inputs = [];
  if (specs.length === 0) return inputs;

  if (specs.length === 1) {
    const s = specs[0];
    if (s.data_type === 'integer' || s.data_type === 'float') {
      const lo = s.min ?? 1, hi = s.max ?? 100;
      const mid = Math.round((lo + hi) / 2);
      inputs.push([String(lo)]);
      inputs.push([String(hi)]);
      inputs.push([String(mid)]);
    }
    return inputs;
  }

  // 여러 입력값: min/max 조합
  const minVals = specs.map(s => String(s.min ?? (s.data_type === 'choice' ? (s.choices?.[0] || '') : 1)));
  const maxVals = specs.map(s => String(s.max ?? (s.data_type === 'choice' ? (s.choices?.[s.choices.length - 1] || '') : 100)));

  inputs.push([...minVals]);
  inputs.push([...maxVals]);
  if (specs.length >= 2) {
    inputs.push([minVals[0], ...maxVals.slice(1)]);
    inputs.push([maxVals[0], ...minVals.slice(1)]);
  }
  return inputs;
}

// 입력값 배열을 stdin 문자열로 변환
function inputArrayToStdin(arr) {
  return arr.join('\n');
}

// ─── 메인 핸들러 ──────────────────────────────────────────────────────────
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    try {
      await base44.auth.me();
    } catch (_) { /* 인증 실패해도 관리자 기능이면 진행 */ }

    let body;
    try {
      body = await req.json();
    } catch (_) {
      return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const { answer_code, test_count = 10, input_specs = [], mode = 'generate', existing_test_cases = [] } = body;

    if (!answer_code || typeof answer_code !== 'string') {
      return Response.json({ error: '정답 코드가 없습니다.' }, { status: 400 });
    }

    // ── recalculate 모드: 기존 테스트케이스의 입력값을 정답 코드로 재실행 ──────
    if (mode === 'recalculate') {
      if (!Array.isArray(existing_test_cases) || existing_test_cases.length === 0) {
        return Response.json({ error: '재계산할 테스트케이스가 없습니다.' }, { status: 400 });
      }
      const updated = [];
      for (let i = 0; i < existing_test_cases.length; i++) {
        const tc = existing_test_cases[i];
        const stdin = tc.input || '';
        try {
          const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `You are a Python 3 interpreter simulator.
Simulate running the following Python code with the provided stdin and return ONLY the stdout produced by print() statements.

IMPORTANT - How input() works:
- input("prompt") reads one line from stdin but does NOT write anything to stdout. The prompt and the typed input value are NOT part of stdout.
- Only print() output appears in stdout.
- Process input() calls in order, consuming one stdin line each time.

Return ONLY the print() output. Do NOT include input() prompts or stdin values in the output.
If there is a syntax error or runtime error, set has_error=true and put the error message in error field.

Stdin input (feed each line to successive input() calls in order):
${stdin}

Python code:
\`\`\`python
${answer_code}
\`\`\``,
            response_json_schema: {
              type: 'object',
              properties: {
                output: { type: 'string' },
                error: { type: 'string' },
                has_error: { type: 'boolean' },
              },
            },
          });
          if (result.has_error) {
            return Response.json({
              error: `테스트케이스 ${i + 1}번 재계산 중 오류: ${result.error || result.output || '정답 코드 실행 실패'}`,
            }, { status: 500 });
          }
          updated.push({
            input: stdin,
            expected_output: (result.output || '').trim(),
            hidden: tc.hidden !== undefined ? tc.hidden : true,
          });
        } catch (execErr) {
          return Response.json({
            error: `테스트케이스 ${i + 1}번 재계산 중 오류: ${execErr?.message || '실행 오류'}`,
          }, { status: 500 });
        }
      }
      return Response.json({ test_cases: updated, generated_count: updated.length });
    }

    const maxTests = Math.min(Math.max(1, test_count || 10), 20);
    if (!Array.isArray(input_specs) || input_specs.length === 0) {
      return Response.json({ error: '입력값 설정이 없습니다. 입력 자료형과 범위를 지정해주세요.' }, { status: 400 });
    }

    // 1. 경계값 입력 생성
    const boundaryInputs = generateBoundaryInputs(input_specs);
    const seen = new Set();
    const allInputs = [];

    for (const arr of boundaryInputs) {
      const stdin = inputArrayToStdin(arr);
      if (!seen.has(stdin)) {
        seen.add(stdin);
        allInputs.push(arr);
      }
    }

    // 2. 나머지 랜덤 입력 생성 (중복 방지, 최대 시도 200회)
    const targetCount = maxTests;
    let attempts = 0;
    const maxAttempts = targetCount * 10;
    while (allInputs.length < targetCount && attempts < maxAttempts) {
      attempts++;
      const arr = input_specs.map(spec => genValue(spec));
      const stdin = inputArrayToStdin(arr);
      if (!seen.has(stdin)) {
        seen.add(stdin);
        allInputs.push(arr);
      }
    }

    const dedupWarning = allInputs.length < targetCount
      ? `요청한 ${targetCount}개 중 ${allInputs.length}개만 생성되었습니다 (중복 제외). 입력 범위를 넓혀보세요.`
      : null;

    // 3. 각 입력에 대해 answer_code 실행 → expected_output 생성
    const testCases = [];
    for (let i = 0; i < allInputs.length; i++) {
      const inputArr = allInputs[i];
      const stdin = inputArrayToStdin(inputArr);

      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a Python 3 interpreter simulator.
Simulate running the following Python code with the provided stdin and return ONLY the stdout produced by print() statements.

IMPORTANT - How input() works:
- input("prompt") reads one line from stdin but does NOT write anything to stdout. The prompt and the typed input value are NOT part of stdout.
- Only print() output appears in stdout.
- Process input() calls in order, consuming one stdin line each time.

Return ONLY the print() output. Do NOT include input() prompts or stdin values in the output.
If there is a syntax error or runtime error, set has_error=true and put the error message in error field.
Do NOT add any explanation, markdown, or extra text. Return ONLY the raw stdout output.

Stdin input (feed each line to successive input() calls in order):
${stdin}

Python code:
\`\`\`python
${answer_code}
\`\`\``,
          response_json_schema: {
            type: 'object',
            properties: {
              output: { type: 'string' },
              error: { type: 'string' },
              has_error: { type: 'boolean' },
            },
          },
        });

        if (result.has_error) {
          return Response.json({
            error: `테스트케이스 ${i + 1}번 생성 중 오류가 발생했습니다: ${result.error || result.output || '정답 코드 실행 실패'}`,
            failed_index: i,
          }, { status: 500 });
        }

        testCases.push({
          input: stdin,
          expected_output: (result.output || '').trim(),
          hidden: true,
        });
      } catch (execErr) {
        return Response.json({
          error: `테스트케이스 ${i + 1}번 생성 중 오류가 발생했습니다: ${execErr?.message || '실행 오류'}`,
          failed_index: i,
        }, { status: 500 });
      }
    }

    return Response.json({
      test_cases: testCases,
      generated_count: testCases.length,
      ...(dedupWarning ? { warning: dedupWarning } : {}),
    });
  } catch (err) {
    return Response.json({ error: err?.message || '테스트케이스 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}