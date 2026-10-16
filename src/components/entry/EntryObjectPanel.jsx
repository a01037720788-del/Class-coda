import React, { useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { OBJECT_EMOJIS, BACKGROUNDS } from "./EntryStage";

const OBJECT_TYPES = [
  { type: "cat", label: "고양이", emoji: "🐱" },
  { type: "dog", label: "강아지", emoji: "🐶" },
  { type: "robot", label: "로봇", emoji: "🤖" },
  { type: "ball", label: "공", emoji: "⚽" },
  { type: "car", label: "자동차", emoji: "🚗" },
];

export default function EntryObjectPanel({
  objects, selectedObjectId, onSelectObject,
  onAddObject, onDeleteObject, onUpdateObject,
  background, onChangeBackground,
}) {
  const [tab, setTab] = useState("objects"); // "objects" | "background"
  const [showPicker, setShowPicker] = useState(false);

  const selectedObj = objects.find(o => o.id === selectedObjectId);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200" style={{ width: 180, minWidth: 160 }}>
      {/* 탭 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab("objects")}
          className={`flex-1 py-2 text-xs font-bold transition-colors ${tab === "objects" ? "text-green-600 border-b-2 border-green-500" : "text-gray-400 hover:text-gray-600"}`}
        >오브젝트</button>
        <button
          onClick={() => setTab("background")}
          className={`flex-1 py-2 text-xs font-bold transition-colors ${tab === "background" ? "text-green-600 border-b-2 border-green-500" : "text-gray-400 hover:text-gray-600"}`}
        >배경</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "objects" && (
          <div className="p-2">
            {/* 오브젝트 추가 버튼 */}
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-dashed border-green-300 text-green-600 text-xs font-bold hover:bg-green-50 transition-colors mb-2"
            >
              <Plus className="w-3.5 h-3.5" />오브젝트 추가
            </button>

            {/* 오브젝트 선택 피커 */}
            {showPicker && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-2 grid grid-cols-3 gap-1.5">
                {OBJECT_TYPES.map(ot => (
                  <button
                    key={ot.type}
                    onClick={() => {
                      onAddObject(ot.type, ot.label);
                      setShowPicker(false);
                    }}
                    className="flex flex-col items-center p-1.5 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <span className="text-2xl">{ot.emoji}</span>
                    <span className="text-[10px] text-gray-600 mt-0.5">{ot.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* 오브젝트 목록 */}
            <div className="space-y-1">
              {objects.map(obj => (
                <div
                  key={obj.id}
                  onClick={() => onSelectObject(obj.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all group ${selectedObjectId === obj.id ? "bg-green-100 ring-2 ring-green-400" : "hover:bg-gray-50"}`}
                >
                  <span className="text-xl flex-shrink-0">{OBJECT_EMOJIS[obj.type] || "❓"}</span>
                  <span className="text-xs font-medium text-gray-700 flex-1 truncate">{obj.name}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={e => { e.stopPropagation(); onUpdateObject(obj.id, { visible: obj.visible === false ? true : false }); }}
                      className="p-0.5 rounded hover:bg-gray-200 text-gray-500"
                    >
                      {obj.visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteObject(obj.id); }}
                      className="p-0.5 rounded hover:bg-red-100 text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {objects.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">오브젝트를 추가해보세요!</p>
              )}
            </div>
          </div>
        )}

        {tab === "background" && (
          <div className="p-2 grid grid-cols-2 gap-2">
            {Object.entries(BACKGROUNDS).map(([key, bg]) => (
              <button
                key={key}
                onClick={() => onChangeBackground(key)}
                className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all text-xs ${background === key ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="w-full h-12 rounded-md mb-1 flex items-center justify-center text-2xl"
                  style={{ backgroundColor: bg.color }}>
                  {bg.emoji}
                </div>
                <span className="text-gray-600 text-[10px]">{bg.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 선택된 오브젝트 속성 패널 */}
      {selectedObj && tab === "objects" && (
        <div className="border-t border-gray-200 p-2 bg-gray-50 text-xs space-y-1.5">
          <div className="font-bold text-gray-700 mb-1.5 truncate">📌 {selectedObj.name}</div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 w-12">이름</span>
            <input
              className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-xs"
              value={selectedObj.name}
              onChange={e => onUpdateObject(selectedObj.id, { name: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 w-12">X</span>
            <input type="number" className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-xs"
              value={selectedObj.x || 0} onChange={e => onUpdateObject(selectedObj.id, { x: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 w-12">Y</span>
            <input type="number" className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-xs"
              value={selectedObj.y || 0} onChange={e => onUpdateObject(selectedObj.id, { y: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 w-12">크기</span>
            <input type="number" className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-xs"
              value={selectedObj.size || 60} onChange={e => onUpdateObject(selectedObj.id, { size: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 w-12">방향</span>
            <input type="number" className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-xs"
              value={selectedObj.direction || 90} onChange={e => onUpdateObject(selectedObj.id, { direction: Number(e.target.value) })} />
          </div>
        </div>
      )}
    </div>
  );
}