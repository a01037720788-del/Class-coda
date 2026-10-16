/**
 * 독립 코드 실행 레이어 (Code Runner)
 *
 * 학생 Python/C++ 코드를 Base44 Functions 의존 없이 실행할 수 있도록,
 * 외부 샌드박스 실행 환경을 1순위로 사용하고 Base44 Functions를 폴백으로 사용.
 *
 * - Python 1순위: Pyodide (브라우저 내 WebAssembly Python)
 *   - 실제 Python 3 실행 (LLM 시뮬레이션이 아님)
 *   - 서버 불필요 — Base44 장애와 완전히 무관
 *   - input() 프롬프트는 stdout에 출력하지 않도록 monkey-patch (기존 LLM 시뮬레이션 동작 유지)
 *   - Web Worker에서 실행 → 무한 루프 시 worker 종료로 브라우저 정지 방지
 *
 * - C++ 1순위: Judge0 CE (https://ce.judge0.com)
 *   - 실제 C++ 컴파일·실행 (LLM 시뮬레이션이 아님)
 *   - 샌드박스 컨테이너 실행 (파일시스템·네트워크 차단, 메모리·시간 제한)
 *
 * - 2순위(폴백): Base44 Functions (runPythonCode / runCppCode)
 *   - 1순위 실행 실패 시 자동 전환
 *
 * 반환 포맷은 기존 base44.functions.invoke("runPythonCode"|"runCppCode") 의 res.data 와 동일:
 *   simple: { output, error, exit_code }
 *   judge:  { mode, total, passed, results, verdict, ... }
 */

import { base44 } from "@/api/base44Client";

// ═════════════════════════════════════════════════════════════════════════════
//  Pyodide Web Worker (Python in-browser execution)
// ═════════════════════════════════════════════════════════════════════════════

const PYODIDE_VERSION = "0.26.2";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let _pyodideWorker = null;
let _pyodideMsgId = 0;
let _pyodideLoading = false;

/**
 * Web Worker 소스코드 — Pyodide를 로드하고 Python 코드를 실행.
 * input() 프롬프트를 stdout에 쓰지 않도록 monkey-patch하여 기존 LLM 시뮬레이션 동작 유지.
 */
