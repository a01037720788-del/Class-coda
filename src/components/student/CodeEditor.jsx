import React, { useRef, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { EDITOR_THEMES, EDITOR_FONTS, getFontStack } from "@/hooks/useEditorSettings";

function getStoredEditorSettings() {
  try {
    const s = localStorage.getItem("coda_editor_settings");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

// ── 커스텀 테마 정의 (Monaco) ──
function defineCodaThemes(monaco) {
  const themes = [
    { key: "coda-vs-dark", base: "vs-dark", bg: "#1e1e1e", fg: "#d4d4d4", ln: "#858585" },
    { key: "coda-dracula", base: "vs-dark", bg: "#282a36", fg: "#f8f8f2", ln: "#6272a4" },
    { key: "coda-monokai", base: "vs-dark", bg: "#272822", fg: "#f8f8f2", ln: "#75715e" },
    { key: "coda-one-dark", base: "vs-dark", bg: "#282c34", fg: "#abb2bf", ln: "#495162" },
    { key: "coda-material-dark", base: "vs-dark", bg: "#212121", fg: "#eeffff", ln: "#546e7a" },
    { key: "coda-tokyo-night", base: "vs-dark", bg: "#1a1b2e", fg: "#a9b1d6", ln: "#3d4461" },
    { key: "coda-nord", base: "vs-dark", bg: "#2e3440", fg: "#d8dee9", ln: "#4c566a" },
    { key: "coda-synthwave", base: "vs-dark", bg: "#1a0533", fg: "#f0e6ff", ln: "#6f42c1" },
    { key: "coda-cyberpunk", base: "vs-dark", bg: "#0d0221", fg: "#00ff9f", ln: "#ff00ff" },
    { key: "coda-matrix-green", base: "vs-dark", bg: "#0a0a0a", fg: "#00ff41", ln: "#003b00" },
    { key: "coda-amoled-black", base: "vs-dark", bg: "#000000", fg: "#ffffff", ln: "#555555" },
    { key: "coda-vs-light", base: "vs", bg: "#ffffff", fg: "#383a42", ln: "#aaaaaa" },
    { key: "coda-github-light", base: "vs", bg: "#f6f8fa", fg: "#24292e", ln: "#bbbcbe" },
    { key: "coda-solarized-light", base: "vs", bg: "#fdf6e3", fg: "#657b83", ln: "#93a1a1" },
    { key: "coda-paper", base: "vs", bg: "#f9f9f9", fg: "#333333", ln: "#cccccc" },
    { key: "coda-soft-cream", base: "vs", bg: "#fffdf5", fg: "#5c4f3a", ln: "#c8b98a" },
    { key: "coda-notion-style", base: "vs", bg: "#ffffff", fg: "#37352f", ln: "#c7c5be" },
    { key: "coda-macbook-dark", base: "vs-dark", bg: "#1c1c1e", fg: "#f2f2f7", ln: "#636366" },
    { key: "coda-macbook-light", base: "vs", bg: "#f5f5f7", fg: "#1d1d1f", ln: "#aaaaaa" },
    { key: "coda-xcode-dark", base: "vs-dark", bg: "#292a30", fg: "#dfdfe0", ln: "#747478" },
    { key: "coda-xcode-light", base: "vs", bg: "#ffffff", fg: "#000000", ln: "#aaaaaa" },
    { key: "coda-neon-purple", base: "vs-dark", bg: "#120024", fg: "#e8ccff", ln: "#7b3fa0" },
    { key: "coda-neon-blue", base: "vs-dark", bg: "#000d1a", fg: "#cceeff", ln: "#1a4a6a" },
    { key: "coda-neon-pink", base: "vs-dark", bg: "#1a0018", fg: "#ffccee", ln: "#7a1a60" },
    { key: "coda-hacker-green", base: "vs-dark", bg: "#001100", fg: "#33ff33", ln: "#005500" },
    { key: "coda-orange-flame", base: "vs-dark", bg: "#1a0a00", fg: "#ffe0b2", ln: "#7a3a00" },
    { key: "coda-coda-dark", base: "vs-dark", bg: "#1a1a2e", fg: "#e8e8f0", ln: "#4a4a6a" },
    { key: "coda-coda-green", base: "vs-dark", bg: "#0d1f1a", fg: "#d4f0e0", ln: "#2a5a40" },
    { key: "coda-coda-yellow", base: "vs-dark", bg: "#1a1500", fg: "#fff8cc", ln: "#5a4a00" },
    { key: "coda-coda-classic", base: "vs", bg: "#f8f9ff", fg: "#1a1a3a", ln: "#9090b0" },
  ];

  themes.forEach(({ key, base, bg, fg, ln }) => {
    monaco.editor.defineTheme(key, {
      base,
      inherit: true,
      rules: [],
      colors: {
        "editor.background": bg,
        "editor.foreground": fg,
        "editorLineNumber.foreground": ln,
        "editorLineNumber.activeForeground": fg,
        "editor.selectionBackground": base === "vs-dark" ? "#264f7855" : "#add6ff88",
        "editor.lineHighlightBackground": base === "vs-dark" ? "#ffffff0d" : "#0000000a",
        "editorCursor.foreground": fg,
        "editorIndentGuide.background": base === "vs-dark" ? "#ffffff20" : "#00000020",
        "editorIndentGuide.activeBackground": base === "vs-dark" ? "#ffffff40" : "#00000040",
      },
    });
  });
}

const THEME_KEY_MAP = {
  "vscode-dark": "coda-vs-dark",
  "dracula": "coda-dracula",
  "monokai": "coda-monokai",
  "one-dark": "coda-one-dark",
  "material-dark": "coda-material-dark",
  "tokyo-night": "coda-tokyo-night",
  "nord": "coda-nord",
  "synthwave": "coda-synthwave",
  "cyberpunk": "coda-cyberpunk",
  "matrix-green": "coda-matrix-green",
  "amoled-black": "coda-amoled-black",
  "vscode-light": "coda-vs-light",
  "github-light": "coda-github-light",
  "solarized-light": "coda-solarized-light",
  "paper": "coda-paper",
  "soft-cream": "coda-soft-cream",
  "notion-style": "coda-notion-style",
  "macbook-dark": "coda-macbook-dark",
  "macbook-light": "coda-macbook-light",
  "xcode-dark": "coda-xcode-dark",
  "xcode-light": "coda-xcode-light",
  "neon-purple": "coda-neon-purple",
  "neon-blue": "coda-neon-blue",
  "neon-pink": "coda-neon-pink",
  "hacker-green": "coda-hacker-green",
  "orange-flame": "coda-orange-flame",
  "coda-dark": "coda-coda-dark",
  "coda-green": "coda-coda-green",
  "coda-yellow": "coda-coda-yellow",
  "coda-classic": "coda-coda-classic",
};

let themesDefined = false;

export default function CodeEditor({
  value,
  onChange,
  language = "cpp",
  readOnly = false,
  height = "200px",
  placeholder = "",
}) {
  const editorRef = useRef(null);

  const es = getStoredEditorSettings();
  const themeKey = es?.theme || "vscode-dark";
  const monacoTheme = THEME_KEY_MAP[themeKey] || "coda-vs-dark";
  const fontSize = es?.font_size || 14;
  const fontKey = es?.font_family || "fira-code";
  const fontStack = getFontStack(fontKey);
  const fontLigatures = EDITOR_FONTS.find(f => f.key === fontKey)?.ligature || false;
  const showLineNums = es?.show_line_numbers !== false;
  const wordWrap = es?.word_wrap || false;
  const lineHeightVal = es?.line_height || "normal";
  const lineHeightNum = lineHeightVal === "compact" ? 1.3 : lineHeightVal === "relaxed" ? 1.8 : 1.6;

  const monacoLang = language === "python" ? "python" : language === "cpp" ? "cpp" : "plaintext";

  const options = useMemo(() => ({
    readOnly,
    fontSize,
    fontFamily: fontStack,
    fontLigatures,
    lineHeight: lineHeightNum * fontSize,
    tabSize: 4,
    insertSpaces: true,
    detectIndentation: false,
    wordWrap: wordWrap ? "on" : "off",
    lineNumbers: showLineNums ? "on" : "off",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    autoClosingBrackets: "always",
    autoClosingQuotes: "always",
    autoIndent: "advanced",
    formatOnPaste: false,
    formatOnType: false,
    suggestOnTriggerCharacters: false,
    parameterHints: { enabled: false },
    quickSuggestions: { other: false, comments: false, strings: false },
    snippetSuggestions: "none",
    tabCompletion: "on",
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    smoothScrolling: true,
    padding: { top: 12, bottom: 12 },
    scrollbar: {
      vertical: "auto",
      horizontal: "auto",
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    renderLineHighlight: "line",
    roundedSelection: true,
    contextmenu: !readOnly,
    copyWithSyntaxHighlighting: false,
    links: false,
    colorDecorators: false,
    matchBrackets: "always",
    guides: {
      indentation: true,
      bracketPairs: true,
    },
    stickyScroll: { enabled: false },
    wordBasedSuggestions: "off",
  }), [readOnly, fontSize, fontStack, fontLigatures, lineHeightNum, showLineNums, wordWrap]);

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    if (!themesDefined) {
      defineCodaThemes(monaco);
      themesDefined = true;
    }
    monaco.editor.setTheme(monacoTheme);

    // C++ 추가 키워드 등록 (long long, vector, queue, stack, set, map 등)
    if (monacoLang === "cpp") {
      monaco.languages.registerCompletionItemProvider?.("cpp", {
        provideCompletionItems: () => ({ suggestions: [] }),
      });
    }
  };

  return (
    <Editor
      height={height}
      language={monacoLang}
      value={value || ""}
      theme={monacoTheme}
      onChange={(val) => onChange?.(val ?? "")}
      onMount={handleMount}
      options={options}
      loading={
        <div className="flex items-center justify-center h-full text-xs text-gray-400">
          에디터 로딩 중...
        </div>
      }
    />
  );
}