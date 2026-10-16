import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function normalizeOutput(s) {
  if (!s) return '';
  return String(s)
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}

    const body = await req.json();
    const { unit_id, problem_id, code, student_id, student_name, session_token } = body;

    if (!unit_id || !problem_id || !code) {
      return Response.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    // 서비스 롤로 Unit 로드 (answer_code, hidden test_cases 포함)
    const unit = await base44.asServiceRole.entities.AlgorithmUnit.get(unit_id);
    if (!unit) {
      return Response.json({ error: 'Unit을 찾을 수 없습니다.' }, { status: 404 });
    }

    const problem = (unit.judge_problems || []).find(p => p.id === problem_id);
    if (!problem) {
      return Response.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
    }

    const testCases = problem.test_cases || [];
    const gradingMode = problem.grading_mode || 'normalize';
    const stopOnFirstFail = problem.stop_on_first_fail === true;
    const timeLimitMs = (problem.time_limit || 2) * 1000;

    // 테스트케이스가 없으면 빈 결과 반환
    if (testCases.length === 0) {
      return Response.json({
        verdict: 'AC',
        passed_count: 0,
        total_count: 0,
        results: [],
        execution_time_ms: 0,
      });
    }

    // 구문 오류 사전 검사 (첫 번째 테스트케이스로 probe)
    let compileError = '';
    try {
      const probeResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a Python 3 interpreter. Try to compile the following code. If there is a SyntaxError or IndentationError, return has_error=true with the error message. Otherwise return has_error=false with empty output.

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
      if (probeResult.has_error && (probeResult.error?.includes('SyntaxError') || probeResult.error?.includes('IndentationError'))) {
        compileError = probeResult.error;
      }
    } catch (_) {}

    if (compileError) {
      // 모든 테스트케이스를 CE로 표시
      const results = testCases.map((tc, idx) => ({
        index: idx,
        passed: false,
        status: 'CE',
        is_hidden: !!tc.hidden,
        error: compileError,
        time_ms: 0,
        ...(tc.hidden ? {} : { input: tc.input || '', expected_output: (tc.expected_output || '').trim(), actual_output: '' }),
      }));
      await saveSubmission(base44, { student_id, student_name, user, unit, problem, code, verdict: 'CE', passed_count: 0, total_count: testCases.length, results, session_token });
      return Response.json({
        verdict: 'CE',
        passed_count: 0,
        total_count: testCases.length,
        results,
        execution_time_ms: 0,
        compile_error: compileError,
      });
    }

    // 각 테스트케이스별 실행
    const results = [];
    let passedCount = 0;
    let firstFailStatus = '';

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const tcStart = Date.now();
      let actual = '';
      let tcError = '';
      let tcStatus = 'WA';
      let passed = false;

      try {
        const llmResult = await Promise.race([
          base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `You are a Python 3 interpreter. Execute the code below with the given stdin input.
Return ONLY the exact stdout output, trimmed of trailing whitespace/newlines.
IMPORTANT - How input() works (matches real Python 3 behavior):
- input("prompt") writes the prompt text to stdout, then reads one line from stdin.
- The typed input value is NOT echoed to stdout (non-interactive mode).
- input() with no prompt argument writes nothing to stdout.
- Process input() calls in order, consuming one stdin line each time.
If there is a runtime error, set has_error=true and put ONLY the error message (e.g. "IndexError: list index out of range") in the error field. Do NOT include full stack traces.

Stdin input:
${tc.input || ''}

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
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('__TLE__')), timeLimitMs + 10000)),
        ]);

        const elapsed = Date.now() - tcStart;
        actual = (llmResult.output || '').trim();

        if (llmResult.has_error) {
          tcStatus = 'RE';
          tcError = llmResult.error || '실행 오류';
        } else if (elapsed > timeLimitMs) {
          tcStatus = 'TLE';
          tcError = '시간 초과';
        } else {
          const expected = (tc.expected_output || '').trim();
          let isMatch;
          if (gradingMode === 'exact') {
            isMatch = actual === expected;
          } else {
            isMatch = normalizeOutput(actual) === normalizeOutput(expected);
          }
          if (isMatch) {
            passed = true;
            tcStatus = 'AC';
          } else {
            tcStatus = 'WA';
          }
        }
      } catch (err) {
        const elapsed = Date.now() - tcStart;
        if (err.message === '__TLE__') {
          tcStatus = 'TLE';
          tcError = '시간 초과';
        } else {
          tcStatus = 'RE';
          tcError = err.message || '실행 오류';
        }
        actual = '';
      }

      const elapsed = Date.now() - tcStart;

      // 결과 객체 생성 (hidden은 데이터 없이 결과만)
      const result = {
        index: i,
        passed,
        status: tcStatus,
        is_hidden: !!tc.hidden,
        time_ms: elapsed,
        error: tcError || '',
      };
      if (!tc.hidden) {
        result.input = tc.input || '';
        result.expected_output = (tc.expected_output || '').trim();
        result.actual_output = (tcStatus === 'RE' || tcStatus === 'TLE' || tcStatus === 'CE') ? '' : actual;
      }
      results.push(result);

      if (passed) {
        passedCount++;
      } else {
        if (!firstFailStatus) firstFailStatus = tcStatus;
        if (stopOnFirstFail) break;
      }
    }

    // 전체 verdict 결정
    let verdict;
    if (passedCount === testCases.length) {
      verdict = 'AC';
    } else {
      verdict = firstFailStatus || 'WA';
    }

    const totalTime = results.reduce((sum, r) => sum + (r.time_ms || 0), 0);

    // 제출 기록 저장
    await saveSubmission(base44, { student_id, student_name, user, unit, problem, code, verdict, passed_count: passedCount, total_count: testCases.length, results, execution_time_ms: totalTime, session_token });

    return Response.json({
      verdict,
      passed_count: passedCount,
      total_count: testCases.length,
      results,
      execution_time_ms: totalTime,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function saveSubmission(base44, ctx) {
  const { student_id, student_name, user, unit, problem, code, verdict, passed_count, total_count, results, execution_time_ms, session_token } = ctx;
  const sid = student_id || user?.student_id || user?.id;
  if (!sid) return;

  // 1. AlgorithmJudgeSubmission (Base44 Entity)에 저장
  try {
    await base44.asServiceRole.entities.AlgorithmJudgeSubmission.create({
      student_id: sid,
      student_name: student_name || user?.name || '',
      unit_id: unit.id,
      unit_title: unit.title || '',
      problem_id: problem.id,
      problem_number: problem.number || 0,
      problem_title: problem.title || '',
      submitted_code: code,
      verdict,
      passed_count,
      total_count,
      execution_time_ms: execution_time_ms || 0,
      test_results: results,
      submitted_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[judgeAlgorithmProblem] AlgorithmJudgeSubmission 저장 실패:', e.message);
  }

  // 2. StudentSubmission (Base44 Entity)에도 저장
  try {
    await base44.asServiceRole.entities.StudentSubmission.create({
      student_id: sid,
      student_name: student_name || user?.name || '',
      login_id: user?.login_id || '',
      unit_id: unit.id,
      unit_title: unit.title || '',
      unit_type: 'algorithm_learning',
      item_type: 'judge',
      item_number: problem.number || 0,
      data: {
        problem_id: problem.id,
        problem_number: problem.number || 0,
        problem_title: problem.title || '',
        submitted_code: code,
        verdict,
        passed_count,
        total_count,
        execution_time_ms: execution_time_ms || 0,
        test_results: results,
      },
      is_correct: verdict === 'AC',
      submitted_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[judgeAlgorithmProblem] StudentSubmission 저장 실패:', e.message);
  }
}