const WORKER_SOURCE = `
let pyodide = null;
let loading = false;

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (loading) {
    while (loading) { await new Promise(r => setTimeout(r, 50)); }
    return pyodide;
  }
  loading = true;
  try {
    importScripts("${PYODIDE_CDN}pyodide.js");
    pyodide = await self.loadPyodide({ indexURL: "${PYODIDE_CDN}" });
  } finally {
    loading = false;
  }
  return pyodide;
}

async function runSimple(code, stdin) {
  const py = await ensurePyodide();
  py.globals.set("_student_code", code);
  py.globals.set("_stdin_text", stdin || "");
  await py.runPythonAsync([
    "import sys, io, builtins, traceback",
    "_stdin = io.StringIO(_stdin_text)",
    "_stdout = io.StringIO()",
    "_stderr = io.StringIO()",
    "sys.stdin = _stdin",
    "sys.stdout = _stdout",
    "sys.stderr = _stderr",
    "def _custom_input(prompt=\\\"\\\"):",
    "    line = _stdin.readline()",
    "    if not line: raise EOFError(\\\"EOF when reading a line\\\")",
    "    return line.rstrip(\\\"\\\\n\\\")",
    "builtins.input = _custom_input",
    "_error = \\\"\\\"",
    "try:",
    "    exec(_student_code, {\\\"__builtins__\\\": builtins, \\\"__name__\\\": \\\"__main__\\\"})",
    "except Exception:",
    "    _error = traceback.format_exc()",
    "_result_stdout = _stdout.getvalue()",
    "_result_stderr = _stderr.getvalue()",
    "_result_error = _error",
  ].join("\\n"));
  const stdout = py.globals.get("_result_stdout") || "";
  const stderr = py.globals.get("_result_stderr") || "";
  const error = py.globals.get("_result_error") || "";
  return { output: stdout, error: error || stderr, exit_code: (error || stderr) ? 1 : 0 };
}

async function runJudge(code, testCases) {
  const visible = testCases.filter(tc => tc.is_hidden !== true && tc.hidden !== true);
  // 컴파일(구문) 오류 사전 확인
  let compileError = "";
  try {
    const py = await ensurePyodide();
    py.globals.set("_student_code", code);
    await py.runPythonAsync([
      "import sys, traceback",
      "_error = \\\"\\\"",
      "try:",
      "    compile(_student_code, \\\"<student>\\\", \\\"exec\\\")",
      "except SyntaxError as e:",
      "    _error = str(e)",
      "_result_error = _error",
    ].join("\\n"));
    compileError = py.globals.get("_result_error") || "";
  } catch (e) {
    compileError = e.message || String(e);
  }
  if (compileError) {
    return {
      mode: "judge", total: visible.length, passed: 0,
      has_compile_error: true, compile_error: compileError,
      results: visible.map((tc, idx) => ({
        index: idx, input: tc.input || "",
        expected_output: (tc.output || tc.expected_output || "").trim(),
        actual_output: "", error: compileError, passed: false,
        time_ms: 0, memory_kb: 0,
      })),
      max_time_ms: 0, max_memory_kb: 0, verdict: "CE",
    };
  }
  const results = [];
  for (let idx = 0; idx < visible.length; idx++) {
    const tc = visible[idx];
    try {
      const r = await runSimple(code, tc.input || "");
      const actual = (r.output || "").trim();
      const expected = (tc.output || tc.expected_output || "").trim();
      const passed = !r.error && actual === expected;
      results.push({
        index: idx, input: tc.input || "",
        expected_output: expected,
        actual_output: r.error ? "" : actual,
        error: r.error || "", passed,
        time_ms: 0, memory_kb: 0,
      });
    } catch (e) {
      results.push({
        index: idx, input: tc.input || "",
        expected_output: (tc.output || tc.expected_output || "").trim(),
        actual_output: "", error: e.message || "실행 오류", passed: false,
        time_ms: 0, memory_kb: 0,
      });
    }
  }
  const passedCount = results.filter(r => r.passed).length;
  return {
    mode: "judge", total: visible.length, passed: passedCount,
    has_compile_error: false, compile_error: "",
    results, max_time_ms: 0, max_memory_kb: 0,
    verdict: passedCount === visible.length ? "AC" : "WA",
  };
}

self.onmessage = async (e) => {
  const { id, type, code, stdin, testCases } = e.data;
  try {
    let result;
    if (type === "judge") {
      result = await runJudge(code, testCases || []);
    } else {
      result = await runSimple(code, stdin || "");
    }
    self.postMessage({ id, ...result });
  } catch (err) {
    self.postMessage({ id, output: "", error: "Pyodide 실행 오류: " + (err.message || String(err)), exit_code: 1 });
  }
};
`;

function getPyodideWorker() {
  if (_pyodideWorker) return _pyodideWorker;
  try {
    const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    _pyodideWorker = new Worker(url);
    _pyodideWorker.onerror = () => {
      _pyodideWorker = null;
    };
    return _pyodideWorker;
  } catch {
    return null;
  }
}

function runPythonViaPyodide(type, code, stdin, testCases, timeout = 8000) {
  return new Promise((resolve) => {
    const worker = getPyodideWorker();
    if (!worker) {
      resolve(null);
      return;
    }
    const id = ++_pyodideMsgId;
    const timer = setTimeout(() => {
      try { worker.terminate(); } catch {}
      _pyodideWorker = null;
      resolve({
        output: "",
        error: "실행 시간이 초과되었습니다. (무한 루프가 의심됩니다)",
        exit_code: 1,
      });
    }, timeout + 15000); // Pyodide 초기 로드(최대 ~15s) + 실행 시간 여유
    const handler = (e) => {
      if (e.data.id === id) {
        worker.removeEventListener("message", handler);
        clearTimeout(timer);
        resolve(e.data);
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ id, type, code, stdin, testCases });
  });
}

