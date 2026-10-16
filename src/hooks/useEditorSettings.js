import { useState } from "react";

export const EDITOR_THEMES = {
  // ── Dark 계열 ──
  "vscode-dark": {
    label: "VS Code Dark", group: "Dark", desc: "클래식 VS Code 다크",
    bg: "#1e1e1e", text: "#d4d4d4", lineNum: "#858585", toolbar: "#252526", border: "#3e3e42",
    accent: "#569cd6",
  },
  "dracula": {
    label: "Dracula", group: "Dark", desc: "어두운 보라색 분위기",
    bg: "#282a36", text: "#f8f8f2", lineNum: "#6272a4", toolbar: "#21222c", border: "#44475a",
    accent: "#bd93f9",
  },
  "monokai": {
    label: "Monokai", group: "Dark", desc: "노랑·초록 강조 레트로",
    bg: "#272822", text: "#f8f8f2", lineNum: "#75715e", toolbar: "#1e1f1c", border: "#3e3d32",
    accent: "#a6e22e",
  },
  "one-dark": {
    label: "One Dark", group: "Dark", desc: "Atom 에디터 인기 테마",
    bg: "#282c34", text: "#abb2bf", lineNum: "#495162", toolbar: "#21252b", border: "#3b4048",
    accent: "#61afef",
  },
  "material-dark": {
    label: "Material Dark", group: "Dark", desc: "구글 Material 다크",
    bg: "#212121", text: "#eeffff", lineNum: "#546e7a", toolbar: "#1a1a1a", border: "#37474f",
    accent: "#82aaff",
  },
  "tokyo-night": {
    label: "Tokyo Night", group: "Dark", desc: "도쿄 야경 느낌 블루",
    bg: "#1a1b2e", text: "#a9b1d6", lineNum: "#3d4461", toolbar: "#16161e", border: "#2a2b3d",
    accent: "#7aa2f7",
  },
  "nord": {
    label: "Nord", group: "Dark", desc: "차갑고 깔끔한 북유럽 스타일",
    bg: "#2e3440", text: "#d8dee9", lineNum: "#4c566a", toolbar: "#252b37", border: "#3b4252",
    accent: "#81a1c1",
  },
  "synthwave": {
    label: "SynthWave", group: "Dark", desc: "80년대 신스팝 바이브",
    bg: "#1a0533", text: "#f0e6ff", lineNum: "#6f42c1", toolbar: "#12022a", border: "#5a1a8a",
    accent: "#f72585",
  },
  "cyberpunk": {
    label: "Cyberpunk", group: "Dark", desc: "네온 사이버펑크 느낌",
    bg: "#0d0221", text: "#00ff9f", lineNum: "#ff00ff", toolbar: "#07011a", border: "#ff00ff",
    accent: "#ffff00", glow: "0 0 8px #00ff9f55",
  },
  "matrix-green": {
    label: "Matrix Green", group: "Dark", desc: "매트릭스 해커 초록",
    bg: "#0a0a0a", text: "#00ff41", lineNum: "#003b00", toolbar: "#050505", border: "#00420a",
    accent: "#39ff14", glow: "0 0 6px #00ff4133",
  },
  "amoled-black": {
    label: "AMOLED Black", group: "Dark", desc: "OLED 완전 검정 배경",
    bg: "#000000", text: "#ffffff", lineNum: "#555555", toolbar: "#0a0a0a", border: "#1a1a1a",
    accent: "#00bfff",
  },

  // ── Light 계열 ──
  "vscode-light": {
    label: "VS Code Light", group: "Light", desc: "클래식 VS Code 라이트",
    bg: "#ffffff", text: "#383a42", lineNum: "#aaaaaa", toolbar: "#f3f3f3", border: "#e1e1e1",
    accent: "#0000ff",
  },
  "github-light": {
    label: "GitHub Light", group: "Light", desc: "깃허브 스타일 밝은 테마",
    bg: "#f6f8fa", text: "#24292e", lineNum: "#bbbcbe", toolbar: "#eff1f3", border: "#d1d5da",
    accent: "#005cc5",
  },
  "solarized-light": {
    label: "Solarized Light", group: "Light", desc: "베이지 따뜻한 느낌",
    bg: "#fdf6e3", text: "#657b83", lineNum: "#93a1a1", toolbar: "#eee8d5", border: "#d3cbb8",
    accent: "#268bd2",
  },
  "paper": {
    label: "Paper", group: "Light", desc: "하얀 종이 느낌",
    bg: "#f9f9f9", text: "#333333", lineNum: "#cccccc", toolbar: "#f0f0f0", border: "#e0e0e0",
    accent: "#d73a49",
  },
  "soft-cream": {
    label: "Soft Cream", group: "Light", desc: "부드러운 크림색 배경",
    bg: "#fffdf5", text: "#5c4f3a", lineNum: "#c8b98a", toolbar: "#f5edd8", border: "#e6d9b8",
    accent: "#c0392b",
  },
  "notion-style": {
    label: "Notion Style", group: "Light", desc: "노션처럼 깔끔하고 심플",
    bg: "#ffffff", text: "#37352f", lineNum: "#c7c5be", toolbar: "#f7f6f3", border: "#e9e9e7",
    accent: "#0f7b6c",
  },

  // ── Mac 느낌 ──
  "macbook-dark": {
    label: "MacBook Dark", group: "Mac", desc: "macOS 다크 모드",
    bg: "#1c1c1e", text: "#f2f2f7", lineNum: "#636366", toolbar: "#2c2c2e", border: "#3a3a3c",
    accent: "#0a84ff",
  },
  "macbook-light": {
    label: "MacBook Light", group: "Mac", desc: "macOS 라이트 모드",
    bg: "#f5f5f7", text: "#1d1d1f", lineNum: "#aaaaaa", toolbar: "#e8e8ed", border: "#d2d2d7",
    accent: "#0071e3",
  },
  "xcode-dark": {
    label: "Xcode Dark", group: "Mac", desc: "Xcode 다크 테마",
    bg: "#292a30", text: "#dfdfe0", lineNum: "#747478", toolbar: "#1f2024", border: "#3e3e42",
    accent: "#6bdfff",
  },
  "xcode-light": {
    label: "Xcode Light", group: "Mac", desc: "Xcode 라이트 테마",
    bg: "#ffffff", text: "#000000", lineNum: "#aaaaaa", toolbar: "#f0f0f0", border: "#d8d8d8",
    accent: "#3900a0",
  },

  // ── 색감 강한 ──
  "neon-purple": {
    label: "Neon Purple", group: "Neon", desc: "강렬한 보라색 네온",
    bg: "#120024", text: "#e8ccff", lineNum: "#7b3fa0", toolbar: "#0a0015", border: "#6a1a9a",
    accent: "#c850f0", glow: "0 0 8px #c850f033",
  },
  "neon-blue": {
    label: "Neon Blue", group: "Neon", desc: "파랑 네온 전기 느낌",
    bg: "#000d1a", text: "#cceeff", lineNum: "#1a4a6a", toolbar: "#000811", border: "#0a4a7a",
    accent: "#00bfff", glow: "0 0 8px #00bfff33",
  },
  "neon-pink": {
    label: "Neon Pink", group: "Neon", desc: "핑크 네온 팝 스타일",
    bg: "#1a0018", text: "#ffccee", lineNum: "#7a1a60", toolbar: "#110010", border: "#8a1a70",
    accent: "#ff69b4", glow: "0 0 8px #ff69b433",
  },
  "hacker-green": {
    label: "Hacker Green", group: "Neon", desc: "해커 터미널 초록",
    bg: "#001100", text: "#33ff33", lineNum: "#005500", toolbar: "#000d00", border: "#003300",
    accent: "#00ff00", glow: "0 0 6px #33ff3333",
  },
  "orange-flame": {
    label: "Orange Flame", group: "Neon", desc: "불꽃 오렌지 에너지",
    bg: "#1a0a00", text: "#ffe0b2", lineNum: "#7a3a00", toolbar: "#110700", border: "#6a2800",
    accent: "#ff6600", glow: "0 0 8px #ff660033",
  },

  // ── CODA 학원용 ──
  "coda-dark": {
    label: "CODA Dark", group: "CODA", desc: "CODA 기본 다크 테마",
    bg: "#1a1a2e", text: "#e8e8f0", lineNum: "#4a4a6a", toolbar: "#12122a", border: "#2a2a4a",
    accent: "#f97316",
  },
  "coda-green": {
    label: "CODA Green", group: "CODA", desc: "CODA 초록 집중 테마",
    bg: "#0d1f1a", text: "#d4f0e0", lineNum: "#2a5a40", toolbar: "#091510", border: "#1a4030",
    accent: "#22c55e",
  },
  "coda-yellow": {
    label: "CODA Yellow", group: "CODA", desc: "CODA 노랑 활기 테마",
    bg: "#1a1500", text: "#fff8cc", lineNum: "#5a4a00", toolbar: "#110e00", border: "#3a3000",
    accent: "#eab308",
  },
  "coda-classic": {
    label: "CODA Classic", group: "CODA", desc: "CODA 클래식 화이트",
    bg: "#f8f9ff", text: "#1a1a3a", lineNum: "#9090b0", toolbar: "#eef0fa", border: "#d0d4f0",
    accent: "#6366f1",
  },
};

