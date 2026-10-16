import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Play, Pause, StepForward, StepBack, SkipBack, Gauge,
  ChevronRight, Variable, List, Repeat, GitBranch, Eye, EyeOff,
  Terminal, FunctionSquare
} from "lucide-react";

// ─── Python 코드 시뮬레이터 ────────────────────────────────────────────────────

function stripComment(line) {
  const t = line.trim();
  const idx = t.indexOf('#');
  return idx >= 0 ? t.slice(0, idx).trim() : t;
}

function evalExpr(expr, vars, funcs) {
  if (!expr) return undefined;
  expr = expr.trim();

  // dict literal
  if (expr.startsWith('{') && expr.endsWith('}')) {
    try { return JSON.parse(expr.replace(/'/g, '"')); } catch { return {}; }
  }
  // list literal
  if (expr.startsWith('[') && expr.endsWith(']')) {
    try { return JSON.parse(expr.replace(/'/g, '"')); } catch { return []; }
  }
  // string
  if ((expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }
  // number
  if (!isNaN(Number(expr)) && expr !== '') return Number(expr);
  // bool / None
  if (expr === 'True') return true;
  if (expr === 'False') return false;
  if (expr === 'None') return null;
  // len(x)
  const lenMatch = expr.match(/^len\((\w+)\)$/);
  if (lenMatch) { const v = vars[lenMatch[1]]; return Array.isArray(v) ? v.length : 0; }
  // range
  const rangeMatch = expr.match(/^range\((\d+)(?:,\s*(\d+))?\)$/);
  if (rangeMatch) {
    const s = rangeMatch[2] !== undefined ? Number(rangeMatch[1]) : 0;
    const e = rangeMatch[2] !== undefined ? Number(rangeMatch[2]) : Number(rangeMatch[1]);
    return Array.from({ length: Math.max(0, e - s) }, (_, i) => s + i);
  }
  // list subscript x[0]
  const subMatch = expr.match(/^(\w+)\[(\d+|-?\d+)\]$/);
  if (subMatch) {
    const arr = vars[subMatch[1]];
    const idx2 = Number(subMatch[2]);
    if (Array.isArray(arr)) return idx2 < 0 ? arr[arr.length + idx2] : arr[idx2];
  }
  // dict key x['k']
  const dictMatch = expr.match(/^(\w+)\[['"](.+)['"]\]$/);
  if (dictMatch && vars[dictMatch[1]] !== undefined) return vars[dictMatch[1]][dictMatch[2]];
  // variable
  if (vars[expr] !== undefined) return vars[expr];
  // arithmetic fallback
  try {
    const san = expr.replace(/\b([a-zA-Z_]\w*)\b/g, (m) =>
      vars[m] !== undefined ? JSON.stringify(vars[m]) : m
    );
    // eslint-disable-next-line no-new-func
    return new Function('return ' + san)();
  } catch { return undefined; }
}

function parseAndRun(code) {
  const lines = code.split('\n');
  const steps = [];
  const globalVars = {};
  const output = [];
  const callStack = [];
  const funcs = {}; // function definitions

  let stepId = 0;

  function snapshot() {
    return {
      variables: JSON.parse(JSON.stringify(globalVars)),
      output: [...output],
      callStack: [...callStack],
    };
  }

  function recordStep(lineNum, type, meta = {}) {
    steps.push({ id: stepId++, lineNum, type, ...snapshot(), ...meta });
  }

  // First pass: collect function definitions
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = stripComment(raw);
    const fnMatch = line.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:$/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      const params = fnMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      const bodyStart = i + 1;
      const baseIndent = raw.match(/^(\s*)/)[1].length;
      let bodyEnd = bodyStart;
      while (bodyEnd < lines.length - 1 &&
             (!lines[bodyEnd + 1].trim() || lines[bodyEnd + 1].match(/^(\s*)/)[1].length > baseIndent)) {
        bodyEnd++;
      }
      funcs[fnName] = { params, bodyStart, bodyEnd, baseIndent };
    }
    i++;
  }

  function runBlock(startIdx, endIdx, indent, localVars) {
    let bi = startIdx;
    while (bi <= endIdx) {
      const rawLine = lines[bi];
      if (rawLine === undefined) { bi++; continue; }
      const lineIndent = rawLine.match(/^(\s*)/)[1].length;
      if (lineIndent < indent && rawLine.trim() !== '') break;
      if (lineIndent > indent && rawLine.trim() !== '') { bi++; continue; }

      const line = stripComment(rawLine);
      if (!line) { bi++; continue; }

      // def — skip body
      if (line.match(/^def\s+/)) {
        let skip = bi + 1;
        while (skip <= endIdx && lines[skip] &&
               (lines[skip].trim() === '' || lines[skip].match(/^(\s*)/)[1].length > lineIndent)) skip++;
        recordStep(bi, 'def', { fnName: line.match(/^def\s+(\w+)/)?.[1] });
        bi = skip;
        continue;
      }

      // function call — myFunc(args)
      const callMatch = line.match(/^(\w+)\((.*)?\)$/);
      if (callMatch && funcs[callMatch[1]]) {
        const fnName = callMatch[1];
        const fn = funcs[fnName];
        const argVals = callMatch[2]
          ? callMatch[2].split(',').map(a => evalExpr(a.trim(), localVars, funcs))
          : [];
        const fnLocals = { ...Object.fromEntries(fn.params.map((p, pi) => [p, argVals[pi]])) };
        callStack.push(fnName);
        Object.assign(globalVars, localVars);
        recordStep(bi, 'call', { fnName, args: fnLocals });
        runBlock(fn.bodyStart, fn.bodyEnd, fn.baseIndent + 4, fnLocals);
        callStack.pop();
        recordStep(bi, 'return', { fnName });
        bi++; continue;
      }

      // return
      if (line.startsWith('return ')) {
        const val = evalExpr(line.slice(7), localVars, funcs);
        localVars['__return__'] = val;
        Object.assign(globalVars, localVars);
        recordStep(bi, 'return', { returnVal: val });
        return;
      }

      // print
      if (line.startsWith('print(')) {
        const inner = line.slice(6, -1).trim();
        // handle comma separated args
        let val;
        if (inner.includes(',')) {
          const parts = inner.split(',').map(p => evalExpr(p.trim(), localVars, funcs));
          val = parts.join(' ');
        } else {
          val = evalExpr(inner, localVars, funcs);
        }
        output.push(String(val ?? ''));
        Object.assign(globalVars, localVars);
        recordStep(bi, 'print', { printVal: String(val ?? '') });
        bi++; continue;
      }

      // for loop
      const forMatch = line.match(/^for\s+(\w+)\s+in\s+(.+):$/);
      if (forMatch) {
        const iterVar = forMatch[1];
        const iterExprStr = forMatch[2].trim();
        let iterable = evalExpr(iterExprStr, localVars, funcs);
        if (!Array.isArray(iterable)) iterable = [];

        const bodyStart = bi + 1;
        let bodyEnd = bodyStart;
        while (bodyEnd < endIdx && lines[bodyEnd + 1] !== undefined &&
               (lines[bodyEnd + 1].trim() === '' ||
                lines[bodyEnd + 1].match(/^(\s*)/)[1].length > lineIndent)) bodyEnd++;

        for (let loopIdx = 0; loopIdx < iterable.length; loopIdx++) {
          localVars[iterVar] = iterable[loopIdx];
          Object.assign(globalVars, localVars);
          recordStep(bi, 'for', {
            iterVar, currentVal: iterable[loopIdx],
            loopIdx, loopTotal: iterable.length,
          });
          runBlock(bodyStart, bodyEnd, lineIndent + 2, localVars);
        }
        delete localVars[iterVar];
        delete globalVars[iterVar];
        bi = bodyEnd + 1;
        continue;
      }

      // while
      const whileMatch = line.match(/^while\s+(.+):$/);
      if (whileMatch) {
        const cond = whileMatch[1];
        const bodyStart = bi + 1;
        let bodyEnd = bodyStart;
        while (bodyEnd < endIdx && lines[bodyEnd + 1] !== undefined &&
               (lines[bodyEnd + 1].trim() === '' ||
                lines[bodyEnd + 1].match(/^(\s*)/)[1].length > lineIndent)) bodyEnd++;
        let safety = 0;
        while (evalExpr(cond, localVars, funcs) && safety < 100) {
          safety++;
          Object.assign(globalVars, localVars);
          recordStep(bi, 'while', { cond, condVal: true });
          runBlock(bodyStart, bodyEnd, lineIndent + 4, localVars);
        }
        bi = bodyEnd + 1;
        continue;
      }

      // if / elif / else
      const ifMatch = line.match(/^(if|elif)\s+(.+):$/);
      if (ifMatch || line === 'else:') {
        const condVal = line === 'else:' ? true : Boolean(evalExpr(ifMatch[2], localVars, funcs));
        const bodyStart = bi + 1;
        let bodyEnd = bodyStart;
        while (bodyEnd < endIdx && lines[bodyEnd + 1] !== undefined &&
               (lines[bodyEnd + 1].trim() === '' ||
                lines[bodyEnd + 1].match(/^(\s*)/)[1].length > lineIndent)) bodyEnd++;
        Object.assign(globalVars, localVars);
        recordStep(bi, 'condition', {
          condText: line === 'else:' ? 'else' : ifMatch[2],
          condVal,
        });
        if (condVal) runBlock(bodyStart, bodyEnd, lineIndent + 4, localVars);
        bi = bodyEnd + 1;
        while (bi <= endIdx && lines[bi]) {
          const sib = stripComment(lines[bi]);
          if (sib.startsWith('elif ') || sib === 'else:') {
            let se = bi + 1;
            while (se < endIdx && lines[se + 1] !== undefined &&
                   (lines[se + 1].trim() === '' ||
                    lines[se + 1].match(/^(\s*)/)[1].length > lineIndent)) se++;
            bi = se + 1;
          } else break;
        }
        continue;
      }

      // dict assignment d['k'] = v
      const dictAssign = line.match(/^(\w+)\[['"](.+)['"]\]\s*=\s*(.+)$/);
      if (dictAssign) {
        const [, varName, key, rhsStr] = dictAssign;
        const rhs = evalExpr(rhsStr, localVars, funcs);
        if (!localVars[varName] || typeof localVars[varName] !== 'object' || Array.isArray(localVars[varName])) {
          localVars[varName] = {};
        }
        localVars[varName][key] = rhs;
        Object.assign(globalVars, localVars);
        recordStep(bi, 'dict_assign', { varName, key, newVal: rhs });
        bi++; continue;
      }

      // list subscript assign arr[0] = v
      const listAssign = line.match(/^(\w+)\[(\d+)\]\s*=\s*(.+)$/);
      if (listAssign) {
        const [, varName, idxStr, rhsStr] = listAssign;
        const rhs = evalExpr(rhsStr, localVars, funcs);
        if (Array.isArray(localVars[varName])) {
          localVars[varName][Number(idxStr)] = rhs;
          Object.assign(globalVars, localVars);
          recordStep(bi, 'list_assign', { varName, idx: Number(idxStr), newVal: rhs });
        }
        bi++; continue;
      }

      // assignment: x = expr or x += expr
      const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*([\+\-\*\/\%]?=)\s*(.+)$/);
      if (assignMatch) {
        const varName = assignMatch[1];
        const op = assignMatch[2];
        const rhsStr = assignMatch[3];
        let rhs = evalExpr(rhsStr, localVars, funcs);
        const oldVal = localVars[varName];
        if (op === '+=' ) rhs = (localVars[varName] ?? 0) + (rhs ?? 0);
        else if (op === '-=') rhs = (localVars[varName] ?? 0) - (rhs ?? 0);
        else if (op === '*=') rhs = (localVars[varName] ?? 1) * (rhs ?? 1);
        else if (op === '/=') rhs = (localVars[varName] ?? 0) / (rhs ?? 1);
        else if (op === '%=') rhs = (localVars[varName] ?? 0) % (rhs ?? 1);
        localVars[varName] = rhs;
        Object.assign(globalVars, localVars);
        recordStep(bi, 'assign', { varName, newVal: rhs, oldVal });
        bi++; continue;
      }

      // list methods
      const listMethod = line.match(/^([a-zA-Z_]\w*)\.(\w+)\((.*)?\)$/);
      if (listMethod) {
        const [, objName, method, arg] = listMethod;
        const argVal = evalExpr(arg, localVars, funcs);
        if (Array.isArray(localVars[objName])) {
          const oldVal = [...localVars[objName]];
          if (method === 'append') localVars[objName].push(argVal);
          else if (method === 'pop') localVars[objName].pop();
          else if (method === 'reverse') localVars[objName].reverse();
          else if (method === 'sort') localVars[objName].sort((a, b) => a - b);
          else if (method === 'insert') {
            const parts = (arg || '').split(',');
            const idx2 = Number(evalExpr(parts[0]?.trim(), localVars, funcs));
            const val = evalExpr(parts[1]?.trim(), localVars, funcs);
            localVars[objName].splice(idx2, 0, val);
          } else if (method === 'remove') {
            const idx3 = localVars[objName].indexOf(argVal);
            if (idx3 >= 0) localVars[objName].splice(idx3, 1);
          }
          Object.assign(globalVars, localVars);
          recordStep(bi, 'list_op', { varName: objName, method, argVal, oldVal });
        }
        bi++; continue;
      }

      recordStep(bi, 'other');
      bi++;
    }
  }

  try { runBlock(0, lines.length - 1, 0, globalVars); } catch { /* ignore */ }
  if (steps.length === 0) {
    steps.push({ id: 0, lineNum: 0, type: 'other', variables: {}, output: [], callStack: [] });
  }
  return steps;
}

// ─── 변수 카드 ──────────────────────────────────────────────────────────────────
function VarCard({ name, value, changed }) {
  const isArr = Array.isArray(value);
  const isDict = value !== null && typeof value === 'object' && !isArr;
  const isStr = typeof value === 'string';
  const isBool = typeof value === 'boolean';

  const typeLabel = isArr ? 'list' : isDict ? 'dict' : isBool ? 'bool' : typeof value;
  const typeColor = {
    list: 'text-purple-500', dict: 'text-orange-500',
    number: 'text-blue-500', string: 'text-green-500',
    bool: 'text-pink-500', object: 'text-gray-400',
  }[typeLabel] || 'text-gray-400';

  return (
    <div className={`rounded-xl border-2 p-2.5 transition-all duration-400 ${
      changed ? 'border-yellow-400 bg-yellow-50 shadow-md shadow-yellow-100' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${changed ? 'bg-yellow-400 animate-bounce' : 'bg-blue-400'}`} />
        <span className="text-xs font-bold text-blue-700 font-mono truncate">{name}</span>
        <span className={`text-[10px] ml-auto font-semibold ${typeColor}`}>{typeLabel}</span>
      </div>

      {isArr ? (
        <div className="flex gap-1 flex-wrap">
          {value.map((v, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="border-2 border-purple-300 bg-purple-50 rounded-lg px-2 py-1 text-xs font-mono font-bold text-purple-800 min-w-[28px] text-center">
                {String(v)}
              </div>
              <span className="text-[9px] text-gray-400 mt-0.5">[{i}]</span>
            </div>
          ))}
          {value.length === 0 && <span className="text-xs text-gray-400 italic">비어있음 [ ]</span>}
        </div>
      ) : isDict ? (
        <div className="space-y-1">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-orange-600 font-bold">"{k}"</span>
              <span className="text-gray-400">→</span>
              <span className="bg-orange-50 text-orange-800 px-1.5 rounded font-bold">{JSON.stringify(v)}</span>
            </div>
          ))}
          {Object.keys(value).length === 0 && <span className="text-xs text-gray-400 italic">{"{}"}</span>}
        </div>
      ) : (
        <div className={`rounded-lg px-3 py-1.5 text-sm font-bold font-mono text-center ${
          changed
            ? 'bg-yellow-100 text-yellow-800'
            : isBool
            ? (value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
            : isStr
            ? 'bg-green-50 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {isBool ? (value ? '✓ True' : '✗ False') : isStr ? `"${value}"` : String(value ?? 'None')}
        </div>
      )}
    </div>
  );
}

// ─── 단계 배지 ──────────────────────────────────────────────────────────────────
function StepBadge({ step }) {
  const cfg = {
    assign:      { label: '📦 변수 저장',  color: 'bg-blue-100 text-blue-700' },
    for:         { label: '🔄 반복문',     color: 'bg-purple-100 text-purple-700' },
    while:       { label: '🔄 while',     color: 'bg-purple-100 text-purple-700' },
    condition:   { label: '🌿 조건 판단', color: 'bg-orange-100 text-orange-700' },
    print:       { label: '🖨️ 출력',       color: 'bg-green-100 text-green-700' },
    list_op:     { label: '📋 리스트',    color: 'bg-pink-100 text-pink-700' },
    list_assign: { label: '📋 리스트 수정', color: 'bg-pink-100 text-pink-700' },
    dict_assign: { label: '📖 딕셔너리',  color: 'bg-orange-100 text-orange-700' },
    def:         { label: '🔧 함수 정의', color: 'bg-indigo-100 text-indigo-700' },
    call:        { label: '📞 함수 호출', color: 'bg-indigo-100 text-indigo-700' },
    return:      { label: '↩️ 반환',       color: 'bg-indigo-100 text-indigo-700' },
    other:       { label: '⚙️ 실행',       color: 'bg-gray-100 text-gray-600' },
  };
  const c = cfg[step?.type] || cfg.other;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${c.color}`}>
      {c.label}
    </span>
  );
}

// ─── 설명 텍스트 ────────────────────────────────────────────────────────────────
function StepExplain({ step }) {
  if (!step) return null;
  switch (step.type) {
    case 'assign':
      return (
        <span>
          변수 <code className="font-bold text-blue-700 bg-blue-50 px-1 rounded">{step.varName}</code>에{' '}
          <code className="font-bold text-green-700 bg-green-50 px-1 rounded">{JSON.stringify(step.newVal)}</code> 저장!
          {step.oldVal !== undefined && step.oldVal !== step.newVal &&
            <span className="text-gray-400 text-xs ml-1">(전: {JSON.stringify(step.oldVal)})</span>}
        </span>
      );
    case 'for':
      return (
        <span>
          반복 변수 <code className="font-bold text-purple-700 bg-purple-50 px-1 rounded">{step.iterVar}</code> ={' '}
          <code className="font-bold text-purple-600">{step.currentVal}</code>
          <span className="text-gray-400 ml-1 text-xs">({step.loopIdx + 1}번째 / 총 {step.loopTotal}번)</span>
        </span>
      );
    case 'condition':
      return (
        <span>
          조건 <code className="font-bold text-orange-700 bg-orange-50 px-1 rounded">{step.condText}</code>
          {' 결과 → '}
          <span className={`font-bold px-2 py-0.5 rounded text-sm ${step.condVal ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {step.condVal ? '✓ 참(True)' : '✗ 거짓(False)'}
          </span>
        </span>
      );
    case 'print':
      return (
        <span>
          화면에 출력:{' '}
          <code className="font-mono bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm">"{step.printVal}"</code>
        </span>
      );
    case 'list_op':
      return (
        <span>
          리스트 <code className="font-bold text-pink-700 bg-pink-50 px-1 rounded">{step.varName}</code>에{' '}
          <code className="font-bold">.{step.method}({step.argVal !== undefined ? JSON.stringify(step.argVal) : ''})</code> 실행
        </span>
      );
    case 'dict_assign':
      return (
        <span>
          딕셔너리 <code className="font-bold text-orange-700 bg-orange-50 px-1 rounded">{step.varName}</code>에{' '}
          키 <code className="font-bold">"{step.key}"</code> = <code className="font-bold">{JSON.stringify(step.newVal)}</code> 저장
        </span>
      );
    case 'call':
      return (
        <span>
          함수 <code className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">{step.fnName}()</code> 호출!
        </span>
      );
    case 'return':
      return (
        <span>
          함수 실행 완료{step.returnVal !== undefined ? ` → 반환값: ${JSON.stringify(step.returnVal)}` : ''}
        </span>
      );
    case 'def':
      return (
        <span>
          함수 <code className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">{step.fnName}()</code> 정의됨
        </span>
      );
    default:
      return <span className="text-gray-500">줄 {(step.lineNum || 0) + 1} 실행 중...</span>;
  }
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function CodeVisualizer({ initialCode = "", readOnly = false }) {
  const [code, setCode] = useState(initialCode || DEFAULT_CODE);
  const [steps, setSteps] = useState([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [showOutput, setShowOutput] = useState(true);
  const [changedVars, setChangedVars] = useState({});
  const timerRef = useRef(null);
  const lineRefs = useRef({});

  const codeLines = code.split('\n');

  const compile = useCallback(() => {
    const s = parseAndRun(code);
    setSteps(s);
    setStepIdx(0);
    setRunning(false);
    setChangedVars({});
  }, [code]);

  useEffect(() => { compile(); }, []);

  const currentStep = steps[stepIdx] || null;
  const prevStep = steps[stepIdx - 1] || null;

  useEffect(() => {
    if (!currentStep || !prevStep) { setChangedVars({}); return; }
    const changed = {};
    Object.keys(currentStep.variables).forEach(k => {
      if (JSON.stringify(currentStep.variables[k]) !== JSON.stringify((prevStep.variables || {})[k])) {
        changed[k] = true;
      }
    });
    setChangedVars(changed);
  }, [stepIdx]);

  useEffect(() => {
    if (running) {
      timerRef.current = setTimeout(() => {
        if (stepIdx < steps.length - 1) setStepIdx(i => i + 1);
        else setRunning(false);
      }, speed);
    }
    return () => clearTimeout(timerRef.current);
  }, [running, stepIdx, steps, speed]);

  useEffect(() => {
    const el = lineRefs.current[currentStep?.lineNum];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [stepIdx]);

  const handlePlay  = () => { if (stepIdx >= steps.length - 1) setStepIdx(0); setRunning(true); };
  const handlePause = () => setRunning(false);
  const handleNext  = () => { setRunning(false); if (stepIdx < steps.length - 1) setStepIdx(i => i + 1); };
  const handlePrev  = () => { setRunning(false); if (stepIdx > 0) setStepIdx(i => i - 1); };
  const handleReset = () => { setRunning(false); setStepIdx(0); setChangedVars({}); };

  const vars = currentStep?.variables || {};
  const output = currentStep?.output || [];
  const callStack = currentStep?.callStack || [];
  const progress = steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl overflow-hidden select-none">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm">코드 시각화 🔍</span>
          <span className="text-indigo-200 text-xs hidden sm:inline ml-1">코드를 눈으로 따라가요!</span>
        </div>
        <div className="flex items-center gap-2">
          <StepBadge step={currentStep} />
          <span className="text-indigo-200 text-xs font-mono">{stepIdx + 1}/{steps.length}</span>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-2 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-0 w-2 h-2 bg-purple-400 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
        {/* 왼쪽: 코드 (3/5) */}
        <div className="lg:col-span-3 flex flex-col">
          {/* 코드 영역 */}
          <div className="relative bg-[#1e1e2e] overflow-auto max-h-80">
            {readOnly ? (
              <div className="text-sm font-mono">
                {codeLines.map((line, i) => {
                  const isActive = currentStep?.lineNum === i;
                  const isNext = steps[stepIdx + 1]?.lineNum === i;
                  return (
                    <div
                      key={i}
                      ref={el => lineRefs.current[i] = el}
                      className={`flex items-stretch transition-all duration-200 ${
                        isActive ? 'bg-yellow-400/25' : isNext ? 'bg-blue-400/10' : ''
                      }`}
                    >
                      {isActive && <div className="w-0.5 bg-yellow-400 flex-shrink-0" />}
                      <span className="w-10 flex-shrink-0 text-right pr-2.5 text-[11px] text-[#6c7086] py-0.5 font-mono leading-5 select-none border-r border-[#313244]">
                        {isActive ? <span className="text-yellow-400 text-[13px]">▶</span>
                          : isNext ? <span className="text-blue-400 text-[10px]">▷</span>
                          : <span>{i + 1}</span>}
                      </span>
                      <pre className={`py-0.5 pl-3 pr-4 leading-5 flex-1 whitespace-pre ${
                        isActive ? 'text-yellow-100 font-bold' : isNext ? 'text-blue-200' : 'text-[#cdd6f4]'
                      }`}>{line || ' '}</pre>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="relative">
                <div className="text-sm font-mono absolute inset-0 pointer-events-none overflow-hidden">
                  {codeLines.map((line, i) => {
                    const isActive = currentStep?.lineNum === i;
                    return (
                      <div key={i} ref={el => lineRefs.current[i] = el}
                        className={`flex ${isActive ? 'bg-yellow-400/20' : ''}`}>
                        <span className="w-10 flex-shrink-0 text-right pr-2.5 text-[11px] text-[#6c7086] py-0.5 leading-5 border-r border-[#313244] select-none">
                          {isActive ? <span className="text-yellow-400">▶</span> : i + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  spellCheck={false}
                  className="w-full bg-transparent text-[#cdd6f4] text-sm font-mono pl-11 pr-4 py-0 resize-none focus:outline-none leading-5 min-h-[200px]"
                  style={{ lineHeight: '20px', tabSize: 4 }}
                />
              </div>
            )}
          </div>

          {/* 컴파일 버튼 (편집 모드) */}
          {!readOnly && (
            <div className="bg-[#181825] px-4 py-2 border-t border-[#313244]">
              <Button size="sm" onClick={compile}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7 px-4 gap-1.5">
                <Play className="w-3 h-3" />코드 분석 시작!
              </Button>
            </div>
          )}

          {/* 컨트롤 바 */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 처음으로 */}
              <button onClick={handleReset} title="처음으로"
                className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors shadow-sm">
                <SkipBack className="w-4 h-4" />
              </button>
              {/* 이전 */}
              <button onClick={handlePrev} disabled={stepIdx === 0} title="이전 단계"
                className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors shadow-sm disabled:opacity-30">
                <StepBack className="w-4 h-4" />
              </button>
              {/* 재생/일시정지 */}
              {running ? (
                <button onClick={handlePause}
                  className="px-4 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-1.5 text-sm font-bold">
                  <Pause className="w-4 h-4" />일시정지
                </button>
              ) : (
                <button onClick={handlePlay}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5 text-sm font-bold">
                  <Play className="w-4 h-4" />자동 실행
                </button>
              )}
              {/* 다음 */}
              <button onClick={handleNext} disabled={stepIdx >= steps.length - 1} title="다음 단계"
                className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors shadow-sm disabled:opacity-30">
                <StepForward className="w-4 h-4" />
              </button>

              {/* 속도 슬라이더 */}
              <div className="flex items-center gap-2 ml-auto">
                <Gauge className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  type="range" min={100} max={2000} step={100}
                  value={2100 - speed}
                  onChange={e => setSpeed(2100 - Number(e.target.value))}
                  className="w-20 h-1.5 accent-indigo-600"
                />
                <span className="text-[11px] font-semibold text-gray-500 w-8">
                  {speed < 400 ? '🐇' : speed < 1200 ? '🐢' : '🐌'}
                </span>
              </div>
            </div>
          </div>

          {/* 현재 단계 설명 말풍선 */}
          {currentStep && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">💬</span>
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  <StepExplain step={currentStep} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 변수 + 출력 + 반복/조건 (2/5) */}
        <div className="lg:col-span-2 flex flex-col divide-y divide-gray-100">
          {/* 호출 스택 (함수 실행 중일 때만) */}
          {callStack.length > 0 && (
            <div className="p-3 bg-indigo-50">
              <h4 className="text-xs font-bold text-indigo-600 mb-2 flex items-center gap-1.5">
                <FunctionSquare className="w-3.5 h-3.5" />함수 호출 중
              </h4>
              <div className="flex flex-wrap gap-1">
                {callStack.map((fn, i) => (
                  <div key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-indigo-300" />}
                    <span className="bg-indigo-200 text-indigo-800 text-xs font-mono font-bold px-2 py-0.5 rounded">
                      {fn}()
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 변수 영역 */}
          <div className="p-4 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Variable className="w-3.5 h-3.5 text-blue-500" />변수 상태
              </h4>
              {Object.keys(vars).length > 0 && (
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                  {Object.keys(vars).length}개
                </span>
              )}
            </div>
            {Object.keys(vars).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-xl text-center">
                <span className="text-2xl mb-1">📭</span>
                <span className="text-xs text-gray-400">아직 변수가 없어요</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                {Object.entries(vars).map(([k, v]) => (
                  <VarCard key={k} name={k} value={v} changed={!!changedVars[k]} />
                ))}
              </div>
            )}
          </div>

          {/* 반복 진행 시각화 */}
          {currentStep?.type === 'for' && (
            <div className="p-4 bg-purple-50/60">
              <h4 className="text-xs font-bold text-purple-600 mb-2.5 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5" />반복 진행 중
              </h4>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: currentStep.loopTotal }, (_, i) => (
                  <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    i < currentStep.loopIdx
                      ? 'bg-purple-200 text-purple-600'
                      : i === currentStep.loopIdx
                      ? 'bg-purple-600 text-white scale-125 shadow-md shadow-purple-200'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}>{i}</div>
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-2 text-xs">
                <span className="text-gray-500">현재:</span>
                <code className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                  {currentStep.iterVar} = {currentStep.currentVal}
                </code>
                <span className="text-gray-400">({currentStep.loopIdx + 1}/{currentStep.loopTotal})</span>
              </div>
            </div>
          )}

          {/* 조건 분기 시각화 */}
          {currentStep?.type === 'condition' && (
            <div className="p-4 bg-orange-50/60">
              <h4 className="text-xs font-bold text-orange-600 mb-2.5 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />조건 판단
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-xl p-3 text-center border-2 transition-all ${
                  currentStep.condVal
                    ? 'border-green-400 bg-green-100 shadow-md shadow-green-100'
                    : 'border-gray-200 bg-gray-50 opacity-40'
                }`}>
                  <div className="text-lg mb-0.5">✓</div>
                  <div className="text-xs font-bold text-green-700">참 (True)</div>
                  {currentStep.condVal && <div className="text-[10px] text-green-600 mt-1">이 방향으로!</div>}
                </div>
                <div className={`rounded-xl p-3 text-center border-2 transition-all ${
                  !currentStep.condVal
                    ? 'border-red-400 bg-red-100 shadow-md shadow-red-100'
                    : 'border-gray-200 bg-gray-50 opacity-40'
                }`}>
                  <div className="text-lg mb-0.5">✗</div>
                  <div className="text-xs font-bold text-red-700">거짓 (False)</div>
                  {!currentStep.condVal && <div className="text-[10px] text-red-600 mt-1">이 방향으로!</div>}
                </div>
              </div>
            </div>
          )}

          {/* 출력 영역 */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-green-500" />출력 결과
              </h4>
              <button onClick={() => setShowOutput(v => !v)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                {showOutput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {showOutput && (
              <div className="bg-[#1e1e2e] rounded-xl p-3 min-h-[56px] max-h-36 overflow-auto border border-[#313244]">
                {output.length === 0 ? (
                  <span className="text-[#6c7086] text-xs font-mono">출력 없음...</span>
                ) : (
                  output.map((line, i) => (
                    <div key={i} className={`text-xs font-mono leading-5 flex items-center gap-1.5 ${
                      i === output.length - 1 ? 'text-green-400' : 'text-[#a6e3a1]'
                    }`}>
                      <span className="text-[#6c7086] text-[10px] select-none">{i + 1}</span>
                      {i === output.length - 1 && <span className="text-yellow-400 text-[10px]">▶</span>}
                      <span>{line}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_CODE = `# 예시: 성적 계산
scores = [85, 92, 78, 96, 70]
total = 0
count = 0

for score in scores:
    total += score
    count += 1

average = total / count
print(average)
`;