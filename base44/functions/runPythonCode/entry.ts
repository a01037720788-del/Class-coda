import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Python 코드 실행 (LLM 시뮬레이션)
 *
 * ⚠️ 중요: 이 함수는 실제 Python 인터프리터가 아닌 LLM으로 실행을 시뮬레이션합니다.
 *   - 간단한 학습용 예제에는 사용 가능
 *   - 복잡한 반복문, floating point, edge case, 무한루프 등은 부정확할 수 있음
 *   - 정확한 자동 채점(온라인 저지)에는 신뢰할 수 없음
 *
 * 통일된 input() 동작 (Python 실제 동작 기준):
 *   - input("prompt")는 prompt를 stdout에 출력한 후 stdin에서 한 줄을 읽음
 *   - 입력된 값 자체는 stdout에 echo되지 않음
 *   - simple 모드와 judge 모드 모두 동일하게 동작
 */

Deno.serve(async (req) => {
  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (_) {
    return Response.json({ output: '', error: 'SDK 초기화 실패', exit_code: 1 });
  }

  // 학생 커스텀 로그인(appLogin) 방식도 허용 — auth.me() 실패 시에도 계속 진행
  try {
    await base44.auth.me();
  } catch (_) {
    // 인증 실패해도 코드 실행은 허용 (appLogin 사용자)
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return Response.json({ output: '', error: '잘못된 요청입니다.', exit_code: 1 });
  }

  const { code, test_cases, mode, stdin, stdin_input } = body;
  if (!code || typeof code !== 'string') {
    return Response.json({ output: '', error: '코드가 없습니다.', exit_code: 1 });
  }

  // stdin 호환: stdin (신규) 우선, stdin_input (레거시) fallback
  const stdinValue = stdin ?? stdin_input ?? '';

  // input() 호출 개수 계산
  const inputMatches = String(code).match(/\binput\s*\(/g);
  const inputCount = inputMatches ? inputMatches.length : 0;
  const providedCount = String(stdinValue || '').trim() === '' ? 0 : String(stdinValue).trim().split(/\r?\n/).length;

  // 통일된 input() 동작 설명 (Python 실제 동작)
  const INPUT_BEHAVIOR = `IMPORTANT - How input() works (matches real Python 3 behavior):
- input("prompt") writes the prompt text to stdout, then reads one line from stdin.
- The typed input value is NOT echoed to stdout (non-interactive mode).
- Example: input("이름: ") with stdin "Tom" produces stdout "이름: " (the prompt only).
- A subsequent print(f"Hello, {name}") would then add "Hello, Tom\\n" to stdout.
- Process input() calls in order, consuming one stdin line each time.
- If input() has no prompt argument, nothing is written to stdout for that call.`;

  // ── Simple / 학습용 실행 ──────────────────────────────────────────────────
  if (mode === 'simple' || !test_cases || !Array.isArray(test_cases) || test_cases.length === 0) {
    // 입력값 부족 검사
    if (inputCount > 0 && providedCount < inputCount) {
      return Response.json({
        output: '',
        error: `입력값이 부족합니다.\n${inputCount}개의 입력값이 필요하지만 ${providedCount}개만 입력되었습니다.`,
        exit_code: 1,
        input_count: inputCount,
        provided_count: providedCount,
      });
    }

    try {
      const stdinSection = stdinValue
        ? `\nStdin input (feed each line to successive input() calls in order):\n${stdinValue}\n`
        : '';
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a Python 3 interpreter simulator.
Simulate running the following Python code with the provided stdin and return ONLY the stdout produced by print() statements and input() prompts.

${INPUT_BEHAVIOR}

Return ONLY the stdout output. Do NOT include the stdin values themselves in the output (only input() prompts and print() output).
If there is a syntax error or runtime error, return only the error message (e.g. "SyntaxError: invalid syntax").
Do NOT add any explanation, markdown, or extra text. Return ONLY the raw stdout output.
${stdinSection}
Python code:
\`\`\`python
${code}
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

      return Response.json({
        output: result.has_error ? '' : (result.output || ''),
        error: result.has_error ? (result.error || result.output || '오류 발생') : '',
        exit_code: result.has_error ? 1 : 0,
        input_count: inputCount,
        provided_count: providedCount,
      });
    } catch (llmErr) {
      return Response.json({
        output: '',
        error: llmErr?.message || 'LLM 실행 중 오류가 발생했습니다.',
        exit_code: 1,
      });
    }
  }

  // ── Judge 모드 (테스트케이스) ─────────────────────────────────────────────
  // 모든 test_cases를 채점에 포함 (hidden 여부와 무관하게).
  // hidden인 경우 응답에서 input/expected_output만 숨김.
  try {
    const allCases = test_cases; // hidden 포함 전체 채점
    const startTime = Date.now();

    const casePromises = allCases.map(async (tc, idx) => {
      const tcStart = Date.now();
      const isHidden = tc.is_hidden === true || tc.hidden === true;
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a Python 3 interpreter. Execute the code below with the given stdin input.
Return ONLY the exact stdout output, trimmed of trailing whitespace/newlines.

${INPUT_BEHAVIOR}

If there is an error, set has_error=true and put the error message in error field.

Stdin input:
${tc.input || ''}

Python code:
\`\`\`python
${code}
\`\`\``,
          response_json_schema: {
            type: 'object',
            properties: {
              output: { type: 'string', description: 'stdout output, trimmed' },
              error: { type: 'string', description: 'error message if any' },
              has_error: { type: 'boolean' },
            },
          },
        });

        const elapsed = Date.now() - tcStart;
        const actual = (result.output || '').trim();
        const expected = (tc.output || tc.expected_output || '').trim();
        const passed = !result.has_error && actual === expected;

        return {
          index: idx,
          // hidden인 경우 input/expected_output을 응답에서 숨김
          input: isHidden ? '' : (tc.input || ''),
          expected_output: isHidden ? '' : expected,
          actual_output: isHidden ? '' : (result.has_error ? '' : actual),
          error: result.has_error ? (result.error || '런타임 오류') : '',
          passed,
          time_ms: elapsed,
          memory_kb: null, // 실제 측정 불가 — 랜덤값 사용 금지
          is_hidden: isHidden,
        };
      } catch (tcErr) {
        return {
          index: idx,
          input: isHidden ? '' : (tc.input || ''),
          expected_output: isHidden ? '' : (tc.output || tc.expected_output || '').trim(),
          actual_output: '',
          error: tcErr?.message || '실행 오류',
          passed: false,
          time_ms: Date.now() - tcStart,
          memory_kb: null,
          is_hidden: isHidden,
        };
      }
    });

    const results = await Promise.all(casePromises);
    const passedCount = results.filter(r => r.passed).length;
    const hasCompileError = results.some(r => r.error?.includes('SyntaxError') || r.error?.includes('IndentationError'));
    const maxTime = Math.max(...results.map(r => r.time_ms), 0);

    return Response.json({
      mode: 'judge',
      total: allCases.length,
      passed: passedCount,
      has_compile_error: hasCompileError,
      compile_error: hasCompileError ? results.find(r => r.error?.includes('SyntaxError') || r.error?.includes('IndentationError'))?.error : '',
      results,
      max_time_ms: maxTime,
      max_memory_kb: null, // 실제 측정 불가
      verdict: passedCount === allCases.length ? 'AC' : (hasCompileError ? 'CE' : 'WA'),
    });
  } catch (err) {
    return Response.json({ output: '', error: err?.message || '실행 중 오류 발생', exit_code: 1 });
  }
});