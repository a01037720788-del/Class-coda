import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from "lucide-react";
import { getSimulationSteps, ALGORITHM_LABELS } from "@/lib/algorithmSimulators";

export default function AlgorithmSimulator({ config }) {
  const [steps, setSteps] = useState([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!config?.enabled) { setSteps([]); return; }
    const s = getSimulationSteps(config);
    setSteps(s);
    setCurrent(0);
    setPlaying(false);
  }, [config]);

  useEffect(() => {
    if (playing && current < steps.length - 1) {
      timerRef.current = setTimeout(() => setCurrent(c => c + 1), config?.auto_speed || 1000);
    } else if (current >= steps.length - 1) {
      setPlaying(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [playing, current, steps.length, config?.auto_speed]);

  if (!config?.enabled) return null;
  if (steps.length === 0) return <div className="text-sm text-gray-400">시뮬레이터 준비 중...</div>;

  const step = steps[current];
  const isLast = current >= steps.length - 1;

  const isGraph = config.algorithm_type === "dfs" || config.algorithm_type === "bfs";
  const isStackQueue = config.algorithm_type === "stack" || config.algorithm_type === "queue";
  const isGreedy = config.algorithm_type === "greedy";

  return (
    <div className="border-2 border-violet-200 rounded-xl overflow-hidden bg-white">
      <div className="bg-violet-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4" />
          <span className="font-semibold text-sm">알고리즘 시뮬레이터 — {ALGORITHM_LABELS[config.algorithm_type]}</span>
        </div>
        {config.description && <span className="text-xs opacity-80">{config.description}</span>}
      </div>

      <div className="p-4 space-y-4">
        {/* 배열 기반 시각화 */}
        {!isGraph && !isStackQueue && !isGreedy && step.array && (
          <div className="flex items-end gap-2 justify-center flex-wrap">
            {step.array.map((val, i) => {
              const isHighlight = step.highlight?.includes(i);
              const isFound = step.found && step.foundIndex === i;
              const inRange = step.range && i >= step.range[0] && i <= step.range[1];
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm border-2 transition-all
                    ${isFound ? "bg-green-500 text-white border-green-600 scale-110"
                      : isHighlight && step.comparing ? "bg-amber-400 text-white border-amber-500"
                      : isHighlight ? "bg-violet-500 text-white border-violet-600"
                      : inRange ? "bg-violet-50 text-violet-700 border-violet-200"
                      : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {val}
                  </div>
                  <span className="text-[10px] text-gray-400">{i}</span>
                  {step.pointers?.left === i && <span className="text-[10px] text-blue-600 font-bold">L</span>}
                  {step.pointers?.right === i && <span className="text-[10px] text-red-600 font-bold">R</span>}
                  {step.pointers?.mid === i && <span className="text-[10px] text-violet-600 font-bold">M</span>}
                  {step.pointers?.i === i && <span className="text-[10px] text-violet-600 font-bold">i</span>}
                  {step.pointers?.minIdx === i && <span className="text-[10px] text-amber-600 font-bold">min</span>}
                  {step.pointers?.j === i && <span className="text-[10px] text-blue-600 font-bold">j</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* 누적합 */}
        {config.algorithm_type === "prefix_sum" && step.prefix && (
          <div className="space-y-2">
            <div className="flex gap-2 justify-center flex-wrap">
              {step.array?.map((val, i) => (
                <div key={i} className={`w-10 h-10 rounded flex items-center justify-center text-xs font-bold border ${step.highlight?.includes(i) ? "bg-violet-500 text-white border-violet-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{val}</div>
              ))}
            </div>
            <div className="text-center text-xs text-gray-400">↓ 누적합</div>
            <div className="flex gap-2 justify-center flex-wrap">
              {step.prefix.map((val, i) => (
                <div key={i} className="w-12 h-10 rounded flex items-center justify-center text-xs font-bold bg-violet-100 text-violet-700 border border-violet-200">{val}</div>
              ))}
            </div>
          </div>
        )}

        {/* 그래프 (DFS/BFS) */}
        {isGraph && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 justify-center">
              {(config.graph_nodes || []).map(node => {
                const isVisited = step.visited?.includes(node);
                const isCurrent = step.currentNode === node;
                return (
                  <div key={node} className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all
                    ${isCurrent ? "bg-violet-500 text-white border-violet-600 scale-110"
                      : isVisited ? "bg-green-100 text-green-700 border-green-300"
                      : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                    {node}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">방문 완료: </span>
                <span className="font-bold text-green-700">{(step.visited || []).join(", ") || "없음"}</span>
              </div>
              <div className="bg-gray-50 rounded p-2">
                {config.algorithm_type === "dfs" ? (
                  <><span className="text-gray-500">스택: </span><span className="font-bold text-violet-700">{(step.stack || []).join(", ") || "비음"}</span></>
                ) : (
                  <><span className="text-gray-500">큐: </span><span className="font-bold text-violet-700">{(step.queue || []).join(", ") || "비음"}</span></>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 스택/큐 */}
        {isStackQueue && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-gray-500">{config.algorithm_type === "stack" ? "스택 (top ↑)" : "큐 (front ↓)"}</div>
            <div className="flex flex-col-reverse gap-1 min-h-[60px]">
              {(step.stack || step.queue || []).map((v, i) => (
                <div key={i} className="px-6 py-2 bg-violet-100 text-violet-700 border border-violet-300 rounded font-bold text-sm text-center">
                  {v}
                </div>
              ))}
              {(step.stack || step.queue || []).length === 0 && <div className="text-gray-300 text-sm">비어있음</div>}
            </div>
          </div>
        )}

        {/* 그리디 */}
        {isGreedy && (
          <div className="space-y-2">
            <div className="text-center text-sm">거스름 금액: <span className="font-bold text-violet-700">{step.amount}원</span></div>
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.entries(step.result || {}).map(([coin, count]) => (
                <div key={coin} className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">{coin}원 × {count}</div>
              ))}
            </div>
          </div>
        )}

        {/* 설명 */}
        <div className={`rounded-lg p-3 text-sm ${step.done && step.found ? "bg-green-50 text-green-700" : step.done ? "bg-gray-50 text-gray-600" : "bg-violet-50 text-violet-800"}`}>
          <span className="font-semibold">단계 {current + 1}/{steps.length}: </span>
          {step.description}
        </div>

        {/* 컨트롤 */}
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setCurrent(0); }} disabled={current === 0}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setCurrent(c => Math.max(0, c - 1)); }} disabled={current === 0}>
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={() => setPlaying(!playing)} disabled={isLast} className="bg-violet-600 hover:bg-violet-700">
            {playing ? <><Pause className="w-3.5 h-3.5 mr-1" />일시정지</> : <><Play className="w-3.5 h-3.5 mr-1" />재생</>}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setCurrent(c => Math.min(steps.length - 1, c + 1)); }} disabled={isLast}>
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}