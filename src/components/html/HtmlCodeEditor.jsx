// 하위 호환 래퍼 → 새 CodeEditor를 사용
import CodeEditor from "./CodeEditor";
export default function HtmlCodeEditor({ value, onChange, readOnly, height, placeholder, showCopy, onReset, defaultCode }) {
  return (
    <CodeEditor
      value={value} onChange={onChange} readOnly={readOnly}
      language="html" height={height} placeholder={placeholder}
      showCopy={showCopy} showReset={!!onReset} defaultCode={defaultCode}
    />
  );
}