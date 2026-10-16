import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * C++ 코드 실행 (LLM 시뮬레이션)
 *
 * ⚠️ 중요: 이 함수는 실제 C++ 컴파일러가 아닌 LLM으로 실행을 시뮬레이션합니다.
 *   - 간단한 학습용 예제에는 사용 가능
 *   - 정확한 자동 채점(백준/정올 스타일)에는 신뢰할 수 없음
 *   - 실제 sandboxed compiler 환경이 필요한 경우 별도 검토 필요
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { code, mode, test_cases, input } = body;

    if (!code) {
      return Response.json({ error: "코드가 없습니다." }, { status: 400 });
    }

    if (mode === "judge" && test_cases?.length > 0) {
      // Judge mode: LLM으로 각 테스트케이스 채점
      const prompt = `You are a C++17 compiler and executor. Given this C++ code, simulate its execution for each test case.

C++ Code:
\`\`\`cpp
${code}
\`\`\`

Test cases (JSON array of {input, expected_output}):
${JSON.stringify(test_cases)}

For each test case, simulate the exact output the program would produce with that input.
Return a JSON object with this exact structure:
{
  "results": [
    { "input": "...", "expected": "...", "actual": "...", "passed": true/false }
  ]
}

Rules:
- Use C++17 standard behavior
- Trim trailing whitespace/newline when comparing
- Be precise about integer overflow, type conversions
- If code has compilation error, all results should have passed: false and actual: "Compilation Error"`;

      const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  input: { type: "string" },
                  expected: { type: "string" },
                  actual: { type: "string" },
                  passed: { type: "boolean" }
                }
              }
            }
          }
        }
      });

      const results = llmResult.results || [];
      const passed = results.filter(r => r.passed).length;
      const total = results.length;
      const verdict = passed === total ? "ACCEPTED" : "WRONG_ANSWER";

      return Response.json({ mode: "judge", total, passed, results, verdict });

    } else {
      // Simple mode: 코드 실행 시뮬레이션
      const inputText = input || "";
      const prompt = `You are a C++17 compiler and executor. Simulate the execution of this C++ code and return ONLY the program output, nothing else.

C++ Code:
\`\`\`cpp
${code}
\`\`\`

${inputText ? `Standard Input:\n${inputText}` : "No standard input."}

Rules:
- Use C++17 standard behavior
- Return ONLY what would be printed to stdout
- If there is a compilation or runtime error, return the error message prefixed with "Error: "
- Do not include any explanation, just the raw output`;

      const output = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });

      const isError = typeof output === "string" && output.startsWith("Error:");
      return Response.json({
        output: isError ? "" : (output || ""),
        error: isError ? output : "",
        exit_code: isError ? 1 : 0
      });
    }

  } catch (error) {
    return Response.json({ output: "", error: error.message, exit_code: 1 }, { status: 500 });
  }
});