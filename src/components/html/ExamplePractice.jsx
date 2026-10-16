import React, { useState } from "react";
import CodeEditor from "./CodeEditor";
import MultiPreview from "./MultiPreview";
import MultiFileEditor from "./MultiFileEditor";
import { Check, X, ChevronRight, RefreshCw, Maximize2, Minimize2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_HTML_BOILERPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="style.css">
</head>
<body>

</body>
</html>`;

const DEFAULT_CSS = ``;

const DEFAULT_JS = ``;

function judgeCode(original, submitted, mode = "structure") {
  const norm = s => s.replace(/\s+/g, " ").trim();
  const extractTags = s => (s.match(/<\/?[a-zA-Z][^>]*>/g) || []).join("");
  if (mode === "exact") return original.trim() === submitted.trim();
  if (mode === "whitespace") return norm(original) === norm(submitted);
  return extractTags(original) === extractTags(submitted);
}

function judgeGeneral(original, submitted) {
  const norm = s => s.replace(/\s+/g, " ").trim();
  return norm(original) === norm(submitted);
}

const CODE_TABS = [
  { key: "html", label: "HTML", color: "text-orange-400", dot: "bg-orange-400" },
  { key: "css",  label: "CSS",  color: "text-blue-400",   dot: "bg-blue-400"   },
  { key: "js",   label: "JS",   color: "text-yellow-400", dot: "bg-yellow-400" },
];

export default function ExamplePractice({
  example,
  exampleIdx,
  exTotal,
  completedIds = [],
  onSubmit,
  onNext,
  result,
}) {
  const [activeOrigTab, setActiveOrigTab] = useState("html");
  const [fullscreen, setFullscreen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const defaultStudentFiles = [
    { name: "index.html", language: "html", code: DEFAULT_HTML_BOILERPLATE },
    { name: "style.css",  language: "css",  code: DEFAULT_CSS },
    { name: "script.js",  language: "js",   code: DEFAULT_JS },
  ];

  const [studentFiles, setStudentFiles] = useState(defaultStudentFiles);

  const origHtml = example?.html || "";
  const origCss  = example?.css  || "";
  const origJs   = example?.javascript || "";
  const hasOrigCss = origCss.trim().length > 0;
  const hasOrigJs  = origJs.trim().length > 0;

  const handleSubmit = () => {
    const htmlFile = studentFiles.find(f => f.name === "index.html") || studentFiles.find(f => f.language === "html");
    const cssFile  = studentFiles.find(f => f.name === "style.css")  || studentFiles.find(f => f.language === "css");
    const jsFile   = studentFiles.find(f => f.name === "script.js")  || studentFiles.find(f => f.language === "js");

    const typedHtml = htmlFile?.code || "";
    const typedCss  = cssFile?.code  || "";
    const typedJs   = jsFile?.code   || "";

    const htmlOk = judgeCode(origHtml, typedHtml, example?.judge_mode || "structure");
    const cssOk  = hasOrigCss ? judgeGeneral(origCss, typedCss) : true;
    const jsOk   = hasOrigJs  ? judgeGeneral(origJs, typedJs)   : true;
    const allOk  = htmlOk && cssOk && jsOk;

    onSubmit({ htmlOk, cssOk, jsOk, allOk });
  };

  const resetStudent = () => setStudentFiles(defaultStudentFiles.map(f => ({ ...f })));

  // ── 전체화면 모드 ──────────────────────────────────
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col">
        {/* 전체화면 헤더 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">✏️ 내 코드 작성 (전체화면)</span>
            <span className="text-xs text-gray-400">예제 {exampleIdx + 1} / {exTotal}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(p => !p)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showPreview ? "bg-blue-50 border-blue-300 text-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-100"}`}
            >
              <Eye className="w-3.5 h-3.5" />
              미리보기 {showPreview ? "끄기" : "켜기"}
            </button>
            <Button onClick={handleSubmit} size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs">확인하기</Button>
            {result?.allOk && (
              <Button onClick={onNext} size="sm" variant="outline" className="text-xs gap-1">
                {exampleIdx + 1 < exTotal ? "다음 예제" : "Question으로"} <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
            <button
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              닫기 (Esc)
            </button>
          </div>
        </div>

        {/* 전체화면 본문 */}
        <div className={`flex-1 flex overflow-hidden ${showPreview ? "flex-row" : ""}`}>
          <div className={showPreview ? "w-[60%] border-r border-gray-200 overflow-auto" : "w-full overflow-auto"}>
            <MultiFileEditor
              files={studentFiles}
              onFilesChange={setStudentFiles}
              height="calc(100vh - 52px)"
              showPreview={false}
            />
          </div>
          {showPreview && (
            <div className="w-[40%] overflow-auto">
              <MultiPreview files={studentFiles} autoPreview height="calc(100vh - 52px)" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 일반 모드 ──────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* 진행 표시 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">예제 {exampleIdx + 1} / {exTotal}</p>
        <div className="flex gap-1">
          {Array.from({ length: exTotal }, (_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${completedIds.includes(i) ? "bg-green-500" : i === exampleIdx ? "bg-orange-500" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>

      {/* 메인 레이아웃: 원본 40% | 내 코드 60% */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* 왼쪽: 원본 코드 (40%) */}
        <div className="lg:w-[40%] flex-shrink-0 bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
          <div className="flex items-center px-3 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-300 mr-3">📄 원본 코드</span>
            <div className="flex gap-0.5">
              {CODE_TABS.map(t => (
                <button key={t.key} onClick={() => setActiveOrigTab(t.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${activeOrigTab === t.key ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ minHeight: "560px" }}>
            {activeOrigTab === "html" && (
              <CodeEditor value={origHtml || DEFAULT_HTML_BOILERPLATE} onChange={() => {}} readOnly language="html" height="560px" showCopy={false} filename="index.html" />
            )}
            {activeOrigTab === "css" && (
              <CodeEditor value={origCss || "/* CSS 없음 */"} onChange={() => {}} readOnly language="css" height="560px" showCopy={false} filename="style.css" />
            )}
            {activeOrigTab === "js" && (
              <CodeEditor value={origJs || "// JavaScript 없음"} onChange={() => {}} readOnly language="js" height="560px" showCopy={false} filename="script.js" />
            )}
          </div>
          {example?.description && (
            <div className="px-3 py-2 bg-gray-800 border-t border-gray-700">
              <p className="text-xs text-gray-400">{example.description}</p>
            </div>
          )}
        </div>

        {/* 오른쪽: 내 코드 작성 (60%) */}
        <div className="lg:w-[60%] flex-1 flex flex-col rounded-xl border-2 border-orange-200 min-w-0">
          <div className="flex items-center px-3 py-2 bg-orange-50 border-b border-orange-200 flex-shrink-0">
            <span className="text-xs font-semibold text-orange-600">✏️ 내 코드 작성</span>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={resetStudent} className="p-1 text-gray-400 hover:text-gray-600 rounded" title="초기화">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFullscreen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-orange-600 hover:bg-orange-100 border border-orange-300 transition-colors"
                title="전체화면 작성"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                크게 보기
              </button>
            </div>
          </div>
          <div className="w-full" style={{ minHeight: "560px" }}>
            <MultiFileEditor
              files={studentFiles}
              onFilesChange={setStudentFiles}
              height="560px"
              showPreview={false}
            />
          </div>
        </div>
      </div>

      {/* Preview 영역 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500">👁 내 코드 미리보기</p>
        </div>
        <MultiPreview files={studentFiles} autoPreview height="400px" />
      </div>

      {/* 결과 */}
      {result && (
        <div className={`p-4 rounded-xl border ${result.allOk ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className={`font-semibold text-sm mb-3 ${result.allOk ? "text-green-700" : "text-red-600"}`}>
            {result.allOk ? "🎉 모두 정답입니다!" : "아직 다른 부분이 있습니다."}
          </p>
          <div className="space-y-1.5">
            <div className={`flex items-center gap-2 text-sm ${result.htmlOk ? "text-green-600" : "text-red-500"}`}>
              {result.htmlOk ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              <span className="text-xs font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">HTML</span>
              {result.htmlOk ? "정답입니다." : "아직 다릅니다."}
            </div>
            {hasOrigCss && (
              <div className={`flex items-center gap-2 text-sm ${result.cssOk ? "text-green-600" : "text-red-500"}`}>
                {result.cssOk ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">CSS</span>
                {result.cssOk ? "정답입니다." : "아직 다릅니다."}
              </div>
            )}
            {hasOrigJs && (
              <div className={`flex items-center gap-2 text-sm ${result.jsOk ? "text-green-600" : "text-red-500"}`}>
                {result.jsOk ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">JavaScript</span>
                {result.jsOk ? "정답입니다." : "아직 다릅니다."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-3">
        <Button onClick={handleSubmit} className="bg-orange-500 hover:bg-orange-600">확인하기</Button>
        {result?.allOk && (
          <Button onClick={onNext} variant="outline" className="gap-2">
            {exampleIdx + 1 < exTotal ? "다음 예제" : "Question으로"} <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}