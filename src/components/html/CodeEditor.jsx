import React, { useRef, useState, useCallback } from "react";
import { Copy, RefreshCw, Check } from "lucide-react";
import { EDITOR_THEMES, getLineHeight, getFontStack } from "@/hooks/useEditorSettings";

// Read editor settings from localStorage (set by useEditorSettings hook)
function getStoredEditorSettings() {
  try {
    const s = localStorage.getItem("coda_editor_settings");
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

const TAB = "  ";

// ── HTML 자동완성 데이터 ──
const DEFAULT_HTML_BOILERPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CODA HTML Practice</title>
</head>
<body>

</body>
</html>`;

const HTML_SNIPPETS = {
  "html": DEFAULT_HTML_BOILERPLATE,
  "head": "<head>\n  <meta charset=\"UTF-8\">\n  <title></title>\n</head>",
  "body": "<body>\n  \n</body>",
  "meta": '<meta charset="UTF-8">',
  "meta:vp": '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  "title": "<title></title>",
  "div": "<div></div>",
  "span": "<span></span>",
  "p": "<p></p>",
  "h1": "<h1></h1>",
  "h2": "<h2></h2>",
  "h3": "<h3></h3>",
  "h4": "<h4></h4>",
  "h5": "<h5></h5>",
  "h6": "<h6></h6>",
  "a": '<a href=""></a>',
  "img": '<img src="" alt="">',
  "ul": "<ul>\n  <li></li>\n</ul>",
  "ol": "<ol>\n  <li></li>\n</ol>",
  "li": "<li></li>",
  "table": "<table>\n  <tr>\n    <th></th>\n  </tr>\n  <tr>\n    <td></td>\n  </tr>\n</table>",
  "tr": "<tr>\n  <td></td>\n</tr>",
  "td": "<td></td>",
  "th": "<th></th>",
  "form": '<form action="" method="post">\n  \n</form>',
  "input": '<input type="text" name="" placeholder="">',
  "button": "<button></button>",
  "label": '<label for=""></label>',
  "select": "<select>\n  <option value=\"\"></option>\n</select>",
  "option": '<option value=""></option>',
  "textarea": "<textarea></textarea>",
  "nav": "<nav>\n  \n</nav>",
  "header": "<header>\n  \n</header>",
  "footer": "<footer>\n  \n</footer>",
  "main": "<main>\n  \n</main>",
  "section": "<section>\n  \n</section>",
  "article": "<article>\n  \n</article>",
  "aside": "<aside>\n  \n</aside>",
  "strong": "<strong></strong>",
  "em": "<em></em>",
  "br": "<br>",
  "hr": "<hr>",
  "script": "<script>\n  \n</script>",
  "script:src": '<script src="script.js"></script>',
  "style": "<style>\n  \n</style>",
  "link": '<link rel="stylesheet" href="style.css">',
  "link:css": '<link rel="stylesheet" href="style.css">',
  "link:font": '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR&display=swap">',
  "meta:og": '<meta property="og:title" content="">',
};

// CSS 자동완성
const CSS_SNIPPETS = [
  "color", "background-color", "background", "font-size", "font-family", "font-weight",
  "margin", "margin-top", "margin-bottom", "margin-left", "margin-right",
  "padding", "padding-top", "padding-bottom", "padding-left", "padding-right",
  "width", "height", "max-width", "min-width", "max-height", "min-height",
  "display", "flex", "flex-direction", "justify-content", "align-items", "flex-wrap",
  "position", "top", "left", "right", "bottom",
  "border", "border-radius", "border-color", "border-width", "border-style",
  "text-align", "text-decoration", "line-height", "letter-spacing",
  "opacity", "visibility", "overflow", "z-index",
  "box-shadow", "text-shadow", "transform", "transition", "animation",
  "cursor", "pointer-events", "list-style", "outline",
  "grid", "grid-template-columns", "grid-template-rows", "gap",
];

// JS 자동완성
const JS_SNIPPETS = [
  "function", "const", "let", "var", "if", "else", "for", "while", "return",
  "document.getElementById", "document.querySelector", "document.querySelectorAll",
  "addEventListener", "removeEventListener", "innerHTML", "innerText", "textContent",
  "classList.add", "classList.remove", "classList.toggle",
  "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "console.log", "console.error", "alert", "confirm", "prompt",
  "JSON.stringify", "JSON.parse", "Math.random", "Math.floor", "Math.ceil",
  "Array.from", "Object.keys", "Object.values",
  "fetch", "Promise", "async", "await",
  "window.onload", "document.createElement", "appendChild", "removeChild",
  "getAttribute", "setAttribute", "style",
];

// 태그 자동 닫기 (void elements 제외)
const VOID_TAGS = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);

function getAutoCloseTag(tag) {
  const match = tag.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
  if (!match) return null;
  const name = match[1].toLowerCase();
  if (VOID_TAGS.has(name)) return null;
  return `</${name}>`;
}

export default function CodeEditor({
  value = "",
  onChange,
  readOnly = false,
  language = "html", // html | css | js
  height = "300px",
  placeholder,
  showCopy = true,
  showReset = false,
  defaultCode = "",
  filename,
}) {
  const textareaRef = useRef(null);
  const lineRef = useRef(null);
  const suggestRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0 });
  const [suggestIdx, setSuggestIdx] = useState(0);

  // Read editor settings live from localStorage
  const es = getStoredEditorSettings();
  const themeKey = es?.theme || "vscode-dark";
  const editorTheme = EDITOR_THEMES[themeKey] || EDITOR_THEMES["vscode-dark"];
  const fontSize = es?.font_size || 14;
  const lineHeight = getLineHeight(es?.line_height || "normal");
  const showLineNums = es?.show_line_numbers !== false;
  const wordWrap = es?.word_wrap || false;
  const fontStack = getFontStack(es?.font_family || "fira-code");
  const ligature = '"liga" 1, "calt" 1';

  const lines = (value || "").split("\n");

  const syncScroll = () => {
    if (textareaRef.current && lineRef.current) {
      lineRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // 자동완성 후보 계산
  const computeSuggestions = useCallback((val, cursorPos) => {
    if (readOnly) return [];
    const before = val.substring(0, cursorPos);

    if (language === "html") {
      // 1) < 뒤에 태그명 입력 중: <h1 → snippet
      const tagMatch = before.match(/<([a-zA-Z][a-zA-Z0-9]*)$/);
      if (tagMatch) {
        const typed = tagMatch[1].toLowerCase();
        return Object.keys(HTML_SNIPPETS).filter(k => k.startsWith(typed) && k !== typed).slice(0, 8).map(k => ({
          label: `<${k}>`, insert: HTML_SNIPPETS[k], replace: `<${tagMatch[1]}`
        }));
      }
      // 2) 줄 맨 앞 또는 공백 후 태그명만 입력: h1, img, a ...
      const bareMatch = before.match(/(?:^|[\n\s])([a-zA-Z][a-zA-Z0-9:]{0,})$/);
      if (bareMatch) {
        const typed = bareMatch[1].toLowerCase();
        if (typed.length >= 1) {
          const keys = Object.keys(HTML_SNIPPETS).filter(k => k.startsWith(typed) && k !== typed);
          // "html" 입력 시 전체 구조 스니펫 먼저
          if (typed === "html" || keys.includes("html")) {
            keys.sort((a, b) => a === "html" ? -1 : b === "html" ? 1 : 0);
          }
          return keys.slice(0, 8).map(k => ({
            label: k === "html" ? `html  (전체 HTML 구조)` : `<${k}>  (snippet)`,
            insert: HTML_SNIPPETS[k], replace: bareMatch[1]
          }));
        }
      }
    } else if (language === "css") {
      const propMatch = before.match(/(?:^|\{|;|\n)\s*([a-zA-Z-]{2,})$/);
      if (propMatch) {
        const typed = propMatch[1].toLowerCase();
        return CSS_SNIPPETS.filter(s => s.startsWith(typed) && s !== typed).slice(0, 8).map(s => ({
          label: s, insert: s + ": ;", replace: propMatch[1]
        }));
      }
    } else if (language === "js") {
      const wordMatch = before.match(/([a-zA-Z_$][a-zA-Z0-9_$.]{1,})$/);
      if (wordMatch) {
        const typed = wordMatch[1];
        return JS_SNIPPETS.filter(s => s.startsWith(typed) && s !== typed).slice(0, 8).map(s => ({
          label: s, insert: s, replace: typed
        }));
      }
    }
    return [];
  }, [language, readOnly]);

  const hideSuggestions = () => setSuggestions([]);

  const applySuggestion = (sug) => {
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const val = value || "";
    const replaceLen = sug.replace.length;
    const newVal = val.substring(0, pos - replaceLen) + sug.insert + val.substring(pos);
    onChange(newVal);
    const newPos = pos - replaceLen + sug.insert.length;
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = newPos; ta.focus(); }, 0);
    hideSuggestions();
  };

  const handleChange = (e) => {
    if (readOnly) return;
    const newVal = e.target.value;
    onChange(newVal);
    const pos = e.target.selectionStart;
    const sugs = computeSuggestions(newVal, pos);
    setSuggestions(sugs);
    setSuggestIdx(0);
    if (sugs.length > 0) {
      // 간단한 위치: textarea 기반 (fixed offset)
      setSuggestPos({ top: 24, left: 40 });
    }
  };

  const handleKeyDown = (e) => {
    if (readOnly) return;

    // 자동완성 네비게이션
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSuggestIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSuggestIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySuggestion(suggestions[suggestIdx]);
        return;
      }
      if (e.key === "Escape") { hideSuggestions(); return; }
    }

    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = value || "";

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineText = val.substring(lineStart);
        const removeCount = lineText.startsWith(TAB) ? TAB.length : lineText.startsWith(" ") ? 1 : 0;
        if (removeCount > 0) {
          const newVal = val.substring(0, lineStart) + val.substring(lineStart + removeCount);
          onChange(newVal);
          setTimeout(() => { ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - removeCount); }, 0);
        }
      } else {
        const newVal = val.substring(0, start) + TAB + val.substring(end);
        onChange(newVal);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + TAB.length; }, 0);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const currentLine = val.substring(lineStart, start);
      const indent = currentLine.match(/^(\s*)/)[1];
      const trimmed = currentLine.trimEnd();
      const extra = />\s*$/.test(trimmed) && !/<\//.test(trimmed) ? TAB : "";
      const newVal = val.substring(0, start) + "\n" + indent + extra + val.substring(end);
      onChange(newVal);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1 + indent.length + extra.length; }, 0);
      hideSuggestions();
    } else if (e.key === ">" && language === "html") {
      // 태그 자동 닫기
      const before = val.substring(0, start);
      const tagMatch = before.match(/<([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?$/);
      if (tagMatch) {
        const closeTag = getAutoCloseTag(`<${tagMatch[1]}`);
        if (closeTag) {
          e.preventDefault();
          const newVal = val.substring(0, start) + ">" + closeTag + val.substring(end);
          onChange(newVal);
          setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1; }, 0);
        }
      }
    }
  };

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const langLabel = { html: "HTML", css: "CSS", js: "JavaScript" }[language] || "Code";
  const langColor = { html: "#f97316", css: "#3b82f6", js: "#eab308" }[language] || "#9ca3af";
  const fileLabel = filename || (language === "html" ? "index.html" : language === "css" ? "style.css" : "script.js");

  return (
    <div className="flex flex-col h-full relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg border-b" style={{ background: editorTheme.toolbar, borderColor: editorTheme.border }}>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="ml-2 text-xs font-mono" style={{ color: langColor }}>{fileLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: langColor + "30", color: langColor }}>{langLabel}</span>
          {showReset && (
            <button onClick={() => { onChange(defaultCode); hideSuggestions(); }} className="p-1 rounded transition-colors" style={{ color: editorTheme.lineNum }} title="초기화">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {showCopy && !readOnly && (
            <button onClick={handleCopy} className="p-1 rounded transition-colors" style={{ color: editorTheme.lineNum }} title="복사">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex rounded-b-lg overflow-hidden relative" style={{ minHeight: height, background: editorTheme.bg, boxShadow: editorTheme.glow || "none" }}>
        {/* Line numbers */}
        {showLineNums && (
          <div
            ref={lineRef}
            className="select-none text-right pr-3 pl-2 pt-3 font-mono overflow-hidden flex-shrink-0"
            style={{ minWidth: "2.5rem", background: editorTheme.bg, color: editorTheme.lineNum, borderRight: `1px solid ${editorTheme.border}`, fontSize: `${fontSize}px`, lineHeight, fontFamily: fontStack }}
          >
            {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
          </div>
        )}

        <div className="relative flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            onBlur={() => setTimeout(hideSuggestions, 150)}
            readOnly={readOnly}
            placeholder={placeholder || `${langLabel} 코드를 입력하세요...`}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className="w-full font-mono p-3 resize-none outline-none"
            style={{
              minHeight: height,
              background: "transparent",
              color: editorTheme.text,
              fontSize: `${fontSize}px`,
              lineHeight,
              fontFamily: fontStack,
              fontFeatureSettings: ligature,
              wordBreak: wordWrap ? "break-all" : "normal",
              whiteSpace: wordWrap ? "pre-wrap" : "pre",
              userSelect: readOnly ? "none" : "text",
              WebkitUserSelect: readOnly ? "none" : "text",
            }}
            onCopy={readOnly ? e => e.preventDefault() : undefined}
            onContextMenu={readOnly ? e => e.preventDefault() : undefined}
          />

          {/* 자동완성 드롭다운 */}
          {suggestions.length > 0 && (
            <div
              ref={suggestRef}
              className="absolute z-50 bg-gray-900 border border-gray-600 rounded-lg shadow-xl overflow-hidden"
              style={{ top: "2rem", left: "2.5rem", minWidth: "180px", maxWidth: "280px" }}
            >
              {suggestions.map((s, i) => (
                <div
                  key={s.label}
                  onMouseDown={e => { e.preventDefault(); applySuggestion(s); }}
                  className={`px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors ${
                    i === suggestIdx ? "bg-orange-600 text-white" : "text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  <span className="opacity-60 text-[10px] mr-1.5">{langLabel}</span>
                  {s.label}
                </div>
              ))}
              <div className="px-2 py-1 text-[10px] text-gray-500 border-t border-gray-700">↑↓ 선택  Enter/Tab 적용  Esc 닫기</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}