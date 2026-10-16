import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Presentation } from "lucide-react";

// Unit 관리 목록에 추가하는 [수업 설명] 버튼
// subjectType: python, junior_python, cpp, java, html, algorithm_learning, entry, block, other
export default function TeachingButton({ subjectType, unitId, disabled }) {
  return (
    <Link to={`/admin/teaching/${subjectType}/${unitId}`} className="inline-flex">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        className="h-7 px-2 text-xs border-violet-200 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
        title="수업 설명 모드"
      >
        <Presentation className="w-3.5 h-3.5 mr-0.5" />
        수업 설명
      </Button>
    </Link>
  );
}