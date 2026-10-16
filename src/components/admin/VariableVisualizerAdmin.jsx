import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Save, Eye, EyeOff } from "lucide-react";

function inferType(val) {
  if (val === "True" || val === "False") return "bool";
  if (!isNaN(val) && String(val).includes(".")) return "float";
  if (!isNaN(val) && val !== "") return "int";
  return "str";
}

const TYPE_COLORS = {
  str: "bg-purple-100 border-purple-400",
  int: "bg-blue-100 border-blue-400",
  float: "bg-green-100 border-green-400",
  bool: "bg-orange-100 border-orange-400",
};

// 관리자용: unit의 variable_visualizer_vars 필드를 편집
export default function VariableVisualizerAdmin({ unitId, initialVars = [], onSave }) {
  const [vars, setVars] = useState(initialVars.length ? initialVars : [
    { name: "name", value: "Python", description: "문자열 변수 예시", is_active: true },
    { name: "age", value: "12", description: "정수 변수 예시", is_active: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initialVars.length) setVars(initialVars);
  }, [unitId]);

  const updateVar = (idx, field, val) =>
    setVars(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v));

  const addVar = () =>
    setVars(prev => [...prev, { name: "", value: "", description: "", is_active: true }]);

  const removeVar = (idx) =>
    setVars(prev => prev.filter((_, i) => i !== idx));

  const moveVar = (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= vars.length) return;
    setVars(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    if (onSave) await onSave(vars);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-700">🎮 변수 시각화 관리</p>
        <Button size="sm" onClick={handleSave} disabled={saving}
          className={`gap-1.5 ${saved ? "bg-green-600 hover:bg-green-700" : ""}`}>
          <Save className="w-3.5 h-3.5" />
          {saving ? "저장 중..." : saved ? "저장됨 ✓" : "저장"}
        </Button>
      </div>

      <div className="space-y-2 mb-3">
        {vars.map((v, idx) => {
          const type = inferType(v.value);
          const colorClass = TYPE_COLORS[type] || "bg-gray-100 border-gray-400";
          return (
            <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border-2 ${colorClass} bg-white`}>
              {/* 순서 이동 */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveVar(idx, -1)} className="text-gray-400 hover:text-gray-700 text-xs leading-none">▲</button>
                <button onClick={() => moveVar(idx, 1)} className="text-gray-400 hover:text-gray-700 text-xs leading-none">▼</button>
              </div>
              {/* 변수명 */}
              <input className="font-mono text-sm border border-gray-200 rounded px-2 py-1 w-24 outline-none"
                placeholder="변수명" value={v.name}
                onChange={e => updateVar(idx, "name", e.target.value)} />
              <span className="text-gray-400">=</span>
              {/* 값 */}
              <input className="font-mono text-sm border border-gray-200 rounded px-2 py-1 w-24 outline-none"
                placeholder="값" value={v.value}
                onChange={e => updateVar(idx, "value", e.target.value)} />
              {/* 설명 */}
              <input className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 outline-none"
                placeholder="설명 (선택)" value={v.description || ""}
                onChange={e => updateVar(idx, "description", e.target.value)} />
              {/* 타입 뱃지 */}
              <Badge variant="outline" className="text-[10px] shrink-0">{type}</Badge>
              {/* ON/OFF */}
              <button onClick={() => updateVar(idx, "is_active", !v.is_active)}
                className={`p-1 rounded transition-colors ${v.is_active ? "text-green-600 hover:text-green-800" : "text-gray-400 hover:text-gray-600"}`}
                title={v.is_active ? "표시 중 (클릭하여 숨기기)" : "숨김 (클릭하여 표시)"}>
                {v.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              {/* 삭제 */}
              <button onClick={() => removeVar(idx)} className="text-red-400 hover:text-red-600 p-1 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <Button size="sm" variant="outline" onClick={addVar} className="gap-1.5 w-full">
        <Plus className="w-3.5 h-3.5" />변수 추가
      </Button>

      {/* 미리보기 */}
      <div className="mt-3">
        <p className="text-xs text-gray-400 mb-1">📝 학생에게 보이는 코드 미리보기:</p>
        <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono overflow-auto">
          {vars.filter(v => v.is_active).map(v => {
            const t = inferType(v.value);
            const val = t === "str" ? `"${v.value}"` : v.value;
            return `${v.name || "_"} = ${val || '""'}`;
          }).join("\n") || "# 활성화된 변수가 없습니다"}
        </pre>
      </div>
    </div>
  );
}