export const THEME_GROUPS = ["Dark", "Light", "Mac", "Neon", "CODA"];

export const EDITOR_FONTS = [
  { key: "fira-code", label: "Fira Code", stack: "'Fira Code', 'Cascadia Code', monospace", ligature: true },
  { key: "jetbrains-mono", label: "JetBrains Mono", stack: "'JetBrains Mono', 'Fira Code', monospace", ligature: true },
  { key: "cascadia-code", label: "Cascadia Code", stack: "'Cascadia Code', 'Consolas', monospace", ligature: true },
  { key: "consolas", label: "Consolas", stack: "'Consolas', 'Courier New', monospace", ligature: false },
  { key: "monaco", label: "Monaco", stack: "'Monaco', 'Menlo', monospace", ligature: false },
  { key: "source-code-pro", label: "Source Code Pro", stack: "'Source Code Pro', 'DejaVu Sans Mono', monospace", ligature: false },
];

export const DEFAULT_EDITOR_SETTINGS = {
  theme: "vscode-dark",
  font_size: 14,
  font_family: "fira-code",
  line_height: "normal",
  show_line_numbers: true,
  word_wrap: false,
};

const LINE_HEIGHT_MAP = { compact: "1.4", normal: "1.6", relaxed: "2" };
export function getLineHeight(lh) { return LINE_HEIGHT_MAP[lh] || "1.6"; }

export function getFontStack(fontKey) {
  return EDITOR_FONTS.find(f => f.key === fontKey)?.stack || EDITOR_FONTS[0].stack;
}

const STORAGE_KEY = "coda_editor_settings";

export function useEditorSettings(_userId) {
  // localStorage에만 저장 (StudentUnitProgress 오용 제거)
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(saved) } : DEFAULT_EDITOR_SETTINGS;
    } catch { return DEFAULT_EDITOR_SETTINGS; }
  });

  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings)); } catch {}
  };

  return { settings, saveSettings };
}