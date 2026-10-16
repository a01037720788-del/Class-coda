import React from "react";

function inferType(val) {
  if (val === "True" || val === "False") return "bool";
  if (!isNaN(val) && String(val).includes(".")) return "float";
  if (!isNaN(val) && val !== "") return "int";
  return "str";
}

function getTypeColor(type) {
  return {
    str: { bg: "bg-purple-100", border: "border-purple-400", badge: "bg-purple-500" },
    int: { bg: "bg-blue-100", border: "border-blue-400", badge: "bg-blue-500" },
    float: { bg: "bg-green-100", border: "border-green-400", badge: "bg-green-500" },
    bool: { bg: "bg-orange-100", border: "border-orange-400", badge: "bg-orange-500" },
  }[type] || { bg: "bg-gray-100", border: "border-gray-400", badge: "bg-gray-500" };
}

// 학생용: 읽기 전용, 선생님이 만든 변수 데이터를 표시만 함
export default function VariableVisualizer({ vars = [] }) {
  if (!vars.length) return null;

  const codePreview = vars.map(v => {
    const t = inferType(v.value);
    const val = t === "str" ? `"${v.value}"` : v.value;
    return `${v.name || "_"} = ${val || '""'}`;
  }).join("\n");

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-3">
      <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">🎮 변수 시각화</p>
      <div className="flex flex-wrap gap-3 mb-4">
        {vars.map((v, idx) => {
          const type = inferType(v.value);
          const c = getTypeColor(type);
          return (
            <div key={idx} className={`rounded-xl border-2 ${c.border} ${c.bg} p-3 min-w-[110px] flex-shrink-0`}>
              <p className="font-mono font-bold text-sm text-gray-700 mb-1 border-b border-dashed border-gray-400 pb-0.5">{v.name}</p>
              <div className="bg-white rounded-lg border border-gray-200 px-2 py-1 mt-1">
                <p className="font-mono text-sm text-gray-800">{v.value}</p>
              </div>
              {v.description && <p className="text-[10px] text-gray-500 mt-1">{v.description}</p>}
              <span className={`inline-block mt-1.5 text-[10px] text-white font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                {type}
              </span>
            </div>
          );
        })}
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">📝 코드 예시:</p>
        <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono overflow-auto">{codePreview}</pre>
      </div>
    </div>
  );
}