// 하위 호환 래퍼 → 새 TripleEditor를 사용 (HTML 전용)
import React, { useState } from "react";
import TripleEditor from "./TripleEditor";

export default function HtmlSplitEditor({ value, onChange, readOnly, defaultCode, autoSaveKey, height }) {
  return (
    <TripleEditor
      htmlValue={value || ""} onHtmlChange={onChange || (() => {})}
      cssValue="" onCssChange={() => {}}
      jsValue="" onJsChange={() => {}}
      readOnly={readOnly} defaultHtml={defaultCode}
      autoSaveKey={autoSaveKey} height={height}
    />
  );
}