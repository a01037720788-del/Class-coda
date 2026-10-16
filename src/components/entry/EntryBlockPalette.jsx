import React, { useState } from "react";

// 카테고리 정의
export const CATEGORIES = [
  { id: "start", label: "시작", color: "#ff9800", bgColor: "#fff3e0" },
  { id: "flow", label: "흐름", color: "#ff5722", bgColor: "#fbe9e7" },
  { id: "motion", label: "움직임", color: "#2196f3", bgColor: "#e3f2fd" },
  { id: "looks", label: "생김새", color: "#9c27b0", bgColor: "#f3e5f5" },
  { id: "sound", label: "소리", color: "#e91e63", bgColor: "#fce4ec" },
  { id: "judge", label: "판단", color: "#4caf50", bgColor: "#e8f5e9" },
  { id: "calc", label: "계산", color: "#00bcd4", bgColor: "#e0f7fa" },
  { id: "data", label: "자료", color: "#ff6f00", bgColor: "#fff8e1" },
  { id: "func", label: "함수", color: "#795548", bgColor: "#efebe9" },
];

// 블록 정의
export const BLOCK_DEFS = {
  start: [
    { type: "on_start", label: "시작하기 버튼을 클릭했을 때", hat: true, color: "#ff9800" },
    { type: "on_key_right", label: "오른쪽 방향키를 눌렀을 때", hat: true, color: "#ff9800" },
    { type: "on_key_left", label: "왼쪽 방향키를 눌렀을 때", hat: true, color: "#ff9800" },
    { type: "on_key_up", label: "위쪽 방향키를 눌렀을 때", hat: true, color: "#ff9800" },
    { type: "on_key_down", label: "아래쪽 방향키를 눌렀을 때", hat: true, color: "#ff9800" },
    { type: "on_key_space", label: "스페이스 키를 눌렀을 때", hat: true, color: "#ff9800" },
    { type: "on_click", label: "이 오브젝트를 클릭했을 때", hat: true, color: "#ff9800" },
  ],
  flow: [
    { type: "wait", label: "1 초 기다리기", color: "#ff5722", params: [{ key: "sec", type: "number", default: 1 }] },
    { type: "repeat", label: "10 번 반복하기", color: "#ff5722", params: [{ key: "count", type: "number", default: 10 }], hasBody: true },
    { type: "forever", label: "계속 반복하기", color: "#ff5722", hasBody: true },
    { type: "if", label: "만약 ~ 이라면", color: "#ff5722", hasCondition: true, hasBody: true },
    { type: "if_else", label: "만약 ~ 이라면 / 아니면", color: "#ff5722", hasCondition: true, hasBody: true, hasElse: true },
    { type: "stop_all", label: "모두 멈추기", color: "#ff5722" },
    { type: "stop_this", label: "이 오브젝트 멈추기", color: "#ff5722" },
  ],
  motion: [
    { type: "move_right", label: "오른쪽으로 10 만큼 움직이기", color: "#2196f3", params: [{ key: "amount", type: "number", default: 10 }] },
    { type: "move_left", label: "왼쪽으로 10 만큼 움직이기", color: "#2196f3", params: [{ key: "amount", type: "number", default: 10 }] },
    { type: "move_up", label: "위로 10 만큼 움직이기", color: "#2196f3", params: [{ key: "amount", type: "number", default: 10 }] },
    { type: "move_down", label: "아래로 10 만큼 움직이기", color: "#2196f3", params: [{ key: "amount", type: "number", default: 10 }] },
    { type: "set_x", label: "x 좌표를 0 으로 정하기", color: "#2196f3", params: [{ key: "x", type: "number", default: 0 }] },
    { type: "set_y", label: "y 좌표를 0 으로 정하기", color: "#2196f3", params: [{ key: "y", type: "number", default: 0 }] },
    { type: "set_direction", label: "방향을 90 도로 정하기", color: "#2196f3", params: [{ key: "dir", type: "number", default: 90 }] },
    { type: "move_to_xy", label: "1 초 동안 x: 0 y: 0 위치로 이동", color: "#2196f3", params: [{ key: "sec", type: "number", default: 1 }, { key: "x", type: "number", default: 0 }, { key: "y", type: "number", default: 0 }] },
  ],
  looks: [
    { type: "say", label: "안녕! 말하기", color: "#9c27b0", params: [{ key: "text", type: "string", default: "안녕!" }] },
    { type: "say_for", label: "2 초 동안 안녕! 말하기", color: "#9c27b0", params: [{ key: "sec", type: "number", default: 2 }, { key: "text", type: "string", default: "안녕!" }] },
    { type: "show", label: "보이기", color: "#9c27b0" },
    { type: "hide", label: "숨기기", color: "#9c27b0" },
    { type: "change_size", label: "크기를 10 만큼 바꾸기", color: "#9c27b0", params: [{ key: "amount", type: "number", default: 10 }] },
    { type: "set_size", label: "크기를 100 % 으로 정하기", color: "#9c27b0", params: [{ key: "size", type: "number", default: 100 }] },
  ],
  sound: [
    { type: "play_sound", label: "효과음 재생 (삑!)", color: "#e91e63" },
  ],
  judge: [
    { type: "eq", label: "~ 와 ~ 가 같다", color: "#4caf50", isValue: true, params: [{ key: "a", type: "number", default: 0 }, { key: "b", type: "number", default: 0 }] },
    { type: "gt", label: "~ 보다 크다", color: "#4caf50", isValue: true, params: [{ key: "a", type: "number", default: 0 }, { key: "b", type: "number", default: 0 }] },
    { type: "lt", label: "~ 보다 작다", color: "#4caf50", isValue: true, params: [{ key: "a", type: "number", default: 0 }, { key: "b", type: "number", default: 0 }] },
    { type: "and", label: "~ 그리고 ~", color: "#4caf50", isValue: true },
    { type: "or", label: "~ 또는 ~", color: "#4caf50", isValue: true },
    { type: "not", label: "~ 아니다", color: "#4caf50", isValue: true },
  ],
  calc: [
    { type: "add", label: "~ + ~", color: "#00bcd4", isValue: true, params: [{ key: "a", type: "number", default: 0 }, { key: "b", type: "number", default: 0 }] },
    { type: "sub", label: "~ - ~", color: "#00bcd4", isValue: true, params: [{ key: "a", type: "number", default: 0 }, { key: "b", type: "number", default: 0 }] },
    { type: "mul", label: "~ × ~", color: "#00bcd4", isValue: true, params: [{ key: "a", type: "number", default: 0 }, { key: "b", type: "number", default: 0 }] },
    { type: "div", label: "~ ÷ ~", color: "#00bcd4", isValue: true, params: [{ key: "a", type: "number", default: 0 }, { key: "b", type: "number", default: 1 }] },
    { type: "random", label: "1 부터 10 사이의 무작위 수", color: "#00bcd4", isValue: true, params: [{ key: "min", type: "number", default: 1 }, { key: "max", type: "number", default: 10 }] },
  ],
  data: [
    { type: "set_var", label: "변수 를 0 으로 정하기", color: "#ff6f00", params: [{ key: "name", type: "string", default: "변수" }, { key: "value", type: "number", default: 0 }] },
    { type: "change_var", label: "변수 를 1 만큼 바꾸기", color: "#ff6f00", params: [{ key: "name", type: "string", default: "변수" }, { key: "amount", type: "number", default: 1 }] },
    { type: "get_var", label: "변수", color: "#ff6f00", isValue: true, params: [{ key: "name", type: "string", default: "변수" }] },
  ],
  func: [
    { type: "define_func", label: "함수 정의", color: "#795548", hat: true, params: [{ key: "name", type: "string", default: "나의함수" }], hasBody: true },
    { type: "call_func", label: "함수 호출", color: "#795548", params: [{ key: "name", type: "string", default: "나의함수" }] },
  ],
};

