import React, { useState, useEffect, useRef } from "react";
import { saveQuestionResult } from "@/lib/dataAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock, ChevronsUpDown, RotateCcw, Circle, AlertCircle } from "lucide-react";
import { getSessionToken } from "@/lib/auth";

const LS_KEY = (unitId) => `question_panel_${unitId}`;
function loadSaved(unitId) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(unitId)) || "{}"); } catch { return {}; }
}
function saveToDisk(unitId, data) {
  try { localStorage.setItem(LS_KEY(unitId), JSON.stringify(data)); } catch {}
}

// ─── 애니메이션 래퍼 ──────────────────────────────────────────────────────────
function Collapsible({ open, children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(open ? "auto" : "0px");
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        if (ref.current) setHeight(`${ref.current.scrollHeight}px`);
        setTimeout(() => setHeight("auto"), 300);
      });
    } else {
      if (ref.current) setHeight(`${ref.current.scrollHeight}px`);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight("0px"));
      });
      setTimeout(() => setVisible(false), 300);
    }
  }, [open]);

  return (
    <div style={{ height, overflow: "hidden", transition: "height 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
      <div ref={ref}>
        {visible && children}
      </div>
    </div>
  );
}

// ─── 공통 결과 표시 ───────────────────────────────────────────────────────────
function ResultMsg({ isCorrect, onRetry }) {
  if (isCorrect) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
        <CheckCircle2 className="w-4 h-4" />맞았습니다 🎉
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200">
      <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
        <XCircle className="w-4 h-4" />틀렸습니다
      </div>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
          <RotateCcw className="w-3 h-3" />다시 풀기
        </button>
      )}
    </div>
  );
}

// ─── 타입 정규화 ──────────────────────────────────────────────────────────────
// 영문 신규 타입과 한글 레거시 타입을 모두 지원
function normalizeType(type) {
  const map = {
    "multiple_choice": "객관식",
    "multiple_select": "객관식복수",
    "short_answer": "빈칸채우기",
    "code_output": "코드결과예측",
    "matching": "짝맞추기",
    "ordering": "순서맞추기",
    "fill_blank": "빈칸채우기",
    "ox": "OX",
  };
  return map[type?.toLowerCase()] || type;
}

