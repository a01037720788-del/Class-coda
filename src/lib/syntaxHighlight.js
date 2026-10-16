// Python IDLE 스타일 단순 구문 하이라이팅

// ── Python ──
const PY_KEYWORDS = /\b(if|elif|else|for|while|break|continue|def|return|try|except|class|import|from|in|as|with|pass|raise|and|or|not|is|None|True|False|lambda|yield|del|global|nonlocal|assert|finally)\b/g;
const PY_BUILTINS = /\b(print|input|int|float|str|len|range|list|dict|tuple|set|abs|max|min|sum|type|bool|sorted|reversed|enumerate|zip|map|filter|open|round|format|repr|id|isinstance|hasattr|getattr|setattr|chr|ord|bin|oct|hex|eval|exec|vars|dir|help|super|object|property|staticmethod|classmethod|iter|next|all|any)\b/g;

// ── C++ ──
const CPP_KEYWORDS = /\b(int|double|float|char|bool|void|long|short|unsigned|signed|if|else|for|while|do|return|class|struct|public|private|protected|namespace|using|include|define|const|static|auto|new|delete|try|catch|throw|true|false|nullptr|sizeof|template|typename|virtual|override|inline|enum|typedef|break|continue|switch|case|default)\b/g;
const CPP_BUILTINS = /\b(cout|cin|main|vector|string|sort|push_back|pop_back|size|begin|end|find|insert|erase|clear|map|set|pair|make_pair|printf|scanf|endl|getline|stoi|stof|to_string|abs|max|min|swap|reverse|upper_bound|lower_bound)\b/g;

// ── Java ──
const JAVA_KEYWORDS = /\b(public|private|protected|class|static|void|if|else|for|while|do|return|new|try|catch|finally|throw|throws|import|package|extends|implements|interface|abstract|final|boolean|int|double|float|char|long|short|byte|null|true|false|this|super|break|continue|switch|case|default|instanceof|native|synchronized|transient|volatile)\b/g;
const JAVA_BUILTINS = /\b(System\.out\.println|System\.out\.print|Scanner|nextInt|nextLine|nextDouble|nextFloat|nextBoolean|ArrayList|HashMap|String|Integer|Double|Math|Object|Arrays|Collections|StringBuilder)\b/g;

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 토큰 기반 하이라이터 (Python/C++/Java 공통)
function tokenize(code, language) {
  const tokens = [];
  let i = 0;

  while (i < code.length) {
    // 줄바꿈
    if (code[i] === "\n") {
      tokens.push({ type: "nl", val: "\n" });
      i++;
      continue;
    }

    // Python/C++/Java 주석
    if (language === "python" && code[i] === "#") {
      const end = code.indexOf("\n", i);
      const val = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ type: "comment", val });
      i += val.length;
      continue;
    }
    if ((language === "cpp" || language === "java") && code.slice(i, i + 2) === "//") {
      const end = code.indexOf("\n", i);
      const val = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ type: "comment", val });
      i += val.length;
      continue;
    }
    if ((language === "cpp" || language === "java") && code.slice(i, i + 2) === "/*") {
      const end = code.indexOf("*/", i + 2);
      const val = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      tokens.push({ type: "comment", val });
      i += val.length;
      continue;
    }

    // 문자열 (쌍따옴표)
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"' && code[j] !== "\n") {
        if (code[j] === "\\") j++;
        j++;
      }
      if (j < code.length && code[j] === '"') j++;
      tokens.push({ type: "string", val: code.slice(i, j) });
      i = j;
      continue;
    }

    // 문자열 (홑따옴표, Python only)
    if (language === "python" && code[i] === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== "'" && code[j] !== "\n") {
        if (code[j] === "\\") j++;
        j++;
      }
      if (j < code.length && code[j] === "'") j++;
      tokens.push({ type: "string", val: code.slice(i, j) });
      i = j;
      continue;
    }

    // 식별자 / 키워드 / 내장함수
    if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i;
      // 점 포함 identifier (Java: System.out.println 등)
      while (j < code.length && /[a-zA-Z0-9_$.]/.test(code[j])) j++;
      const word = code.slice(i, j);

      let type = "ident";
      if (language === "python") {
        if (/^(if|elif|else|for|while|break|continue|def|return|try|except|class|import|from|in|as|with|pass|raise|and|or|not|is|None|True|False|lambda|yield|del|global|nonlocal|assert|finally)$/.test(word)) type = "keyword";
        else if (/^(print|input|int|float|str|len|range|list|dict|tuple|set|abs|max|min|sum|type|bool|sorted|reversed|enumerate|zip|map|filter|open|round|format|repr|id|isinstance|hasattr|getattr|setattr|chr|ord|bin|oct|hex|eval|exec|vars|dir|help|super|object|property|staticmethod|classmethod|iter|next|all|any)$/.test(word)) type = "builtin";
      } else if (language === "cpp") {
        if (/^(int|double|float|char|bool|void|long|short|unsigned|signed|if|else|for|while|do|return|class|struct|public|private|protected|namespace|using|include|define|const|static|auto|new|delete|try|catch|throw|true|false|nullptr|sizeof|template|typename|virtual|override|inline|enum|typedef|break|continue|switch|case|default)$/.test(word)) type = "keyword";
        else if (/^(cout|cin|main|vector|string|sort|push_back|pop_back|size|begin|end|find|insert|erase|clear|map|set|pair|make_pair|printf|scanf|endl|getline|stoi|stof|to_string|abs|max|min|swap|reverse|upper_bound|lower_bound)$/.test(word)) type = "builtin";
      } else if (language === "java") {
        if (/^(public|private|protected|class|static|void|if|else|for|while|do|return|new|try|catch|finally|throw|throws|import|package|extends|implements|interface|abstract|final|boolean|int|double|float|char|long|short|byte|null|true|false|this|super|break|continue|switch|case|default|instanceof|native|synchronized|transient|volatile)$/.test(word)) type = "keyword";
        else if (/^(System\.out\.println|System\.out\.print|Scanner|nextInt|nextLine|nextDouble|nextFloat|nextBoolean|ArrayList|HashMap|String|Integer|Double|Math|Object|Arrays|Collections|StringBuilder)$/.test(word)) type = "builtin";
      }
      tokens.push({ type, val: word });
      i = j;
      continue;
    }

    // 나머지 (연산자, 숫자, 공백 등) → 기본 텍스트
    tokens.push({ type: "default", val: code[i] });
    i++;
  }

  return tokens;
}

const TYPE_COLOR = {
  keyword: "#4A90D9",   // 파란색
  builtin: "#9B59B6",   // 보라색
  string:  "#27AE60",   // 초록색
  comment: "#95A5A6",   // 회색
  ident:   null,        // 기본색
  default: null,
  nl:      null,
};

export function highlightCode(code, language) {
  if (!language || language === "html" || language === "css" || language === "js") {
    return escapeHtml(code);
  }

  const tokens = tokenize(code, language);
  return tokens.map(t => {
    const escaped = escapeHtml(t.val);
    const color = TYPE_COLOR[t.type];
    if (!color) return escaped;
    return `<span style="color:${color}">${escaped}</span>`;
  }).join("");
}