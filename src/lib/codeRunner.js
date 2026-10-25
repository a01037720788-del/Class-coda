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
 * - C++: 실행 미지원 (화면에 명확히 안내)
 *   - 브라우저만으로는 C++ 를 컴파일할 수 없어 실행 기능을 제공하지 않습니다.
 *   - 외부 실행 서비스도 사용하지 않습니다. runCpp() 은 실행을 시도하지 않고
 *     "미지원" 결과를 즉시 반환합니다.
 *
 * - 2순위(폴백): Base44 Functions (runPythonCode)
 *   - Pyodide 를 사용할 수 없을 때만 사용
 *
 * 반환 포맷은 기존 base44.functions.invoke("runPythonCode") 의 res.data 와 동일:
 *   simple: { output, error, exit_code }
 *   judge:  { mode, total, passed, results, verdict, ... }
 */


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
    // 독립 운영: Base44 서버로 코드를 전송하지 않습니다.
    // Pyodide 오류는 그대로 사용자에게 안내합니다.
    console.error("[codeRunner] 브라우저 Python 실행 실패:", pyodideError);
    return {
      output: "",
      error: "브라우저 Python 실행 환경을 시작하지 못했습니다. 인터넷 연결을 확인한 후 새로고침하여 다시 시도해 주세요.",
      exit_code: 1,
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  C++ — 실행 미지원
// ═════════════════════════════════════════════════════════════════════════════

/**
 * C++ 코드 실행은 지원하지 않습니다.
 * 브라우저만으로 C++ 를 컴파일할 수 없고, 외부 실행 서비스도 사용하지 않습니다.
 * 학생 화면에는 이 사실을 명확히 표시합니다.
 *
 * ※ 코드 작성·저장, 예제 코드 비교 확인은 정상 동작합니다.
 */
export const CPP_EXECUTION_SUPPORTED = false;

export const CPP_UNSUPPORTED_MESSAGE = "C++ 코드 실행은 이 사이트에서 지원하지 않습니다.";

export async function runCpp() {
  // 실행을 시도하지 않습니다. 네트워크 요청을 보내지 않습니다.
  return {
    output: "",
    error: CPP_UNSUPPORTED_MESSAGE,
    exit_code: 1,
    unsupported: true,
  };
}

export default { runPython, runCpp };