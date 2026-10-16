// 하위 호환 래퍼 → 새 MultiPreview를 사용
import MultiPreview from "./MultiPreview";
export default function HtmlPreview({ html, autoPreview, height }) {
  return <MultiPreview html={html || ""} css="" js="" autoPreview={autoPreview} height={height} />;
}