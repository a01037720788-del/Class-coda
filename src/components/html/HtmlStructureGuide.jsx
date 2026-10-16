import React, { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

const STRUCTURE_NODES = [
  {
    tag: "<!DOCTYPE html>",
    color: "#9ca3af",
    desc: "이 파일이 HTML5 문서임을 선언합니다.",
    selfClose: true,
  },
  {
    tag: "html",
    color: "#f97316",
    desc: "웹페이지 전체를 감싸는 루트 태그입니다.",
    children: [
      {
        tag: "head",
        color: "#8b5cf6",
        desc: "브라우저에게 전달하는 설정 정보 영역 (화면에 보이지 않음)",
        children: [
          { tag: 'meta charset="UTF-8"', color: "#6b7280", desc: "문자 인코딩 설정 (한글 깨짐 방지)", selfClose: true },
          { tag: 'meta name="viewport" ...', color: "#6b7280", desc: "모바일 화면 크기 설정", selfClose: true },
          { tag: "title", color: "#a78bfa", desc: "브라우저 탭에 표시되는 제목", children: [] },
        ],
      },
      {
        tag: "body",
        color: "#22c55e",
        desc: "실제 화면에 보이는 모든 내용을 담는 영역",
        children: [
          { tag: "h1 ~ h6", color: "#f59e0b", desc: "제목 태그 (크기 순서대로)", children: [] },
          { tag: "p", color: "#f59e0b", desc: "문단 텍스트", children: [] },
          { tag: "div, span, ...", color: "#94a3b8", desc: "기타 콘텐츠 태그들", children: [] },
        ],
      },
    ],
  },
];

function TreeNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 20;

  return (
    <div>
      <div
        className="flex items-start gap-1.5 py-0.5 rounded hover:bg-gray-50 cursor-pointer group"
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        <div className="w-4 flex-shrink-0 mt-0.5">
          {hasChildren ? (
            open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          ) : <span className="w-3.5" />}
        </div>
        <span className="font-mono text-xs font-semibold" style={{ color: node.color }}>
          {node.selfClose ? `<${node.tag}>` : `<${node.tag}>`}
        </span>
        <span className="text-xs text-gray-500 leading-relaxed">{node.desc}</span>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
          {!node.selfClose && depth > 0 && (
            <div style={{ paddingLeft: `${indent + 8}px` }} className="py-0.5">
              <span className="font-mono text-xs" style={{ color: node.color, opacity: 0.6 }}>
                &lt;/{node.tag.split(" ")[0]}&gt;
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CODE_SAMPLE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CODA HTML Practice</title>
</head>
<body>

  <h1>안녕하세요!</h1>
  <p>여기에 내용을 작성하세요.</p>

</body>
</html>`;

export default function HtmlStructureGuide() {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
          <Info className="w-4 h-4 text-orange-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-orange-700">HTML 문서 구조</p>
          <p className="text-xs text-orange-500">모든 HTML 파일은 이 구조로 시작합니다</p>
        </div>
        <button
          onClick={() => setShowCode(s => !s)}
          className="ml-auto text-xs text-orange-600 hover:text-orange-800 underline"
        >
          {showCode ? "트리 보기" : "코드 보기"}
        </button>
      </div>

      {showCode ? (
        <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded-lg overflow-x-auto leading-relaxed">
          {CODE_SAMPLE}
        </pre>
      ) : (
        <div className="bg-white rounded-lg border border-orange-100 py-2 px-1">
          {STRUCTURE_NODES.map((node, i) => (
            <TreeNode key={i} node={node} depth={0} />
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white rounded-lg p-2 border border-purple-100">
          <span className="font-bold text-purple-600">&lt;head&gt;</span>
          <p className="text-gray-500 mt-0.5">설정 영역<br/>화면에 안 보임</p>
        </div>
        <div className="bg-white rounded-lg p-2 border border-green-100">
          <span className="font-bold text-green-600">&lt;body&gt;</span>
          <p className="text-gray-500 mt-0.5">콘텐츠 영역<br/>화면에 보임</p>
        </div>
        <div className="bg-white rounded-lg p-2 border border-orange-100">
          <span className="font-bold text-orange-600">&lt;html&gt;</span>
          <p className="text-gray-500 mt-0.5">전체 감싸기<br/>루트 태그</p>
        </div>
      </div>
    </div>
  );
}