// ─── input() 개수 사전 검사 (Python) ──────────────────────────────────────────
function checkInputCount(code, stdin) {
  const inputMatches = String(code).match(/\binput\s*\(/g);
  const inputCount = inputMatches ? inputMatches.length : 0;
  const providedCount =
    String(stdin || "").trim() === ""
      ? 0
      : String(stdin).trim().split(/\r?\n/).length;
  if (inputCount > 0 && providedCount < inputCount) {
    return {
      output: "",
      error: `입력값이 부족합니다.\n${inputCount}개의 입력값이 필요하지만 ${providedCount}개만 입력되었습니다.`,
      exit_code: 1,
      input_count: inputCount,
      provided_count: providedCount,
    };
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
//  Judge0 CE API (C++ execution)
// ═════════════════════════════════════════════════════════════════════════════

const JUDGE0_URL = "https://ce.judge0.com/submissions/?base64_encoded=false&wait=true";
const JUDGE0_CPP_ID = 54;  // C++ (GCC 9.2.0)
const JUDGE0_PY_ID = 71;   // Python 3 — 폴백용

async function runViaJudge0(languageId, code, stdin, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(JUDGE0_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin: stdin || "",
        cpu_time_limit: Math.ceil((timeout || 5000) / 1000),
        memory_limit: 256000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Judge0 HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function runCppSimpleViaJudge0(code, stdin, timeout) {
  const data = await runViaJudge0(JUDGE0_CPP_ID, code, stdin, timeout);
  const status = data.status?.id;
  const compileOutput = data.compile_output || "";
  const stderr = data.stderr || "";
  const stdout = data.stdout || "";

  // Judge0 status: 1=In Queue, 2=Processing, 3=Accepted, 4=Wrong Answer, 5=Time Limit Exceeded,
  // 6=Compilation Error, 7=Runtime Error, ...
  if (status === 6) {
    return { output: "", error: compileOutput || "컴파일 오류가 발생했습니다.", exit_code: 1 };
  }
  if (status === 5) {
    return { output: "", error: "시간 초과가 발생했습니다.", exit_code: 1 };
  }
  if (status === 7 || stderr) {
    return { output: stdout || "", error: stderr || "런타임 오류가 발생했습니다.", exit_code: 1 };
  }
  return { output: stdout, error: "", exit_code: 0 };
}

async function runCppJudgeViaJudge0(code, testCases, timeout) {
  // 컴파일 검사를 위해 한 번 실행
  const probe = await runViaJudge0(JUDGE0_CPP_ID, code, "", timeout);
  if (probe.status?.id === 6) {
    return {
      mode: "judge", total: testCases.length, passed: 0,
      results: testCases.map((tc) => ({
        input: tc.input || "",
        expected: (tc.output || tc.expected_output || "").trim(),
        actual: "Compilation Error", passed: false,
      })),
      verdict: "COMPILE_ERROR",
    };
  }

  const results = [];
  for (const tc of testCases) {
    try {
      const data = await runViaJudge0(JUDGE0_CPP_ID, code, tc.input || "", timeout);
      const actual = (data.stdout || "").trim();
      const expected = (tc.output || tc.expected_output || "").trim();
      const passed = data.status?.id === 3 && actual === expected;
      results.push({
        input: tc.input || "", expected,
        actual: data.status?.id === 3 ? actual : "Runtime Error",
        passed,
      });
    } catch {
      results.push({
        input: tc.input || "",
        expected: (tc.output || tc.expected_output || "").trim(),
        actual: "Error", passed: false,
      });
    }
  }
  const passed = results.filter((r) => r.passed).length;
  return {
    mode: "judge", total: results.length, passed,
    results, verdict: passed === results.length ? "ACCEPTED" : "WRONG_ANSWER",
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  공개 API
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Python 코드 실행
 * @param {Object} params
 * @param {string} params.code - Python 소스코드
 * @param {string} [params.stdin=""] - 표준 입력
 * @param {string} [params.mode="simple"] - "simple" | "judge"
 * @param {Array}  [params.test_cases=[]] - judge 모드 테스트케이스
 * @param {number} [params.timeout=5000] - 실행 시간 제한 (ms)
 * @returns {Promise<Object>} { output, error, exit_code } 또는 judge 결과
 */
export async function runPython({
  code,
  stdin = "",
  mode = "simple",
  test_cases = [],
  timeout = 5000,
} = {}) {
  // 1순위: Pyodide (브라우저 내 WebAssembly Python — Base44 완전 무관)
  try {
    if (mode === "judge" && test_cases && test_cases.length > 0) {
      const result = await runPythonViaPyodide("judge", code, stdin, test_cases, timeout);
      if (result) return result;
      throw new Error("Pyodide worker 사용 불가");
    }
    // simple 모드: input() 개수 사전 검사 (기존 UX 유지)
    const inputCheck = checkInputCount(code, stdin);
    if (inputCheck) return inputCheck;
    const result = await runPythonViaPyodide("simple", code, stdin, null, timeout);
    if (result) return result;
    throw new Error("Pyodide worker 사용 불가");
  } catch (pyodideError) {
    // 2순위: Base44 Functions 폴백 (학생이 Base44 인증이 아닌 Supabase 인증을 사용하면 401 발생 가능)
    try {
      const res = await base44.functions.invoke("runPythonCode", {
        code, stdin, mode, test_cases,
      });
      return res.data || res;
    } catch (base44Error) {
      const status = base44Error?.response?.status || base44Error?.status;
      const isAuthErr = status === 401 || (base44Error?.message || "").includes("401");
      console.error("[codeRunner] runPython Base44 fallback 실패:", {
        httpStatus: status,
        errorMessage: base44Error?.message,
        isAuthErr,
      });
      return {
        output: "",
        error: isAuthErr
          ? "코드 실행 서버 인증에 실패했습니다. 잠시 후 다시 시도해 주세요."
          : "코드를 실행할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        exit_code: 1,
      };
    }
  }
}

/**
 * C++ 코드 실행
 * @param {Object} params
 * @param {string} params.code - C++ 소스코드
 * @param {string} [params.stdin=""] - 표준 입력 (또는 params.input)
 * @param {string} [params.input=""] - 레거시 stdin 호환
 * @param {string} [params.mode="simple"] - "simple" | "judge"
 * @param {Array}  [params.test_cases=[]] - judge 모드 테스트케이스
 * @param {number} [params.timeout=5000] - 실행 시간 제한 (ms)
 * @returns {Promise<Object>} { output, error, exit_code } 또는 judge 결과
 */
export async function runCpp({
  code,
  stdin = "",
  input = "",
  mode = "simple",
  test_cases = [],
  timeout = 5000,
} = {}) {
  const stdinValue = stdin || input || "";

  // 1순위: Judge0 CE (외부 샌드박스)
  try {
    if (mode === "judge" && test_cases && test_cases.length > 0) {
      return await runCppJudgeViaJudge0(code, test_cases, timeout);
    }
    return await runCppSimpleViaJudge0(code, stdinValue, timeout);
  } catch (judge0Error) {
    // 2순위: Base44 Functions 폴백 (학생이 Base44 인증이 아닌 Supabase 인증을 사용하면 401 발생 가능)
    try {
      const res = await base44.functions.invoke("runCppCode", {
        code, stdin: stdinValue, input: stdinValue, mode, test_cases,
      });
      return res.data || res;
    } catch (base44Error) {
      const status = base44Error?.response?.status || base44Error?.status;
      const isAuthErr = status === 401 || (base44Error?.message || "").includes("401");
      console.error("[codeRunner] runCpp Base44 fallback 실패:", {
        httpStatus: status,
        errorMessage: base44Error?.message,
        isAuthErr,
      });
      return {
        output: "",
        error: isAuthErr
          ? "코드 실행 서버 인증에 실패했습니다. 잠시 후 다시 시도해 주세요."
          : "코드를 실행할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        exit_code: 1,
      };
    }
  }
}

export default { runPython, runCpp };