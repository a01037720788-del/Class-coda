/**
 * C++ 코드 실행 미지원 안내
 *
 * 브라우저만으로는 C++ 를 컴파일할 수 없어 실행 기능을 제공하지 않습니다.
 * 외부 실행 서비스도 사용하지 않습니다.
 * 코드 작성·저장, 예제 코드 비교 확인은 정상적으로 사용할 수 있습니다.
 */

import React from "react";
import { AlertTriangle } from "lucide-react";

export const CPP_UNSUPPORTED_SHORT = "C++ 코드 실행은 이 사이트에서 지원하지 않습니다.";

export const CPP_UNSUPPORTED_DETAIL =
  "브라우저만으로는 C++ 를 컴파일할 수 없어 실행 기능을 제공하지 않습니다. " +
  "외부 실행 서비스도 사용하지 않습니다. " +
  "코드 작성·저장과 예제 코드 비교 확인은 그대로 사용할 수 있습니다.";

export default function CppUnsupportedNotice({ className = "" }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 ${className}`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
      <div>
        <p className="font-semibold mb-0.5">{CPP_UNSUPPORTED_SHORT}</p>
        <p className="text-amber-800 leading-relaxed">{CPP_UNSUPPORTED_DETAIL}</p>
      </div>
    </div>
  );
}