import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronUp } from "lucide-react";

const BLOCK_TYPES = [
  { type: "heading",    label: "제목",      icon: "H1", color: "bg-purple-100 text-purple-700" },
  { type: "subheading", label: "소제목",    icon: "H2", color: "bg-blue-100 text-blue-700" },
  { type: "paragraph",  label: "설명",      icon: "¶",  color: "bg-gray-100 text-gray-700" },
  { type: "code",       label: "코드 블록", icon: "</>", color: "bg-orange-100 text-orange-700" },
  { type: "table",      label: "표",        icon: "⊞",  color: "bg-green-100 text-green-700" },
  { type: "highlight",  label: "강조 박스", icon: "★",  color: "bg-yellow-100 text-yellow-700" },
  { type: "image",      label: "이미지",    icon: "🖼",  color: "bg-pink-100 text-pink-700" },
  { type: "memo",       label: "메모",      icon: "📝", color: "bg-teal-100 text-teal-700" },
];

function BlockTypeIcon({ type }) {
  const def = BLOCK_TYPES.find(b => b.type === type);
  if (!def) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${def.color}`}>{def.icon} {def.label}</span>
  );
}

function CodeBlockEditor({ block, onChange }) {
  return (
    <div className="space-y-2">
      <Input placeholder="코드 제목 (선택)" value={block.title || ""} onChange={e => onChange({ ...block, title: e.target.value })} className="text-sm" />
      <select
        value={block.language || "html"}
        onChange={e => onChange({ ...block, language: e.target.value })}
        className="border border-gray-200 rounded-md px-3 py-2 text-sm w-32"
      >
        <option value="html">HTML</option>
        <option value="css">CSS</option>
        <option value="javascript">JavaScript</option>
      </select>
      <textarea
        placeholder="코드 내용"
        value={block.content || ""}
        onChange={e => onChange({ ...block, content: e.target.value })}
        className="w-full border border-gray-200 rounded-md p-2 text-sm font-mono resize-none h-28 bg-gray-900 text-green-300"
      />
    </div>
  );
}

function TableEditor({ block, onChange }) {
  const columns = block.columns || ["열1", "열2"];
  const rows = block.rows || [["", ""]];

  const setColumns = (cols) => onChange({ ...block, columns: cols, rows: rows.map(r => { const nr = [...r]; while (nr.length < cols.length) nr.push(""); return nr.slice(0, cols.length); }) });
  const setRows = (rs) => onChange({ ...block, rows: rs });

  const addCol = () => setColumns([...columns, `열${columns.length + 1}`]);
  const addRow = () => setRows([...rows, Array(columns.length).fill("")]);
  const removeRow = (ri) => setRows(rows.filter((_, i) => i !== ri));
  const updateCell = (ri, ci, val) => {
    const newRows = rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r);
    setRows(newRows);
  };
  const updateCol = (ci, val) => {
    const newCols = columns.map((c, i) => i === ci ? val : c);
    setColumns(newCols);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={addCol} className="text-xs px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded hover:bg-green-100">+ 열 추가</button>
        <button onClick={addRow} className="text-xs px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded hover:bg-blue-100">+ 행 추가</button>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col, ci) => (
                <th key={ci} className="border-b border-gray-200 p-1">
                  <Input value={col} onChange={e => updateCol(ci, e.target.value)} className="h-7 text-xs font-semibold text-center" />
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-gray-100 p-1">
                    <Input value={cell} onChange={e => updateCell(ri, ci, e.target.value)} className="h-7 text-xs" />
                  </td>
                ))}
                <td className="border-b border-gray-100 p-1 text-center">
                  <button onClick={() => removeRow(ri)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HighlightEditor({ block, onChange }) {
  const colors = [
    { value: "blue",   label: "파랑", cls: "bg-blue-50 border-blue-200" },
    { value: "yellow", label: "노랑", cls: "bg-yellow-50 border-yellow-200" },
    { value: "green",  label: "초록", cls: "bg-green-50 border-green-200" },
    { value: "red",    label: "빨강", cls: "bg-red-50 border-red-200" },
    { value: "purple", label: "보라", cls: "bg-purple-50 border-purple-200" },
  ];
  return (
    <div className="space-y-2">
      <Input placeholder="강조 박스 제목" value={block.title || ""} onChange={e => onChange({ ...block, title: e.target.value })} />
      <textarea placeholder="강조 박스 내용" value={block.content || ""} onChange={e => onChange({ ...block, content: e.target.value })} className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none h-16" />
      <div className="flex gap-2">
        {colors.map(c => (
          <button key={c.value} onClick={() => onChange({ ...block, color: c.value })}
            className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${c.cls} ${block.color === c.value ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
          >{c.label}</button>
        ))}
      </div>
    </div>
  );
}

function SingleBlockEditor({ block, onChange }) {
  switch (block.type) {
    case "heading":
    case "subheading":
      return <Input placeholder={block.type === "heading" ? "제목 입력" : "소제목 입력"} value={block.content || ""} onChange={e => onChange({ ...block, content: e.target.value })} className={block.type === "heading" ? "text-base font-bold" : "text-sm font-semibold"} />;
    case "paragraph":
      return <textarea placeholder="설명 내용 입력" value={block.content || ""} onChange={e => onChange({ ...block, content: e.target.value })} className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none h-24" />;
    case "code":
      return <CodeBlockEditor block={block} onChange={onChange} />;
    case "table":
      return <TableEditor block={block} onChange={onChange} />;
    case "highlight":
      return <HighlightEditor block={block} onChange={onChange} />;
    case "image":
      return (
        <div className="space-y-2">
          <Input placeholder="이미지 URL" value={block.url || ""} onChange={e => onChange({ ...block, url: e.target.value })} />
          <Input placeholder="이미지 설명 (alt)" value={block.alt || ""} onChange={e => onChange({ ...block, alt: e.target.value })} />
          {block.url && <img src={block.url} alt={block.alt || ""} className="max-h-40 rounded-lg border border-gray-200" />}
        </div>
      );
    case "memo":
      return <textarea placeholder="메모 내용 입력" value={block.content || ""} onChange={e => onChange({ ...block, content: e.target.value })} className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none h-20 bg-amber-50" />;
    default:
      return null;
  }
}

function makeDefaultBlock(type) {
  switch (type) {
    case "code":      return { type, language: "html", content: "", title: "" };
    case "table":     return { type, columns: ["태그", "의미", "예시"], rows: [["", "", ""], ["", "", ""]] };
    case "highlight": return { type, title: "여기서 잠깐!", content: "", color: "yellow" };
    case "image":     return { type, url: "", alt: "" };
    default:          return { type, content: "" };
  }
}

export default function DescriptionBlockEditor({ blocks = [], onChange }) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const updateBlock = (idx, newBlock) => {
    const arr = [...blocks]; arr[idx] = newBlock; onChange(arr);
  };
  const removeBlock = (idx) => onChange(blocks.filter((_, i) => i !== idx));
  const moveBlock = (idx, dir) => {
    const arr = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange(arr);
  };
  const addBlock = (type) => {
    onChange([...blocks, makeDefaultBlock(type)]);
    setShowAddMenu(false);
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <BlockTypeIcon type={block.type} />
            <div className="flex items-center gap-1">
              <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded">
                <ArrowUp className="w-3 h-3" />
              </button>
              <button onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded">
                <ArrowDown className="w-3 h-3" />
              </button>
              <button onClick={() => removeBlock(idx)} className="p-1 text-red-400 hover:text-red-600 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <SingleBlockEditor block={block} onChange={(b) => updateBlock(idx, b)} />
        </div>
      ))}

      {/* 블록 추가 버튼 */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 border-2 border-dashed border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-500 rounded-xl w-full justify-center text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          블록 추가
          {showAddMenu ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showAddMenu && (
          <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 p-2 grid grid-cols-4 gap-1.5">
            {BLOCK_TYPES.map(bt => (
              <button key={bt.type} onClick={() => addBlock(bt.type)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-gray-50 border border-gray-100`}
              >
                <span className={`text-sm px-1.5 py-0.5 rounded ${bt.color}`}>{bt.icon}</span>
                <span className="text-gray-600">{bt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}