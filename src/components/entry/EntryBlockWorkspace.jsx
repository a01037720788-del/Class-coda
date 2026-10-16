import React, { useState, useCallback } from "react";
import { BLOCK_DEFS } from "./EntryBlockPalette";

// 블록 하나를 렌더링
function BlockNode({ block, depth = 0, onChange, onDelete, onAddChild }) {
  const [params, setParams] = useState(block.params || {});

  const updateParam = (key, value) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    onChange({ ...block, params: newParams });
  };

  const isHat = block.hat;
  const hasBody = block.hasBody;
  const hasElse = block.hasElse;

  return (
    <div className={`relative ${depth > 0 ? "ml-4" : ""}`}>
      <div
        className="flex items-center gap-1 flex-wrap rounded-lg px-2 py-1.5 text-white text-xs font-medium shadow-sm mb-0.5 group"
        style={{ backgroundColor: block.color, minWidth: isHat ? 180 : 140 }}
      >
        {isHat && <span className="mr-1 text-sm">▶</span>}

        {/* 블록 레이블과 파라미터 */}
        <BlockLabel block={block} params={params} updateParam={updateParam} />

        {/* 삭제 버튼 */}
        <button
          onClick={() => onDelete(block.id)}
          className="ml-auto opacity-0 group-hover:opacity-100 text-white/70 hover:text-white text-xs transition-opacity pl-1"
        >✕</button>
      </div>

      {/* 자식 블록 (body) */}
      {hasBody && (
        <div className="ml-4 border-l-2 border-dashed pl-1 mb-0.5" style={{ borderColor: block.color }}>
          {(block.children || []).map((child, i) => (
            <BlockNode
              key={child.id}
              block={child}
              depth={depth + 1}
              onChange={(updated) => {
                const newChildren = [...(block.children || [])];
                newChildren[i] = updated;
                onChange({ ...block, children: newChildren });
              }}
              onDelete={(delId) => {
                const newChildren = (block.children || []).filter(c => c.id !== delId);
                onChange({ ...block, children: newChildren });
              }}
              onAddChild={() => {}}
            />
          ))}
          <DropZone
            onDrop={(newBlock) => {
              const newChildren = [...(block.children || []), newBlock];
              onChange({ ...block, children: newChildren });
            }}
          />
        </div>
      )}

      {/* else 블록 */}
      {hasElse && (
        <>
          <div className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-white text-xs font-medium shadow-sm mb-0.5 ml-2"
            style={{ backgroundColor: block.color }}>
            아니면
          </div>
          <div className="ml-4 border-l-2 border-dashed pl-1 mb-0.5" style={{ borderColor: block.color }}>
            {(block.elseChildren || []).map((child, i) => (
              <BlockNode
                key={child.id}
                block={child}
                depth={depth + 1}
                onChange={(updated) => {
                  const newChildren = [...(block.elseChildren || [])];
                  newChildren[i] = updated;
                  onChange({ ...block, elseChildren: newChildren });
                }}
                onDelete={(delId) => {
                  const newChildren = (block.elseChildren || []).filter(c => c.id !== delId);
                  onChange({ ...block, elseChildren: newChildren });
                }}
                onAddChild={() => {}}
              />
            ))}
            <DropZone
              onDrop={(newBlock) => {
                const newChildren = [...(block.elseChildren || []), newBlock];
                onChange({ ...block, elseChildren: newChildren });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function BlockLabel({ block, params, updateParam }) {
  // BLOCK_DEFS에서 해당 블록의 파라미터 스펙 가져오기
  const allBlocks = Object.values(BLOCK_DEFS).flat();
  const def = allBlocks.find(b => b.type === block.type) || {};
  const paramSpecs = def.params || [];

  return (
    <span className="flex items-center gap-1 flex-wrap">
      {renderLabel(block.label, paramSpecs, params, updateParam)}
    </span>
  );
}

function renderLabel(label, specs, params, updateParam) {
  if (!specs || specs.length === 0) return <span>{label}</span>;

  // 파라미터별로 값을 입력받을 수 있도록
  const parts = [];
  let remaining = label;

  specs.forEach((spec, i) => {
    const val = params[spec.key] !== undefined ? params[spec.key] : spec.default;
    // 라벨에서 default 값 위치를 찾아 input으로 교체
    const defaultStr = String(spec.default);
    const idx = remaining.indexOf(defaultStr);
    if (idx !== -1) {
      parts.push(<span key={`txt-${i}`}>{remaining.slice(0, idx)}</span>);
      parts.push(
        <input
          key={`inp-${i}`}
          type={spec.type === "number" ? "number" : "text"}
          value={val}
          onChange={e => updateParam(spec.key, spec.type === "number" ? Number(e.target.value) : e.target.value)}
          onClick={e => e.stopPropagation()}
          className="w-12 px-1 py-0 rounded text-center text-xs text-gray-800 bg-white/90 border-0 outline-none"
          style={{ minWidth: spec.type === "string" ? 60 : 40 }}
        />
      );
      remaining = remaining.slice(idx + defaultStr.length);
    }
  });
  parts.push(<span key="txt-end">{remaining}</span>);
  return parts;
}

function DropZone({ onDrop }) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        try {
          const raw = e.dataTransfer.getData("block");
          if (raw) {
            const block = JSON.parse(raw);
            onDrop({ ...block, id: Date.now() + Math.random(), children: [], elseChildren: [] });
          }
        } catch {}
      }}
      className="h-5 rounded border-2 border-dashed transition-colors mb-0.5"
      style={{ borderColor: over ? "#666" : "#ccc", backgroundColor: over ? "#f0f0f0" : "transparent" }}
    />
  );
}

// 스크립트 블록 스택 (hat + 이어진 블록들)
function BlockStack({ stack, onUpdate, onDelete }) {
  return (
    <div className="bg-white/80 rounded-xl p-2 shadow-sm mb-3 inline-block min-w-max">
      {stack.map((block, i) => (
        <BlockNode
          key={block.id}
          block={block}
          depth={0}
          onChange={(updated) => {
            const newStack = [...stack];
            newStack[i] = updated;
            onUpdate(newStack);
          }}
          onDelete={(delId) => {
            if (block.id === delId) {
              onDelete();
            }
          }}
          onAddChild={() => {}}
        />
      ))}
      {/* 스택 끝에 드롭존 */}
      <DropZone
        onDrop={(newBlock) => {
          onUpdate([...stack, newBlock]);
        }}
      />
    </div>
  );
}

export default function EntryBlockWorkspace({ scripts, onChange }) {
  // scripts: [{ id, stack: [block, ...] }, ...]
  const [dragOver, setDragOver] = useState(false);

  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    try {
      const raw = e.dataTransfer.getData("block");
      if (!raw) return;
      const block = JSON.parse(raw);
      const newStack = { id: Date.now(), stack: [{ ...block, id: Date.now() + 1, children: [], elseChildren: [] }] };
      onChange([...scripts, newStack]);
    } catch {}
  }, [scripts, onChange]);

  return (
    <div
      className="flex-1 relative overflow-auto p-4"
      style={{ background: "radial-gradient(circle at 50% 50%, #e8edf5 1px, transparent 1px) 0 0 / 24px 24px, #edf1f7", minHeight: 400 }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleCanvasDrop}
    >
      {scripts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <div className="text-4xl mb-3">🧩</div>
            <p className="text-sm">왼쪽에서 블록을 드래그해서 여기에 놓으세요</p>
          </div>
        </div>
      )}
      {scripts.map((scriptObj, si) => (
        <BlockStack
          key={scriptObj.id}
          stack={scriptObj.stack}
          onUpdate={(newStack) => {
            const updated = [...scripts];
            updated[si] = { ...scriptObj, stack: newStack };
            onChange(updated);
          }}
          onDelete={() => {
            onChange(scripts.filter((_, idx) => idx !== si));
          }}
        />
      ))}
    </div>
  );
}