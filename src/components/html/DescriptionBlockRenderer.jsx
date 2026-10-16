import React from "react";

const HIGHLIGHT_COLORS = {
  blue:   "bg-blue-50 border-blue-300 text-blue-800",
  yellow: "bg-yellow-50 border-yellow-300 text-yellow-800",
  green:  "bg-green-50 border-green-300 text-green-800",
  red:    "bg-red-50 border-red-300 text-red-800",
  purple: "bg-purple-50 border-purple-300 text-purple-800",
};

const CODE_LANG_COLORS = {
  html:       "text-orange-300",
  css:        "text-blue-300",
  javascript: "text-yellow-300",
};

function SingleBlockRenderer({ block }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-xl font-bold text-gray-900 mt-2">{block.content}</h2>;

    case "subheading":
      return <h3 className="text-base font-semibold text-gray-800 mt-1">{block.content}</h3>;

    case "paragraph":
      return <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{block.content}</p>;

    case "code":
      return (
        <div className="rounded-xl overflow-hidden border border-gray-700">
          {block.title && (
            <div className="bg-gray-800 px-3 py-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">{block.title}</span>
              {block.language && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  block.language === "html" ? "bg-orange-900 text-orange-300" :
                  block.language === "css"  ? "bg-blue-900 text-blue-300" :
                  "bg-yellow-900 text-yellow-300"
                }`}>{block.language.toUpperCase()}</span>
              )}
            </div>
          )}
          <pre className={`bg-gray-900 p-4 text-sm overflow-x-auto leading-relaxed ${CODE_LANG_COLORS[block.language] || "text-green-300"}`}>
            {block.content}
          </pre>
        </div>
      );

    case "table":
      if (!block.columns || !block.rows) return null;
      return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {block.columns.map((col, ci) => (
                  <th key={ci} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-gray-700 border-b border-gray-100 text-sm">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "highlight": {
      const colorCls = HIGHLIGHT_COLORS[block.color] || HIGHLIGHT_COLORS.yellow;
      return (
        <div className={`border-l-4 rounded-lg p-4 ${colorCls}`}>
          {block.title && <p className="font-bold text-sm mb-1">💡 {block.title}</p>}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{block.content}</p>
        </div>
      );
    }

    case "image":
      if (!block.url) return null;
      return (
        <div className="text-center">
          <img src={block.url} alt={block.alt || ""} className="max-w-full rounded-xl border border-gray-200 mx-auto" />
          {block.alt && <p className="text-xs text-gray-400 mt-1">{block.alt}</p>}
        </div>
      );

    case "memo":
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">📝 메모</p>
          <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{block.content}</p>
        </div>
      );

    default:
      if (!block.content) return null;
      return <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{block.content}</p>;
  }
}

export default function DescriptionBlockRenderer({ blocks = [] }) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-200">
        아직 등록된 설명이 없습니다.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {blocks.map((block, idx) => (
        <div key={idx}>
          <SingleBlockRenderer block={block} />
        </div>
      ))}
    </div>
  );
}