// 팔레트에 보여주는 블록 컴포넌트
function PaletteBlock({ block, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        // params 초기값 객체 생성
        const initParams = {};
        (block.params || []).forEach(p => { initParams[p.key] = p.default; });
        e.dataTransfer.setData("block", JSON.stringify({
          ...block,
          id: Date.now() + Math.random(),
          params: initParams,
          children: [],
          elseChildren: [],
        }));
      }}
      className="select-none cursor-grab active:cursor-grabbing rounded-lg px-3 py-2 text-white text-xs font-medium mb-1.5 shadow-sm hover:brightness-110 transition-all"
      style={{ backgroundColor: block.color, userSelect: "none" }}
    >
      {block.hat && <span className="mr-1">▶</span>}
      {block.label}
    </div>
  );
}

export default function EntryBlockPalette({ onAddBlock }) {
  const [activeCat, setActiveCat] = useState("start");

  const blocks = BLOCK_DEFS[activeCat] || [];

  return (
    <div className="flex h-full bg-gray-50 border-r border-gray-200" style={{ minWidth: 0 }}>
      {/* 카테고리 사이드바 */}
      <div className="flex flex-col w-16 bg-white border-r border-gray-100 py-2 overflow-y-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className="flex flex-col items-center justify-center py-3 px-1 text-[10px] font-bold transition-all"
            style={{
              color: activeCat === cat.id ? cat.color : "#888",
              backgroundColor: activeCat === cat.id ? cat.bgColor : "transparent",
              borderLeft: activeCat === cat.id ? `3px solid ${cat.color}` : "3px solid transparent",
            }}
          >
            <span className="text-base mb-0.5">
              {cat.id === "start" ? "🚀" : cat.id === "flow" ? "🔄" : cat.id === "motion" ? "➡️" :
               cat.id === "looks" ? "👁️" : cat.id === "sound" ? "🔊" : cat.id === "judge" ? "⚖️" :
               cat.id === "calc" ? "🔢" : cat.id === "data" ? "📦" : "🔧"}
            </span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* 블록 목록 */}
      <div className="flex-1 p-2 overflow-y-auto" style={{ minWidth: 120, maxWidth: 180 }}>
        <div className="text-xs font-bold text-gray-500 mb-2 mt-1">{CATEGORIES.find(c => c.id === activeCat)?.label}</div>
        {blocks.map((block, i) => (
          <PaletteBlock key={i} block={block} />
        ))}
      </div>
    </div>
  );
}