// ─── 단답형 (short_answer / 빈칸채우기 개선) ─────────────────────────────────
function ShortAnswer({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const [answer, setAnswer] = useState(savedAnswer || "");
  const [result, setResult] = useState(savedAnswer != null ? savedCorrect : null);

  const check = () => {
    const userAns = answer.trim().toLowerCase();
    const correct = (q.answer || "").trim().toLowerCase();
    const ok = userAns === correct;
    setResult(ok);
    onSubmit(answer, ok);
  };
  const retry = () => { setResult(null); setAnswer(""); };

  return (
    <div className="space-y-2">
      <div className="border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-400 transition-colors">
        <div className="bg-gray-50 px-3 py-1.5 text-xs text-gray-400 font-medium border-b border-gray-200">정답 입력</div>
        <input value={answer}
          onChange={e => { if (result !== true) setAnswer(e.target.value); }}
          onKeyDown={e => { if (e.key === "Enter" && result === null) check(); }}
          placeholder="답을 입력하세요..."
          disabled={result === true || disabled}
          className="w-full px-4 py-3 text-sm font-mono focus:outline-none disabled:opacity-60 bg-white" />
      </div>
      {result === null && !disabled && (
        <Button size="sm" onClick={check} disabled={!answer.trim()}>정답 확인</Button>
      )}
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── 단일 코드 결과 예측 (code_output 타입) ───────────────────────────────────
function CodeOutput({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const code = q.code || q.code_block || "";
  const expected = q.expected_output || "";
  const [answer, setAnswer] = useState(savedAnswer || "");
  const [result, setResult] = useState(savedAnswer != null ? savedCorrect : null);

  const check = () => {
    const ok = answer.trim() === expected.trim();
    setResult(ok);
    onSubmit(answer, ok);
  };
  const retry = () => { setResult(null); setAnswer(""); };

  return (
    <div className="space-y-3">
      {code && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-800 px-3 py-1.5 text-xs text-gray-300 font-mono border-b border-gray-700">코드</div>
          <pre className="bg-gray-900 text-green-300 p-4 font-mono text-sm leading-6 overflow-auto select-none" onCopy={e => e.preventDefault()}>{code}</pre>
        </div>
      )}
      <div className="border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-400 transition-colors">
        <div className="bg-gray-50 px-3 py-1.5 text-xs text-gray-400 font-medium border-b border-gray-200">출력 결과 입력</div>
        <textarea value={answer}
          onChange={e => { if (result !== true) setAnswer(e.target.value); }}
          placeholder="실행 결과를 입력하세요..."
          disabled={result === true || disabled}
          rows={Math.max(2, (expected.match(/\n/g) || []).length + 1)}
          className="w-full px-4 py-3 text-sm font-mono focus:outline-none resize-none disabled:opacity-60 bg-white" />
      </div>
      {result === null && !disabled && (
        <Button size="sm" onClick={check} disabled={!answer.trim()}>정답 확인</Button>
      )}
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── 순서 맞추기 ──────────────────────────────────────────────────────────────
function OrderingQuestion({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const items = q.options || [];
  const [order, setOrder] = useState(() => {
    if (savedAnswer) { try { return JSON.parse(savedAnswer); } catch {} }
    return [...items].sort(() => 0.5 - Math.random());
  });
  const [result, setResult] = useState(savedAnswer != null ? savedCorrect : null);
  const [dragging, setDragging] = useState(null);

  const moveUp = (idx) => {
    if (idx === 0 || result === true || disabled) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
  };
  const moveDown = (idx) => {
    if (idx === order.length - 1 || result === true || disabled) return;
    const next = [...order];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setOrder(next);
  };
  const check = () => {
    const correctOrder = items; // 원본 순서가 정답
    const ok = JSON.stringify(order) === JSON.stringify(correctOrder);
    setResult(ok);
    onSubmit(JSON.stringify(order), ok);
  };
  const retry = () => { setResult(null); setOrder([...items].sort(() => 0.5 - Math.random())); };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">↕ 버튼으로 순서를 맞추세요</p>
      <div className="space-y-1.5">
        {order.map((item, idx) => (
          <div key={item} className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm ${result === true || disabled ? "opacity-70" : "border-gray-200 bg-white"}`}>
            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">{idx + 1}</span>
            <span className="flex-1">{item}</span>
            {!disabled && result !== true && (
              <div className="flex gap-1">
                <button onClick={() => moveUp(idx)} className="text-gray-400 hover:text-gray-700 p-0.5"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveDown(idx)} className="text-gray-400 hover:text-gray-700 p-0.5"><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      {result === null && !disabled && (
        <Button size="sm" onClick={check}>제출하기</Button>
      )}
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── 객관식 ───────────────────────────────────────────────────────────────────
function MultipleChoice({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const [selected, setSelected] = useState(() => {
    if (savedAnswer) return savedAnswer.split(",").map(a => parseInt(a) - 1).filter(n => !isNaN(n));
    return [];
  });
  const [result, setResult] = useState(savedAnswer ? savedCorrect : null);
  const normalType = normalizeType(q.type);
  const isMulti = normalType === "객관식복수" || (q.answer && String(q.answer).includes(","));

  const parseCorrectIdxs = () => {
    const rawAnswer = String(q.answer ?? "");
    if (/^\d+(,\d+)*$/.test(rawAnswer.trim())) {
      return rawAnswer.split(",").map(a => parseInt(a.trim()) - 1).filter(n => !isNaN(n));
    }
    const n = parseInt(rawAnswer);
    return isNaN(n) ? [] : [n];
  };
  const check = (sel) => {
    const correctIdxs = parseCorrectIdxs();
    const ok = JSON.stringify([...sel].sort()) === JSON.stringify([...correctIdxs].sort());
    setResult(ok);
    onSubmit(sel.map(i => i + 1).join(","), ok);
  };
  const retry = () => { setResult(null); setSelected([]); };

  const handleToggle = (idx) => {
    if (result === true || disabled) return;
    if (!isMulti) {
      setSelected([idx]);
      check([idx]);
    } else {
      setSelected(s => s.includes(idx) ? s.filter(x => x !== idx) : [...s, idx]);
    }
  };

  return (
    <div className="space-y-2">
      {isMulti && <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">여러 개를 선택하세요</p>}
      {(q.options || []).map((opt, j) => {
        const isSel = selected.includes(j);
        let style = "border-gray-200 bg-white hover:bg-gray-50";
        if (result === null && isSel) style = "border-blue-400 bg-blue-50";
        if (result !== null && isSel) style = result ? "border-green-400 bg-green-50" : "border-red-300 bg-red-50";
        return (
          <button key={j} onClick={() => handleToggle(j)}
            className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-sm ${style} ${(result === true || disabled) ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
            <span className={`text-lg flex-shrink-0 w-6 ${isSel ? "text-blue-600" : "text-gray-300"}`}>
              {isSel ? (isMulti ? "☑" : "●") : (isMulti ? "☐" : "○")}
            </span>
            <span className="flex-1">{opt}</span>
          </button>
        );
      })}
      {isMulti && result === null && !disabled && (
        <Button size="sm" onClick={() => check(selected)} disabled={!selected.length} className="mt-1">정답 확인</Button>
      )}
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── OX ──────────────────────────────────────────────────────────────────────
function OXQuestion({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const [selected, setSelected] = useState(savedAnswer || null);
  const [result, setResult] = useState(savedAnswer ? savedCorrect : null);
  const correct = (q.answer || "").trim().toUpperCase();

  const check = (val) => {
    if (result === true || disabled) return;
    const ok = val === correct;
    setSelected(val); setResult(ok);
    onSubmit(val, ok);
  };
  const retry = () => { setResult(null); setSelected(null); };

  return (
    <div className="space-y-2">
      <div className="flex gap-4 mt-2">
        {["O", "X"].map(v => {
          let style = "border-gray-200 bg-white hover:bg-gray-50 text-gray-600";
          if (result === null && selected === v) style = "border-blue-400 bg-blue-50 text-blue-700";
          return (
            <button key={v} onClick={() => check(v)}
              className={`flex-1 py-6 rounded-xl border-2 text-4xl font-bold transition-all ${style} ${(result === true || disabled) ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
              {v}
            </button>
          );
        })}
      </div>
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── 빈칸채우기 ───────────────────────────────────────────────────────────────
function FillBlank({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const [answer, setAnswer] = useState(savedAnswer || "");
  const [result, setResult] = useState(savedAnswer ? savedCorrect : null);

  const check = () => {
    const ok = answer.trim().toLowerCase() === (q.answer || "").trim().toLowerCase();
    setResult(ok);
    onSubmit(answer, ok);
  };
  const retry = () => { setResult(null); setAnswer(""); };

  return (
    <div className="space-y-2">
      <input value={answer}
        onChange={e => { if (result !== true) setAnswer(e.target.value); }}
        onKeyDown={e => { if (e.key === "Enter" && result === null) check(); }}
        placeholder="답을 입력하세요..." disabled={result === true || disabled}
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-400 disabled:opacity-60 bg-white" />
      {result === null && !disabled && (
        <Button size="sm" onClick={check} disabled={!answer.trim()}>정답 확인</Button>
      )}
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── 짝맞추기 ─────────────────────────────────────────────────────────────────
function MatchingQuestion({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const pairs = (() => {
    if (q.pairs && q.pairs.length > 0) return q.pairs;
    return (q.options || []).map(opt => {
      const parts = opt.split("→").map(s => s.trim());
      return { left: parts[0] || opt, right: parts[1] || "" };
    });
  })();

  const [shuffledRight] = useState(() => [...pairs.map(p => p.right)].sort(() => 0.5 - Math.random()));
  const [connections, setConnections] = useState(() => {
    if (savedAnswer) {
      try { return JSON.parse(savedAnswer); } catch {
        const arr = savedAnswer.split(",");
        const obj = {};
        arr.forEach((r, i) => { if (r) obj[i] = r; });
        return obj;
      }
    }
    return {};
  });
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [result, setResult] = useState(savedAnswer ? savedCorrect : null);

  const getConnectedLeft = (rightItem) => {
    for (const [li, ri] of Object.entries(connections)) {
      if (ri === rightItem) return parseInt(li);
    }
    return null;
  };

  const handleLeftClick = (idx) => {
    if (result === true || disabled) return;
    setSelectedLeft(prev => prev === idx ? null : idx);
  };

  const handleRightClick = (rightItem) => {
    if (result === true || disabled || selectedLeft === null) return;
    setConnections(prev => {
      const next = { ...prev };
      const prevLeft = getConnectedLeft(rightItem);
      if (prevLeft !== null) delete next[prevLeft];
      next[selectedLeft] = rightItem;
      return next;
    });
    setSelectedLeft(null);
  };

  const check = () => {
    const ok = pairs.every((p, i) => connections[i] === p.right);
    setResult(ok);
    onSubmit(JSON.stringify(connections), ok);
  };
  const retry = () => { setResult(null); setConnections({}); setSelectedLeft(null); };
  const allConnected = pairs.length > 0 && pairs.every((_, i) => connections[i]);

  const COLORS = [
    "bg-blue-100 border-blue-400 text-blue-800",
    "bg-purple-100 border-purple-400 text-purple-800",
    "bg-green-100 border-green-400 text-green-800",
    "bg-orange-100 border-orange-400 text-orange-800",
    "bg-pink-100 border-pink-400 text-pink-800",
    "bg-teal-100 border-teal-400 text-teal-800",
  ];
  const colorMap = {};
  Object.keys(connections).forEach((li, idx) => { colorMap[li] = idx % COLORS.length; });

  return (
    <div className="space-y-3">
      {selectedLeft !== null && (
        <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <strong>"{pairs[selectedLeft]?.left}"</strong> 선택됨 — 오른쪽에서 짝을 클릭하세요
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium text-center">항목</p>
          {pairs.map((pair, i) => {
            const isSelected = selectedLeft === i;
            const isConnected = connections[i] !== undefined;
            const colorIdx = colorMap[i];
            let cls = "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50";
            if (isSelected) cls = "border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-300";
            else if (isConnected) cls = COLORS[colorIdx] || COLORS[0];
            return (
              <button key={i} onClick={() => handleLeftClick(i)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${cls} ${(result === true || disabled) ? "cursor-default" : "cursor-pointer"}`}>
                {pair.left}
                {isConnected && <span className="block text-xs opacity-70 mt-0.5">→ {connections[i]}</span>}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium text-center">정답 (클릭)</p>
          {shuffledRight.map((rightItem, j) => {
            const connLeftIdx = getConnectedLeft(rightItem);
            const isConnected = connLeftIdx !== null;
            const colorIdx = isConnected ? colorMap[connLeftIdx] : null;
            const isTarget = selectedLeft !== null;
            let cls = "border-gray-200 bg-white text-gray-700";
            if (isConnected) cls = COLORS[colorIdx] || COLORS[0];
            else if (isTarget) cls = "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 cursor-pointer";
            return (
              <button key={j} onClick={() => handleRightClick(rightItem)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${cls} ${(result === true || disabled) ? "cursor-default" : ""}`}>
                {rightItem}
              </button>
            );
          })}
        </div>
      </div>
      {result === null && !disabled && (
        <Button size="sm" onClick={check} disabled={!allConnected}>제출하기</Button>
      )}
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── 코드 빈칸채우기 ──────────────────────────────────────────────────────────
function CodeFillBlank({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const parts = (q.question || "").split("____");
  const blankCount = parts.length - 1;
  const answers = (q.answer || "").split(",").map(a => a.trim());
  const [inputs, setInputs] = useState(() => {
    if (savedAnswer) return savedAnswer.split(",");
    return Array(blankCount).fill("");
  });
  const [result, setResult] = useState(savedAnswer ? savedCorrect : null);

  const check = () => {
    const ok = inputs.every((inp, i) => inp.trim().toLowerCase() === (answers[i] || "").toLowerCase());
    setResult(ok);
    onSubmit(inputs.join(","), ok);
  };
  const retry = () => { setResult(null); setInputs(Array(blankCount).fill("")); };

  return (
    <div className="space-y-3">
      <div className="bg-gray-900 text-green-300 rounded-xl p-4 font-mono text-sm leading-7">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span>{part}</span>
            {i < blankCount && (
              <input value={inputs[i]}
                onChange={e => { if (result !== true) setInputs(inp => { const n = [...inp]; n[i] = e.target.value; return n; }); }}
                className={`inline-block border-b-2 bg-transparent text-yellow-300 outline-none font-mono mx-1 text-sm min-w-16 text-center ${result !== null ? (inputs[i].trim().toLowerCase() === (answers[i] || "").toLowerCase() ? "border-green-400" : "border-yellow-400") : "border-yellow-400"}`}
                placeholder="______" size={Math.max(8, (answers[i] || "").length + 2)} disabled={result === true || disabled} />
            )}
          </React.Fragment>
        ))}
      </div>
      {result === null && !disabled && (
        <Button size="sm" onClick={check} disabled={inputs.some(i => !i.trim())}>정답 확인</Button>
      )}
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── 코드 결과 예측 ───────────────────────────────────────────────────────────
function CodeResultPredict({ q, onSubmit, disabled, savedAnswer, savedCorrect }) {
  const items = q.code_items || [];
  const [inputs, setInputs] = useState(() => {
    if (savedAnswer) { try { return JSON.parse(savedAnswer); } catch { return Array(items.length).fill(""); } }
    return Array(items.length).fill("");
  });
  const [result, setResult] = useState(savedAnswer ? savedCorrect : null);

  const setInput = (idx, val) => {
    if (result === true || disabled) return;
    setInputs(prev => { const n = [...prev]; n[idx] = val; return n; });
  };
  const check = () => {
    const ok = items.every((item, i) => (inputs[i] || "").trim() === (item.expected_output || "").trim());
    setResult(ok);
    onSubmit(JSON.stringify(inputs), ok);
  };
  const retry = () => { setResult(null); setInputs(Array(items.length).fill("")); };
  const allFilled = inputs.every(v => (v || "").trim() !== "");

  if (items.length === 0) return <p className="text-xs text-gray-400">코드 블록이 없습니다.</p>;

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-800 px-3 py-1.5 text-xs text-gray-400 font-mono border-b border-gray-700">코드 {i + 1}</div>
          <pre className="bg-gray-900 text-green-300 p-4 font-mono text-sm leading-6 overflow-auto select-none" onCopy={e => e.preventDefault()}>{item.code}</pre>
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <label className="text-xs text-gray-500 font-medium block mb-1">예상 결과 입력</label>
            <textarea value={inputs[i] || ""} onChange={e => setInput(i, e.target.value)} placeholder={"실행 결과를 입력하세요..."}
              disabled={result === true || disabled}
              rows={Math.max(2, ((item.expected_output || "").match(/\n/g) || []).length + 1)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-none disabled:opacity-60" />
          </div>
        </div>
      ))}
      {result === null && !disabled && <Button size="sm" onClick={check} disabled={!allFilled}>정답 제출</Button>}
      {result !== null && <ResultMsg isCorrect={result} onRetry={result === false ? retry : null} />}
    </div>
  );
}

// ─── 주관식 ──────────────────────────────────────────────────────────────────
function SubjectiveQuestion({ q, onSubmit, disabled, savedAnswer }) {
  const [answer, setAnswer] = useState(savedAnswer || "");
  const [submitted, setSubmitted] = useState(!!savedAnswer);

  const handleSubmit = () => {
    if (!answer.trim()) return;
    setSubmitted(true);
    onSubmit(answer, null);
  };

  return (
    <div className="space-y-2">
      <Textarea value={answer} onChange={e => { if (!submitted) setAnswer(e.target.value); }}
        placeholder="답변을 입력하세요..." disabled={submitted || disabled} className="h-28 text-sm resize-none" />
      {!submitted && !disabled && <Button size="sm" onClick={handleSubmit} disabled={!answer.trim()}>제출하기</Button>}
      {submitted && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          <Clock className="w-4 h-4" /><span className="font-medium">제출 완료 — 선생님 확인 대기 중</span>
        </div>
      )}
    </div>
  );
}

// ─── 타입 뱃지 라벨 ───────────────────────────────────────────────────────────
const TYPE_LABELS = {
  "객관식": "객관식", "객관식단일": "객관식", "multiple_choice": "객관식",
  "객관식복수": "복수선택", "multiple_select": "복수선택",
  "OX": "O/X", "ox": "O/X",
  "빈칸채우기": "단답형", "short_answer": "단답형", "fill_blank": "단답형",
  "짝맞추기": "짝맞추기", "matching": "짝맞추기",
  "코드빈칸채우기": "코드빈칸",
  "코드결과예측": "코드예측", "code_output": "코드예측",
  "순서맞추기": "순서맞추기", "ordering": "순서맞추기",
  "주관식": "주관식",
};
const TYPE_COLORS = {
  "객관식": "bg-blue-100 text-blue-700", "객관식복수": "bg-purple-100 text-purple-700",
  "복수선택": "bg-purple-100 text-purple-700",
  "OX": "bg-orange-100 text-orange-700", "단답형": "bg-green-100 text-green-700",
  "짝맞추기": "bg-teal-100 text-teal-700", "코드빈칸": "bg-gray-100 text-gray-700",
  "코드예측": "bg-yellow-100 text-yellow-700", "순서맞추기": "bg-pink-100 text-pink-700",
  "주관식": "bg-amber-100 text-amber-700",
};
const DIFFICULTY_LABELS = { easy: "쉬움", medium: "보통", hard: "어려움" };
const DIFFICULTY_COLORS = { easy: "bg-green-50 text-green-600", medium: "bg-yellow-50 text-yellow-600", hard: "bg-red-50 text-red-600" };

// ─── Main QuestionPanel ───────────────────────────────────────────────────────
export default function QuestionPanel({ questions = [], user, unitId, unitTitle, progress, onProgressUpdate, unitType }) {
  const [submitted, setSubmitted] = useState(() => loadSaved(unitId));
  const [openIdx, setOpenIdx] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [saveError, setSaveError] = useState(null);
  // 서버 진도와 현재 화면에서 정답 처리한 결과를 함께 반영합니다.
  // 저장된 ID는 숫자/문자열 형태 모두 허용합니다.
  const completedIds = (Array.isArray(progress?.completed_question_ids)
    ? progress.completed_question_ids : []).map(Number).filter(Number.isFinite);
  const isQuestionCompleted = (i) =>
    completedIds.includes(i) || submitted[i]?.isCorrect === true;

  const getSid = () => user?.student_id;
  const toggle = (i) => setOpenIdx(prev => prev === i ? null : i);

  const handleSubmit = async (qIdx, qNum, qType, answer, isCorrect) => {
    // 1. 정답 판정 UI 먼저 표시 (DB 저장 실패와 무관하게 화면에 결과 표시)
    const newState = { answer, isCorrect, done: true, submittedAt: new Date().toISOString() };
    const next = { ...submitted, [qIdx]: newState };
    setSubmitted(next);
    saveToDisk(unitId, next);
    setSaveError(null);

    // 주관식이거나 오답이거나 이미 완료된 문제는 DB 저장하지 않음
    if (isCorrect === null || !isCorrect || isQuestionCompleted(qIdx)) return;

    // 세션 토큰 사전 확인 — 없으면 401이 아니라 명확한 메시지
    if (!getSessionToken()) {
      setSaveError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      return;
    }

    // 2. Progress / Submission 저장 (정답 판정과 분리 — 실패해도 UI 결과는 유지)
    const newCompleted = [...new Set([...completedIds, ...Object.keys(next).filter(k => next[k]?.isCorrect === true).map(Number)])];
    const total = questions.length;
    const rate = total > 0 ? (newCompleted.length / total) * 100 : 0;
    const sid = getSid();

    if (sid) {
      // 단일 RPC로 submission + progress를 한 트랜잭션에 저장
      try {
        await saveQuestionResult(sid, unitId, qNum, {
          answer,
          is_correct: true,
          question_type: qType,
        }, { studentName: user?.name || "", unitTitle: unitTitle || "", unitType }, {
          completed_question_ids: newCompleted,
          current_question_index: newCompleted.length,
          question_progress_rate: rate,
          last_studied_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[QuestionPanel] saveQuestionResult RPC 실패:", {
          errorMessage: err?.message,
          studentId: sid,
          unitId, questionNumber: qNum,
          itemType: "question",
          hasSessionToken: !!getSessionToken(),
        });
        const isMismatch = (err?.message || "").includes("일치하지 않습니다");
        setSaveError(isMismatch
          ? "학생 계정 연결 정보가 일치하지 않습니다."
          : "문제 결과 저장 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    }

    setOpenIdx(null);
    if (onProgressUpdate) onProgressUpdate();
  };

  // 타입 정규화 후 컴포넌트 선택
  const renderQuestion = (q, i, state, isCompleted) => {
    const nt = normalizeType(q.type);
    const props = {
      q, disabled: isCompleted,
      savedAnswer: state?.answer, savedCorrect: state?.isCorrect,
      onSubmit: (ans, ok) => handleSubmit(i, q.number || i + 1, q.type, ans, ok),
    };
    if (nt === "객관식" || nt === "객관식복수") return <MultipleChoice {...props} />;
    if (nt === "OX") return <OXQuestion {...props} />;
    if (nt === "빈칸채우기") return <ShortAnswer {...props} />;
    if (nt === "짝맞추기") return <MatchingQuestion {...props} />;
    if (nt === "코드빈칸채우기") return <CodeFillBlank {...props} />;
    if (nt === "코드결과예측") return <CodeResultPredict {...props} />;
    if (nt === "순서맞추기") return <OrderingQuestion {...props} />;
    // code_output 타입 (단일 코드 결과 예측)
    if (q.type === "code_output" || (q.code && !q.code_items)) return <CodeOutput {...props} />;
    if (nt === "주관식") return <SubjectiveQuestion {...props} savedAnswer={state?.answer} />;
    // 기존 한글 타입 fallback
    if (q.type === "빈칸채우기") return <FillBlank {...props} />;
    return null;
  };

  if (!questions.length) {
    return <p className="text-gray-400 text-sm text-center py-8">Question이 없습니다.</p>;
  }

  const completedCount = questions.filter((_, i) => isQuestionCompleted(i)).length;
  const totalCount = questions.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500">정답 {completedCount}/{totalCount}개 완료</p>
        <button onClick={() => setShowCompleted(s => !s)}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition-colors hover:bg-gray-50">
          <ChevronsUpDown className="w-3 h-3" />
          {showCompleted ? "완료 항목 숨기기" : "완료 항목 보기"}
        </button>
      </div>

      {saveError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-auto text-amber-500 hover:text-amber-700">✕</button>
        </div>
      )}

      {questions.map((q, i) => {
        const qNum = q.number || i + 1;
        const nt = normalizeType(q.type);
        const isCompleted = isQuestionCompleted(i);
        const state = submitted[i];
        const isPending = nt === "주관식" && state?.isCorrect === null && state?.done;
        const isWrong = state?.isCorrect === false;
        const isOpen = openIdx === i;

        if (isCompleted && !showCompleted) return null;

        const typeLabel = TYPE_LABELS[q.type] || TYPE_LABELS[nt] || q.type;
        const typeColor = TYPE_COLORS[typeLabel] || "bg-gray-100 text-gray-700";
        const diffLabel = DIFFICULTY_LABELS[q.difficulty];
        const diffColor = DIFFICULTY_COLORS[q.difficulty];

        const StatusIcon = () => {
          if (isCompleted) return <span className="text-base leading-none">✅</span>;
          if (isPending) return <span className="text-base leading-none">🟡</span>;
          if (isWrong) return <span className="text-base leading-none">❌</span>;
          return <span className="text-gray-300"><Circle className="w-4 h-4" /></span>;
        };

        const borderColor = isCompleted ? "border-green-300" : isPending ? "border-amber-300" : isWrong ? "border-red-200" : isOpen ? "border-blue-300" : "border-gray-200";
        const headerBg = isOpen
          ? (isCompleted ? "bg-green-50" : "bg-blue-50")
          : (isCompleted ? "bg-green-50/50 hover:bg-green-50" : "bg-gray-50 hover:bg-gray-100");

        return (
          <div key={i}
            className={`border-2 rounded-2xl overflow-hidden transition-all duration-200 ${borderColor} ${isOpen ? "shadow-md" : "shadow-sm"}`}>
            <div
              className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${headerBg}`}
              onClick={() => toggle(i)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <StatusIcon />
                <span className={`font-bold text-sm flex-shrink-0 ${isCompleted ? "text-green-700" : isOpen ? "text-blue-700" : "text-gray-800"}`}>
                  Q{String(qNum).padStart(2, "0")}.
                </span>
                {typeLabel && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColor}`}>{typeLabel}</span>
                )}
                {diffLabel && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${diffColor}`}>{diffLabel}</span>
                )}
                {!isOpen && q.question && (
                  <span className="text-sm text-gray-500 truncate hidden sm:block">
                    {q.question.slice(0, 36)}{q.question.length > 36 ? "…" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {isCompleted && <span className="text-xs text-green-600 font-semibold hidden sm:inline">완료</span>}
                {isPending && <span className="text-xs text-amber-600 font-semibold hidden sm:inline">대기중</span>}
                {isWrong && <span className="text-xs text-red-500 font-semibold hidden sm:inline">재도전</span>}
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            <Collapsible open={isOpen}>
              <div className="p-5 sm:p-6 space-y-4 border-t border-gray-100 bg-white">
                {/* 문제 텍스트 */}
                {q.question && (() => {
                  const displayQ = q.question;
                  const codeMatch = displayQ.match(/```[\s\S]*?```/);
                  if (codeMatch) {
                    const code = codeMatch[0].replace(/```python\n?|```/g, "");
                    const before = displayQ.substring(0, displayQ.indexOf(codeMatch[0]));
                    const after = displayQ.substring(displayQ.indexOf(codeMatch[0]) + codeMatch[0].length);
                    return (<>
                      {before && <p className="text-sm text-gray-800 whitespace-pre-wrap font-medium">{before}</p>}
                      <pre className="bg-gray-900 text-green-300 rounded-xl p-4 text-sm font-mono overflow-auto select-none" onCopy={e => e.preventDefault()}>{code}</pre>
                      {after && <p className="text-sm text-gray-800 whitespace-pre-wrap">{after}</p>}
                    </>);
                  }
                  return <p className="text-sm text-gray-800 whitespace-pre-wrap font-medium">{displayQ}</p>;
                })()}

                {/* 유형별 입력 */}
                {renderQuestion(q, i, state, isCompleted)}

                {/* 해설 */}
                {isCompleted && q.explanation && (
                  <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
                    <span className="font-bold">해설:</span> {q.explanation}
                  </div>
                )}
              </div>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}